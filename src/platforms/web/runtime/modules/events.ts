import { isDef, isUndef } from 'shared/util'
import { updateListeners } from 'core/vdom/helpers/index'
import { isIE, isFF, supportsPassive, isUsingMicroTask } from 'core/util/index'
import {
  RANGE_TOKEN,
  CHECKBOX_RADIO_TOKEN
} from 'web/compiler/directives/model'
import { currentFlushTimestamp } from 'core/observer/scheduler'
import { emptyNode } from 'core/vdom/patch'
import type { VNodeWithData } from 'types/vnode'

// normalize v-model event tokens that can only be determined at runtime.
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
/**
 * 规范化事件，
 * 将v-model事件放到数组的第一个位置，
 * 因为v-model的回调函数需要在用户自定义的回调函数之前执行，
 * 所以需要将v-model事件放到数组的第一个位置，
 * 这样才能保证v-model的回调函数先执行，
 * 然后再执行用户自定义的回调函数，
 * @param on - 事件
 */
function normalizeEvents(on) {
  /* istanbul ignore if */
  if (isDef(on[RANGE_TOKEN])) {
    // IE input[type=range] only supports `change` event
    const event = isIE ? 'change' : 'input'
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
    delete on[RANGE_TOKEN]
  }
  // This was originally intended to fix #4521 but no longer necessary
  // after 2.5. Keeping it for backwards compat with generated code from < 2.4
  /* istanbul ignore if */
  if (isDef(on[CHECKBOX_RADIO_TOKEN])) {
    on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
    delete on[CHECKBOX_RADIO_TOKEN]
  }
}

let target: any

/**
 * 创建一次处理程序
 * @param event - 事件
 * @param handler - 处理程序
 * @param capture - 是否捕获
 */
function createOnceHandler(event, handler, capture) {
  const _target = target // save current target element in closure
  return function onceHandler() {
    const res = handler.apply(null, arguments)
    if (res !== null) {
      // 如果返回值不为null，则解绑事件
      remove(event, onceHandler, capture, _target) // 解绑事件
    }
  }
}

// #9446: Firefox <= 53 (in particular, ESR 52) has incorrect Event.timeStamp
// implementation and does not fire microtasks in between event propagation, so
// safe to exclude.
const useMicrotaskFix = isUsingMicroTask && !(isFF && Number(isFF[1]) <= 53)

/**
 * 添加事件监听
 * @param name - 事件名称
 * @param handler - 处理程序
 * @param capture - 是否捕获
 * @param passive - 是否被动
 */
function add(
  name: string,
  handler: Function,
  capture: boolean,
  passive: boolean
) {
  // async edge case #6566: inner click event triggers patch, event handler
  // attached to outer element during patch, and triggered again. This
  // happens because browsers fire microtask ticks between event propagation.
  // the solution is simple: we save the timestamp when a handler is attached,
  // and the handler would only fire if the event passed to it was fired
  // AFTER it was attached.
  if (useMicrotaskFix) {
    // 如果是使用微任务修复，则将当前时间戳赋值给attachedTimestamp
    const attachedTimestamp = currentFlushTimestamp
    const original = handler // 保存原始的处理程序
    /**
     * 重新定义处理程序
     */
    //@ts-expect-error
    handler = original._wrapper = function (e) {
      if (
        // no bubbling, should always fire.
        // this is just a safety net in case event.timeStamp is unreliable in
        // certain weird environments...
        e.target === e.currentTarget ||
        // event is fired after handler attachment
        e.timeStamp >= attachedTimestamp ||
        // bail for environments that have buggy event.timeStamp implementations
        // #9462 iOS 9 bug: event.timeStamp is 0 after history.pushState
        // #9681 QtWebEngine event.timeStamp is negative value
        e.timeStamp <= 0 ||
        // #9448 bail if event is fired in another document in a multi-page
        // electron/nw.js app, since event.timeStamp will be using a different
        // starting reference
        e.target.ownerDocument !== document
      ) {
        // 如果事件没有冒泡，或者事件的时间戳大于等于attachedTimestamp，或者事件的时间戳小于等于0，或者事件的目标文档不等于当前文档，则执行原始的处理程序
        return original.apply(this, arguments)
      }
    }
  }
  // 将事件处理程序添加到事件监听器中
  target.addEventListener(
    name,
    handler,
    supportsPassive ? { capture, passive } : capture
  )
}

/**
 * 移除事件监听
 * @param name - 事件名称
 * @param handler - 处理程序
 * @param capture - 是否捕获
 * @param _target - 目标
 */
function remove(
  name: string,
  handler: Function,
  capture: boolean,
  _target?: HTMLElement
) {
  ;(_target || target).removeEventListener(
    name,
    //@ts-expect-error
    handler._wrapper || handler,
    capture
  )
}

/**
 * 更新DOM监听器
 * @param oldVnode - 旧虚拟节点
 * @param vnode - 虚拟节点
 */
function updateDOMListeners(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    // 如果旧虚拟节点和新虚拟节点都没有on属性，则直接返回
    return
  }
  const on = vnode.data.on || {} // 新虚拟节点的on属性
  const oldOn = oldVnode.data.on || {} // 旧虚拟节点的on属性
  // vnode is empty when removing all listeners,
  // and use old vnode dom element
  target = vnode.elm || oldVnode.elm // 目标元素
  normalizeEvents(on) // 规范化事件
  updateListeners(on, oldOn, add, remove, createOnceHandler, vnode.context) // 更新监听器
  target = undefined // 目标元素置为undefined
}

export default {
  create: updateDOMListeners,
  update: updateDOMListeners,
  // @ts-expect-error emptyNode has actually data
  destroy: (vnode: VNodeWithData) => updateDOMListeners(vnode, emptyNode)
}
