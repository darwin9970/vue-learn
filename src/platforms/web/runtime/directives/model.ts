/**
 * Not type checking this file because flow doesn't like attaching
 * properties to Elements.
 */

import { isTextInputType } from 'web/util/element'
import { looseEqual, looseIndexOf } from 'shared/util'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { warn, isIE9, isIE, isEdge } from 'core/util/index'

/* istanbul ignore if */
if (isIE9) {
  // http://www.matts411.com/post/internet-explorer-9-oninput/
  document.addEventListener('selectionchange', () => {
    const el = document.activeElement
    // @ts-expect-error
    if (el && el.vmodel) {
      trigger(el, 'input')
    }
  })
}

const directive = {
  /**
   * 用这个钩子函数可以定义一个绑定时执行一次的初始化动作。
   * @param el
   * @param binding
   * @param vnode
   * @param oldVnode
   */
  inserted(el, binding, vnode, oldVnode) {
    if (vnode.tag === 'select') {
      // #6903
      if (oldVnode.elm && !oldVnode.elm._vOptions) {
        mergeVNodeHook(vnode, 'postpatch', () => {
          directive.componentUpdated(el, binding, vnode)
        })
      } else {
        setSelected(el, binding, vnode.context)
      }
      el._vOptions = [].map.call(el.options, getValue)
    } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
      el._vModifiers = binding.modifiers
      if (!binding.modifiers.lazy) {
        el.addEventListener('compositionstart', onCompositionStart)
        el.addEventListener('compositionend', onCompositionEnd)
        // Safari < 10.2 & UIWebView doesn't fire compositionend when
        // switching focus before confirming composition choice
        // this also fixes the issue where some browsers e.g. iOS Chrome
        // fires "change" instead of "input" on autocomplete.
        el.addEventListener('change', onCompositionEnd)
        /* istanbul ignore if */
        if (isIE9) {
          el.vmodel = true
        }
      }
    }
  },
  /**
   * 组件已更新，可以执行相应的操作
   * @param el - 元素
   * @param binding - 绑定
   * @param vnode - 虚拟节点
   */
  componentUpdated(el, binding, vnode) {
    if (vnode.tag === 'select') {
      setSelected(el, binding, vnode.context)
      // in case the options rendered by v-for have changed,
      // it's possible that the value is out-of-sync with the rendered options.
      // detect such cases and filter out values that no longer has a matching
      // option in the DOM.
      const prevOptions = el._vOptions
      const curOptions = (el._vOptions = [].map.call(el.options, getValue))
      if (curOptions.some((o, i) => !looseEqual(o, prevOptions[i]))) {
        // trigger change event if
        // no matching option found for at least one value
        const needReset = el.multiple
          ? binding.value.some(v => hasNoMatchingOption(v, curOptions))
          : binding.value !== binding.oldValue &&
            hasNoMatchingOption(binding.value, curOptions)
        if (needReset) {
          trigger(el, 'change')
        }
      }
    }
  }
}

/**
 * 获取选中的值，
 * 如果是多选，返回一个数组，
 * 否则返回一个字符串，
 * 如果没有选中，返回null，
 * 如果是select标签，返回一个数组，
 * 否则返回一个字符串，如果没有选中，返回null
 * @param el - 元素
 * @param binding - 绑定
 * @param vm - vue实例
 */
function setSelected(el, binding, vm) {
  actuallySetSelected(el, binding, vm)
  /* istanbul ignore if */
  if (isIE || isEdge) {
    setTimeout(() => {
      actuallySetSelected(el, binding, vm)
    }, 0)
  }
}

/**
 * 设置选中的值
 * @param el
 * @param binding
 * @param vm
 */
function actuallySetSelected(el, binding, vm) {
  const value = binding.value // 获取绑定的值
  const isMultiple = el.multiple // 是否是多选
  // 如果是多选，但是绑定的值不是数组，报错
  if (isMultiple && !Array.isArray(value)) {
    __DEV__ &&
      warn(
        `<select multiple v-model="${binding.expression}"> ` +
          `expects an Array value for its binding, but got ${Object.prototype.toString
            .call(value)
            .slice(8, -1)}`,
        vm
      )
    return
  }
  //
  let selected, option // 选中的值，选项
  for (let i = 0, l = el.options.length; i < l; i++) { // 遍历选项
    option = el.options[i] // 获取选项
    // 如果是多选，判断绑定的值是否在选项中，如果在，设置选中，否则取消选中
    if (isMultiple) {
      selected = looseIndexOf(value, getValue(option)) > -1
      if (option.selected !== selected) {
        option.selected = selected
      }
    } else {
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) {
          el.selectedIndex = i
        }
        return
      }
    }
  }
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}

/**
 * 判断是否没有匹配的选项
 * @param value - 值
 * @param options - 选项
 */
function hasNoMatchingOption(value, options) {
  return options.every(o => !looseEqual(o, value))
}

/**
 * 获取选项的值，如果有_value属性，返回_value属性，否则返回value属性
 * @param option - 选项
 */
function getValue(option) {
  return '_value' in option ? option._value : option.value
}

/**
 * 在合成开始时，设置composing属性为true
 * @param e - 事件
 */
function onCompositionStart(e) {
  e.target.composing = true
}

/**
 * 在合成结束时，设置composing属性为false，并触发input事件
 * @param e - 事件
 */
function onCompositionEnd(e) {
  // prevent triggering an input event for no reason
  if (!e.target.composing) return
  e.target.composing = false
  trigger(e.target, 'input')
}

/**
 * 触发事件
 * @param el - 元素
 * @param type - 事件类型
 */
function trigger(el, type) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(type, true, true)
  el.dispatchEvent(e)
}

export default directive
