import { warn, invokeWithErrorHandling } from 'core/util/index'
import { cached, isUndef, isTrue, isArray } from 'shared/util'
import type { Component } from 'types/component'

/**
 * 规范化事件
 * @param name - 事件名
 * @returns {Object} - 返回规范化后的事件
 */
const normalizeEvent = cached(
  (
    name: string
  ): {
    name: string // 事件名
    once: boolean // 是否是一次性事件
    capture: boolean // 是否是捕获事件
    passive: boolean // 是否是被动事件
    handler?: Function // 处理函数
    params?: Array<any> // 参数
  } => {
    const passive = name.charAt(0) === '&'
    name = passive ? name.slice(1) : name
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = once ? name.slice(1) : name
    const capture = name.charAt(0) === '!'
    name = capture ? name.slice(1) : name
    return {
      name,
      once,
      capture,
      passive
    }
  }
)

/**
 * 创建函数调用器
 * @param fns - 函数或函数数组
 * @param vm - 组件实例
 */
export function createFnInvoker(
  fns: Function | Array<Function>, // 函数或函数数组
  vm?: Component // 组件实例
): Function {
  function invoker() {
    const fns = invoker.fns
    if (isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(
          cloned[i],
          null,
          arguments as any,
          vm,
          `v-on handler`
        )
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(
        fns,
        null,
        arguments as any,
        vm,
        `v-on handler`
      )
    }
  }
  invoker.fns = fns
  return invoker
}

/**
 * 更新监听器，
 * 添加新的监听器，移除旧的监听器，创建一次性处理程序，
 * 更新vm，返回新的监听器
 * @param on - 新的监听器
 * @param oldOn - 旧的监听器
 * @param add - 添加监听器
 * @param remove - 移除监听器
 * @param createOnceHandler - 创建一次性处理程序
 * @param vm - 组件实例
 */
export function updateListeners(
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, cur, old, event
  for (name in on) {
    cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    if (isUndef(cur)) {
      __DEV__ &&
        warn(
          `Invalid handler for event "${event.name}": got ` + String(cur),
          vm
        )
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur, vm)
      }
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      old.fns = cur
      on[name] = old
    }
  }
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
