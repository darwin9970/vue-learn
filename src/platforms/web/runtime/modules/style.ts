import { getStyle, normalizeStyleBinding } from 'web/util/style'
import {
  cached,
  camelize,
  extend,
  isDef,
  isUndef,
  hyphenate
} from 'shared/util'
import type { VNodeWithData } from 'types/vnode'

const cssVarRE = /^--/
const importantRE = /\s*!important$/
/**
 * 设置元素的style属性
 * @param el - 元素
 * @param name - 属性名
 * @param val - 属性值
 */
const setProp = (el, name, val) => {
  /* istanbul ignore if */
  if (cssVarRE.test(name)) {
    // 如果是css变量，直接设置css变量
    el.style.setProperty(name, val)
  } else if (importantRE.test(val)) {
    // 如果是important，设置important
    el.style.setProperty(
      hyphenate(name),
      val.replace(importantRE, ''),
      'important'
    )
  } else { // 否则直接设置
    const normalizedName = normalize(name)
    if (Array.isArray(val)) {
      // 如果是数组，说明是autoprefixer生成的，需要遍历设置，浏览器会自动识别，只设置支持的，不支持的不设置
      for (let i = 0, len = val.length; i < len; i++) {
        el.style[normalizedName!] = val[i]
      }
    } else {
      // 否则直接设置
      el.style[normalizedName!] = val
    }
  }
}

const vendorNames = ['Webkit', 'Moz', 'ms']

let emptyStyle
// 缓存，提高性能，返回一个函数，函数的参数是属性名，返回属性名，如果属性名不支持，返回支持的属性名，如果都不支持，返回原属性名
const normalize = cached(function (prop) {
  emptyStyle = emptyStyle || document.createElement('div').style
  prop = camelize(prop)
  if (prop !== 'filter' && prop in emptyStyle) {
    return prop
  }
  const capName = prop.charAt(0).toUpperCase() + prop.slice(1)
  for (let i = 0; i < vendorNames.length; i++) {
    const name = vendorNames[i] + capName
    if (name in emptyStyle) {
      return name
    }
  }
})

/**
 * 更新style
 * @param oldVnode - 旧vnode
 * @param vnode - 新vnode
 */
function updateStyle(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  const data = vnode.data
  const oldData = oldVnode.data

  if (
    isUndef(data.staticStyle) &&
    isUndef(data.style) &&
    isUndef(oldData.staticStyle) &&
    isUndef(oldData.style)
  ) {
    // 如果都没有style，直接返回
    return
  }

  let cur, name
  const el: any = vnode.elm // 元素
  const oldStaticStyle: any = oldData.staticStyle // 旧静态style
  const oldStyleBinding: any = oldData.normalizedStyle || oldData.style || {} // 旧绑定style

  // if static style exists, stylebinding already merged into it when doing normalizeStyleData
  const oldStyle = oldStaticStyle || oldStyleBinding // 旧style

  const style = normalizeStyleBinding(vnode.data.style) || {} // 新style

  // store normalized style under a different key for next diff
  // make sure to clone it if it's reactive, since the user likely wants
  // to mutate it.
  vnode.data.normalizedStyle = isDef(style.__ob__) ? extend({}, style) : style // 缓存新style

  const newStyle = getStyle(vnode, true) // 获取新style
  // 遍历旧style，如果新style没有，设置为空
  for (name in oldStyle) {
    if (isUndef(newStyle[name])) {
      setProp(el, name, '')
    }
  }
  // 遍历新style，如果旧style没有，设置新style，如果旧style有，但是值不同，设置新style，如果旧style有，值相同，不设置
  for (name in newStyle) {
    cur = newStyle[name]
    if (cur !== oldStyle[name]) {
      // ie9 setting to null has no effect, must use empty string
      setProp(el, name, cur == null ? '' : cur)
    }
  }
}

export default {
  create: updateStyle,
  update: updateStyle
}
