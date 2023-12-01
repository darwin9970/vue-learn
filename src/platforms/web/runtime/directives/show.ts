import VNode from 'core/vdom/vnode'
import type { VNodeDirective, VNodeWithData } from 'types/vnode'
import { enter, leave } from 'web/runtime/modules/transition'

// recursively search for possible transition defined inside the component root
/**
 * 递归查找组件根节点中可能定义的transition
 * @param vnode - 虚拟节点
 */
function locateNode(vnode: VNode | VNodeWithData): VNodeWithData {
  // @ts-expect-error
  return vnode.componentInstance && (!vnode.data || !vnode.data.transition)
    ? locateNode(vnode.componentInstance._vnode!)
    : vnode
}

export default {
  /**
   * 绑定指令，
   * 当值为true时，显示元素，否则隐藏元素，
   * 同时触发transition动画，如果没有transition动画，则直接显示或隐藏元素
   * @param el - 元素
   * @param value - 值
   * @param vnode - 虚拟节点
   */
  bind(el: any, { value }: VNodeDirective, vnode: VNodeWithData) {
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition
    const originalDisplay = (el.__vOriginalDisplay =
      el.style.display === 'none' ? '' : el.style.display)
    if (value && transition) {
      vnode.data.show = true
      enter(vnode, () => {
        el.style.display = originalDisplay
      })
    } else {
      el.style.display = value ? originalDisplay : 'none'
    }
  },
  /**
   * 更新指令
   * @param el - 元素
   * @param value - 值
   * @param oldValue - 旧值
   * @param vnode - 虚拟节点
   */
  update(el: any, { value, oldValue }: VNodeDirective, vnode: VNodeWithData) {
    /* istanbul ignore if */
    if (!value === !oldValue) return // fix #7506
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition
    // 是否有transition，如果有，则触发transition动画，否则直接显示或隐藏元素
    if (transition) { // 有transition
      vnode.data.show = true
      if (value) {
        enter(vnode, () => {
          el.style.display = el.__vOriginalDisplay
        })
      } else {
        leave(vnode, () => {
          el.style.display = 'none'
        })
      }
    } else {
      el.style.display = value ? el.__vOriginalDisplay : 'none'
    }
  },
  /**
   * 解绑指令
   * @param el - 元素
   * @param binding - 绑定
   * @param vnode - 虚拟节点
   * @param oldVnode - 旧虚拟节点
   * @param isDestroy - 是否销毁
   */
  unbind(
    el: any,
    binding: VNodeDirective,
    vnode: VNodeWithData,
    oldVnode: VNodeWithData,
    isDestroy: boolean
  ) {
    if (!isDestroy) {
      el.style.display = el.__vOriginalDisplay
    }
  }
}
