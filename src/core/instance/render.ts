import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive,
  isArray
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'
import type { Component } from 'types/component'
import { setCurrentInstance } from 'v3/currentInstance'
import { syncSetupSlots } from 'v3/apiSetup'

/**
 * 初始化渲染
 * @param vm - 组件实例
 */
export function initRender(vm: Component) {
  vm._vnode = null  // 子树的根
  vm._staticTrees = null  // v-once缓存的树
  const options = vm.$options // 获取vm.$options
  const parentVnode = (vm.$vnode = options._parentVnode!) // 获取vm.$vnode
  const renderContext = parentVnode && (parentVnode.context as Component) // 获取vm.$vnode的上下文
  vm.$slots = resolveSlots(options._renderChildren, renderContext) // 解析插槽
  vm.$scopedSlots = parentVnode // 作用域插槽
    ? normalizeScopedSlots(
        vm.$parent!,
        parentVnode.data!.scopedSlots,
        vm.$slots
      )
    : emptyObject
  /**
   * 将createElement fn绑定到此实例
   * 以便我们在其中获得正确的渲染上下文。
   * 参数顺序：标签、数据、子节点、规范化类型、总是规范化
   * 内部版本由从模板编译的渲染函数使用
   * @param a - 标签
   * @param b - 数据
   * @param c - 子节点
   * @param d - 规范化类型
   */
  // @ts-expect-error
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  /**
   * normalization总是应用于公共版本，用于用户编写的渲染函数。
   * @param a - 标签
   * @param b - 数据
   * @param c - 子节点
   * @param d - 规范化类型
   */
  // @ts-expect-error
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  /**
   * $attrs和$listeners暴露出来，以便更容易创建HOC。
   */
  const parentData = parentVnode && parentVnode.data

  /* istanbul ignore else */
  if (__DEV__) {
    defineReactive(
      vm, // 组件实例
      '$attrs', // 属性
      (parentData && parentData.attrs) || emptyObject, // 父节点的属性
      () => { // 回调函数
        !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm) // 如果不是更新子组件，则警告
      },
      true
    )
    defineReactive(
      vm, // 组件实例
      '$listeners', // 监听器
      options._parentListeners || emptyObject, // 父节点的监听器
      () => { // 回调函数
        !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm) // 如果不是更新子组件，则警告
      },
      true
    )
  } else {
    defineReactive(
      vm, // 组件实例
      '$attrs', // 属性
      (parentData && parentData.attrs) || emptyObject, // 父节点的属性
      null, // 回调函数
      true // 是否深度监听
    )
    defineReactive(
      vm, // 组件实例
      '$listeners', // 监听器
      options._parentListeners || emptyObject, // 父节点的监听器
      null, // 回调函数
      true // 是否深度监听
    )
  }
}

export let currentRenderingInstance: Component | null = null // 当前渲染实例

// for testing only
/**
 * 设置当前渲染实例
 * @param vm - 组件实例
 */
export function setCurrentRenderingInstance(vm: Component) {
  currentRenderingInstance = vm
}

/**
 * 混入render
 * @param Vue - 构造函数
 */
export function renderMixin(Vue: typeof Component) {
  // install runtime convenience helpers
  installRenderHelpers(Vue.prototype)

  Vue.prototype.$nextTick = function (fn: (...args: any[]) => any) {
    return nextTick(fn, this)
  }

  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options

    if (_parentVnode && vm._isMounted) {
      vm.$scopedSlots = normalizeScopedSlots(
        vm.$parent!,
        _parentVnode.data!.scopedSlots,
        vm.$slots,
        vm.$scopedSlots
      )
      if (vm._slotsProxy) {
        syncSetupSlots(vm._slotsProxy, vm.$scopedSlots)
      }
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode!
    // render self
    let vnode
    try {
      // There's no need to maintain a stack because all render fns are called
      // separately from one another. Nested component's render fns are called
      // when parent component is patched.
      setCurrentInstance(vm)
      currentRenderingInstance = vm
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e: any) {
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (__DEV__ && vm.$options.renderError) {
        try {
          vnode = vm.$options.renderError.call(
            vm._renderProxy,
            vm.$createElement,
            e
          )
        } catch (e: any) {
          handleError(e, vm, `renderError`)
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    } finally {
      currentRenderingInstance = null
      setCurrentInstance()
    }
    // if the returned array contains only a single node, allow it
    if (isArray(vnode) && vnode.length === 1) {
      vnode = vnode[0]
    }
    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
      if (__DEV__ && isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
            'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    vnode.parent = _parentVnode
    return vnode
  }
}
