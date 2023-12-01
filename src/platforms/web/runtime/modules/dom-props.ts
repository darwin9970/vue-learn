import { isDef, isUndef, extend, toNumber, isTrue } from 'shared/util'
import type { VNodeWithData } from 'types/vnode'
import { isSVG } from 'web/util/index'

let svgContainer

/**
 * 更新DOM属性
 * @param oldVnode - 旧虚拟节点
 * @param vnode - 虚拟节点
 */
function updateDOMProps(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.domProps) && isUndef(vnode.data.domProps)) {
    // 如果旧虚拟节点和新虚拟节点都没有domProps，则直接返回
    return
  }
  let key, cur // 当前属性值
  const elm: any = vnode.elm // 元素
  const oldProps = oldVnode.data.domProps || {} // 旧属性
  let props = vnode.data.domProps || {} // 新属性
  if (isDef(props.__ob__) || isTrue(props._v_attr_proxy)) {
    // 如果props是响应式对象，则克隆一份
    props = vnode.data.domProps = extend({}, props)
  }
  // 将旧属性中的属性从elm中移除
  for (key in oldProps) {
    if (!(key in props)) {
      elm[key] = ''
    }
  }
  // 将新属性中的属性添加到elm中
  for (key in props) {
    cur = props[key]
    // ignore children if the node has textContent or innerHTML,
    // as these will throw away existing DOM nodes and cause removal errors
    // on subsequent patches (#3360)
    if (key === 'textContent' || key === 'innerHTML') {
      // 如果是textContent或者innerHTML
      if (vnode.children) vnode.children.length = 0 // 清空子节点
      if (cur === oldProps[key]) continue // 如果新旧属性值相同，就跳过
      if (elm.childNodes.length === 1) {
        // 如果elm只有一个子节点，则将其移除
        elm.removeChild(elm.childNodes[0])
      }
    }

    if (key === 'value' && elm.tagName !== 'PROGRESS') { // 如果是value属性，并且不是progress标签
      // store value as _value as well since
      // non-string values will be stringified
      elm._value = cur // 将当前属性值保存到_value中
      // avoid resetting cursor position when value is the same
      const strCur = isUndef(cur) ? '' : String(cur) // 将当前属性值转换为字符串
      if (shouldUpdateValue(elm, strCur)) {
        // 如果需要更新value属性，则更新
        elm.value = strCur
      }
    } else if ( //，
      key === 'innerHTML' &&
      isSVG(elm.tagName) &&
      isUndef(elm.innerHTML)
    ) {
      /**
       * 如果是innerHTML属性，并且是svg标签，并且innerHTML属性值不存在，则需要特殊处理
       * 因为IE不支持svg的innerHTML属性，需要通过创建一个div，然后将innerHTML属性值赋值给div的innerHTML属性，
       * 然后将div的子节点添加到elm中，然后将elm的子节点移除，最后将div移除，这样就相当于更新了innerHTML属性，这样就可以兼容IE了
       */
      svgContainer = svgContainer || document.createElement('div')
      svgContainer.innerHTML = `<svg>${cur}</svg>`
      const svg = svgContainer.firstChild
      while (elm.firstChild) {
        elm.removeChild(elm.firstChild)
      }
      while (svg.firstChild) {
        elm.appendChild(svg.firstChild)
      }
    } else if (
      // skip the update if old and new VDOM state is the same.
      // `value` is handled separately because the DOM value may be temporarily
      // out of sync with VDOM state due to focus, composition and modifiers.
      // This  #4521 by skipping the unnecessary `checked` update.
      cur !== oldProps[key]
    ) {
      // some property updates can throw
      // e.g. `value` on <progress> w/ non-finite value
      try {
        elm[key] = cur
      } catch (e: any) {}
    }
  }
}

// check platforms/web/util/attrs.js acceptValue
type acceptValueElm = HTMLInputElement | HTMLSelectElement | HTMLOptionElement

/**
 * 是否需要更新value属性，
 * 如果是option标签或者是非聚焦状态下的input标签，
 * 并且当前属性值和elm的value属性值不相等，则需要更新，否则不需要更新
 * @param elm - 元素
 * @param checkVal - 检查的值
 */
function shouldUpdateValue(elm: acceptValueElm, checkVal: string): boolean {
  return (
    //@ts-expect-error
    !elm.composing &&
    (elm.tagName === 'OPTION' ||
      isNotInFocusAndDirty(elm, checkVal) ||
      isDirtyWithModifiers(elm, checkVal))
  )
}

/**
 * 是否是非聚焦状态下的input标签
 * @param elm - 元素
 * @param checkVal - 检查的值
 */
function isNotInFocusAndDirty(elm: acceptValueElm, checkVal: string): boolean {
  // return true when textbox (.number and .trim) loses focus and its value is
  // not equal to the updated value
  let notInFocus = true
  // #6157
  // work around IE bug when accessing document.activeElement in an iframe
  try {
    notInFocus = document.activeElement !== elm // 是否是非聚焦状态
  } catch (e: any) {}
  return notInFocus && elm.value !== checkVal // 如果是非聚焦状态，并且当前属性值和elm的value属性值不相等，则返回true，否则返回false
}

/**
 * 是否需要更新value属性
 * @param elm - 元素
 * @param newVal - 新属性值
 */
function isDirtyWithModifiers(elm: any, newVal: string): boolean {
  const value = elm.value
  const modifiers = elm._vModifiers // 修饰符
  if (isDef(modifiers)) {
    // 如果有修饰符
    if (modifiers.number) {
      // 如果有number修饰符
      return toNumber(value) !== toNumber(newVal)
    }
    if (modifiers.trim) {
      // 如果有trim修饰符
      return value.trim() !== newVal.trim()
    }
  }
  return value !== newVal // 如果没有修饰符，则直接比较value属性值和当前属性值是否相等
}

export default {
  create: updateDOMProps,
  update: updateDOMProps
}
