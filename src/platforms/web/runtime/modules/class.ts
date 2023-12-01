import { isDef, isUndef } from 'shared/util'
import type { VNodeData } from 'types/vnode'

import { concat, stringifyClass, genClassForVnode } from 'web/util/index'

/**
 * 更新class
 * @param oldVnode - 旧虚拟节点
 * @param vnode - 虚拟节点
 */
function updateClass(oldVnode: any, vnode: any) {
  const el = vnode.elm
  const data: VNodeData = vnode.data
  const oldData: VNodeData = oldVnode.data
  if (
    isUndef(data.staticClass) &&
    isUndef(data.class) &&
    (isUndef(oldData) ||
      (isUndef(oldData.staticClass) && isUndef(oldData.class)))
  ) {
    // 如果新旧虚拟节点都没有class，则直接返回
    return
  }

  let cls = genClassForVnode(vnode) // 生成虚拟节点的class

  // handle transition classes
  const transitionClass = el._transitionClasses
  if (isDef(transitionClass)) {
    // 如果有transitionClass，则将其添加到cls中
    cls = concat(cls, stringifyClass(transitionClass))
  }

  // set the class
  if (cls !== el._prevClass) {
    // 如果class发生了变化，则更新class
    el.setAttribute('class', cls)
    el._prevClass = cls
  }
}

export default {
  create: updateClass,
  update: updateClass
}
