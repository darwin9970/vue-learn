import VNode, { cloneVNode } from './vnode'
import { createElement } from './create-element'
import { resolveInject } from '../instance/inject'
import { normalizeChildren } from '../vdom/helpers/normalize-children'
import { resolveSlots } from '../instance/render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import { installRenderHelpers } from '../instance/render-helpers/index'

import {
  isDef,
  isTrue,
  hasOwn,
  isArray,
  camelize,
  emptyObject,
  validateProp
} from '../util/index'
import type { Component } from 'types/component'
import type { VNodeData } from 'types/vnode'

export function FunctionalRenderContext(
  data: VNodeData, // 节点数据
  props: Object, // 组件的props
  children: Array<VNode> | undefined, // 子节点
  parent: Component, // 组件的父组件实例
  Ctor: typeof Component // 组件构造函数
) {
  const options = Ctor.options // 组件的配置项
  // 确保函数式组件中的createElement函数
  // 确保函数式组件中的createElement函数获得唯一的上下文 - 这对于正确的命名插槽检查是必要的
  let contextVm // 组件的父组件实例
  if (hasOwn(parent, '_uid')) {
    // 父组件实例有_uid属性，说明父组件实例是一个组件实例
    contextVm = Object.create(parent)
    contextVm._original = parent
  } else {
    // 父组件实例没有_uid属性，说明父组件实例是一个函数式组件实例
    // 这里的parent是一个函数式组件实例，所以这里的parent._original是一个组件实例
    // 这里的parent._original._uid是一个数字，这个数字是父组件实例的_uid
    contextVm = parent
    // @ts-ignore
    parent = parent._original
  }
  const isCompiled = isTrue(options._compiled) // 组件是否是编译过的
  const needNormalization = !isCompiled // 组件是否需要标准化

  this.data = data
  this.props = props
  this.children = children
  this.parent = parent
  this.listeners = data.on || emptyObject
  this.injections = resolveInject(options.inject, parent)
  this.slots = () => {
    if (!this.$slots) {
      normalizeScopedSlots(
        parent,
        data.scopedSlots,
        (this.$slots = resolveSlots(children, parent))
      )
    }
    return this.$slots
  }

  Object.defineProperty(this, 'scopedSlots', {
    enumerable: true,
    get() {
      return normalizeScopedSlots(parent, data.scopedSlots, this.slots())
    }
  } as any)

  // 支持编译过的函数式模板
  if (isCompiled) {
    // 组件是否是编译过的
    this.$options = options // 组件的配置项
    this.$slots = this.slots() // 插槽
    this.$scopedSlots = normalizeScopedSlots(
      parent,
      data.scopedSlots,
      this.$slots
    ) // 作用域插槽
  }
  /**
   * 组件是否有作用域id，
   * 如果有，就给函数式组件的createElement函数添加作用域id，
   * 这样函数式组件的子组件就会继承函数式组件的作用域id，这样就可以正确的命名插槽，
   * 否则函数式组件的子组件就无法正确的命名插槽，因为函数式组件的子组件的作用域id是undefined
   * @param a - 标签名或组件构造函数或配置项
   * @param b - 节点数据或子节点
   * @param c - 子节点
   * @param d - 标记是否需要标准化子节点
   */
  if (options._scopeId) {
    this._c = (a, b, c, d) => {
      const vnode = createElement(contextVm, a, b, c, d, needNormalization)
      if (vnode && !isArray(vnode)) {
        vnode.fnScopeId = options._scopeId
        vnode.fnContext = parent
      }
      return vnode
    }
  } else {
    this._c = (a, b, c, d) =>
      createElement(contextVm, a, b, c, d, needNormalization)
  }
}

installRenderHelpers(FunctionalRenderContext.prototype)

/**
 * 创建函数式组件
 * @param Ctor - 组件构造函数
 * @param propsData - 组件的props
 * @param data - 组件的data
 * @param contextVm - 组件的父组件实例
 * @param children - 组件的子节点
 */
export function createFunctionalComponent(
  Ctor: typeof Component,
  propsData: Object | undefined,
  data: VNodeData,
  contextVm: Component,
  children?: Array<VNode>
): VNode | Array<VNode> | void {
  const options = Ctor.options
  const props = {}
  const propOptions = options.props
  if (isDef(propOptions)) {
    for (const key in propOptions) {
      props[key] = validateProp(key, propOptions, propsData || emptyObject)
    }
  } else {
    if (isDef(data.attrs)) mergeProps(props, data.attrs)
    if (isDef(data.props)) mergeProps(props, data.props)
  }

  const renderContext = new FunctionalRenderContext(
    data,
    props,
    children,
    contextVm,
    Ctor
  )

  const vnode = options.render.call(null, renderContext._c, renderContext)

  if (vnode instanceof VNode) {
    return cloneAndMarkFunctionalResult(
      vnode,
      data,
      renderContext.parent,
      options,
      renderContext
    )
  } else if (isArray(vnode)) {
    const vnodes = normalizeChildren(vnode) || []
    const res = new Array(vnodes.length)
    for (let i = 0; i < vnodes.length; i++) {
      res[i] = cloneAndMarkFunctionalResult(
        vnodes[i],
        data,
        renderContext.parent,
        options,
        renderContext
      )
    }
    return res
  }
}

/**
 * 克隆并标记函数式组件的结果
 * @param vnode - VNode
 * @param data - VNodeData
 * @param contextVm - 组件的父组件实例
 * @param options - 组件的配置项
 * @param renderContext - 渲染上下文
 */
function cloneAndMarkFunctionalResult(
  vnode,
  data,
  contextVm,
  options,
  renderContext
) {
  // #7817 clone node before setting fnContext, otherwise if the node is reused
  // (e.g. it was from a cached normal slot) the fnContext causes named slots
  // that should not be matched to match.
  const clone = cloneVNode(vnode)
  clone.fnContext = contextVm
  clone.fnOptions = options
  if (__DEV__) {
    ;(clone.devtoolsMeta = clone.devtoolsMeta || ({} as any)).renderContext =
      renderContext
  }
  if (data.slot) {
    ;(clone.data || (clone.data = {})).slot = data.slot
  }
  return clone
}

function mergeProps(to, from) {
  for (const key in from) {
    to[camelize(key)] = from[key]
  }
}
