import { _Set as Set, isObject, isArray } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'
import { isRef } from '../../v3'

const seenObjects = new Set() // 用于存储已经遍历过的对象

/**
 * 递归遍历一个对象，以唤起所有转换的getter，以便对象内的每个嵌套属性都被收集为“深度”依赖项。
 * @param val - 需要遍历的对象
 */
export function traverse(val: any) {
  _traverse(val, seenObjects) // 递归遍历val
  seenObjects.clear() // 清空seenObjects
  return val // 返回val
}

/**
 * 递归遍历val，将val的所有属性都添加到seen中
 * @param val - 需要遍历的对象
 * @param seen - 用于存储已经遍历过的对象
 */
function _traverse(val: any, seen: SimpleSet) {
  let i, keys
  const isA = isArray(val) // 判断val是否是数组
  // 如果val不是数组，并且不是对象，或者val的__v_skip属性为true，或者val是冻结的，或者val是VNode的实例，则直接返回
  if (
    (!isA && !isObject(val)) ||
    val.__v_skip /* ReactiveFlags.SKIP */ ||
    Object.isFrozen(val) ||
    val instanceof VNode
  ) {
    return
  }
  // 如果val有__ob__属性，则将val添加到seen中
  if (val.__ob__) {
    const depId = val.__ob__.dep.id // 获取val的依赖id
    // 如果seen中已经有depId，则直接返回
    if (seen.has(depId)) {
      return
    }
    seen.add(depId) // 将depId添加到seen中
  }
  // 如果val是数组，则遍历val的每一项，然后递归遍历每一项，直到每一项都被遍历过
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else if (isRef(val)) {
    _traverse(val.value, seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
