import { isIE, isIE9, isEdge } from 'core/util/env'

import { extend, isDef, isUndef, isTrue } from 'shared/util'
import type { VNodeWithData } from 'types/vnode'

import {
  isXlink,
  xlinkNS,
  getXlinkProp,
  isBooleanAttr,
  isEnumeratedAttr,
  isFalsyAttrValue,
  convertEnumeratedValue
} from 'web/util/index'

/**
 * 更新属性
 * @param oldVnode - 旧虚拟节点
 * @param vnode - 虚拟节点
 */
function updateAttrs(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  const opts = vnode.componentOptions // 组件选项
  // 如果组件选项中设置了inheritAttrs为false，则不继承属性，直接返回，否则继续执行，继承属性
  if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {
    return
  }
  if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
    return
  }
  let key, cur, old
  const elm = vnode.elm
  const oldAttrs = oldVnode.data.attrs || {}
  let attrs: any = vnode.data.attrs || {}
  // clone observed objects, as the user probably wants to mutate it
  // 克隆观察对象，因为用户可能想要改变它，这里是为了避免改变原始数据，所以克隆一份
  if (isDef(attrs.__ob__) || isTrue(attrs._v_attr_proxy)) {
    attrs = vnode.data.attrs = extend({}, attrs)
  }
  // 将vnode.data.attrs中的属性合并到vnode.data.staticAttrs中
  for (key in attrs) {
    cur = attrs[key]
    old = oldAttrs[key]
    if (old !== cur) {
      setAttr(elm, key, cur, vnode.data.pre)
    }
  }
  // #4391: in IE9, setting type can reset value for input[type=radio]
  // #6666: IE/Edge forces progress value down to 1 before setting a max
  /* istanbul ignore if */
  // 如果是IE或者Edge浏览器，并且属性值发生了变化，则重新设置属性值
  if ((isIE || isEdge) && attrs.value !== oldAttrs.value) {
    setAttr(elm, 'value', attrs.value)
  }
  // 将oldAttrs中的属性从elm中移除
  for (key in oldAttrs) {
    if (isUndef(attrs[key])) {
      if (isXlink(key)) {
        elm.removeAttributeNS(xlinkNS, getXlinkProp(key))
      } else if (!isEnumeratedAttr(key)) {
        elm.removeAttribute(key)
      }
    }
  }
}

/**
 * 设置属性
 * @param el - 元素
 * @param key - 属性名
 * @param value - 属性值
 * @param isInPre - 是否在pre标签中
 */
function setAttr(el: Element, key: string, value: any, isInPre?: any) {
  if (isInPre || el.tagName.indexOf('-') > -1) {
    // pre标签或者是自定义标签，则直接设置属性
    baseSetAttr(el, key, value)
  } else if (isBooleanAttr(key)) {
    // 布尔属性，则根据属性值设置属性
    if (isFalsyAttrValue(value)) {
      // 属性值为false，则移除属性
      el.removeAttribute(key)
    } else {
      // 设置属性
      value = key === 'allowfullscreen' && el.tagName === 'EMBED' ? 'true' : key
      el.setAttribute(key, value)
    }
  } else if (isEnumeratedAttr(key)) {
    // 枚举属性，则根据属性值设置属性
    el.setAttribute(key, convertEnumeratedValue(key, value))
  } else if (isXlink(key)) {
    // xlink属性，则根据属性值设置属性
    if (isFalsyAttrValue(value)) {
      // 属性值为false，则移除属性
      el.removeAttributeNS(xlinkNS, getXlinkProp(key))
    } else {
      // 设置属性
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    // 否则直接设置属性
    baseSetAttr(el, key, value)
  }
}

/**
 * 基本设置属性
 * @param el - 元素
 * @param key - 属性名
 * @param value - 属性值
 */
function baseSetAttr(el, key, value) {
  if (isFalsyAttrValue(value)) {
    // 属性值为false，则移除属性
    el.removeAttribute(key)
  } else {
    if (
      isIE &&
      !isIE9 &&
      el.tagName === 'TEXTAREA' &&
      key === 'placeholder' &&
      value !== '' &&
      !el.__ieph
    ) {
      // 如果是IE浏览器，并且是textarea标签，并且属性名为placeholder，并且属性值不为空，并且没有__ieph属性，则设置__ieph属性，并且添加input事件监听，阻止事件冒泡
      const blocker = e => {
        e.stopImmediatePropagation()
        el.removeEventListener('input', blocker)
      }
      el.addEventListener('input', blocker)
      // $flow-disable-line
      el.__ieph = true /* IE placeholder patched */
    }
    // 设置属性
    el.setAttribute(key, value)
  }
}

export default {
  create: updateAttrs,
  update: updateAttrs
}
