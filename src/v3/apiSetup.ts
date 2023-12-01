import { Component } from 'types/component'
import { PropOptions } from 'types/options'
import { popTarget, pushTarget } from '../core/observer/dep'
import { def, invokeWithErrorHandling, isReserved, warn } from '../core/util'
import VNode from '../core/vdom/vnode'
import {
  bind,
  emptyObject,
  isArray,
  isFunction,
  isObject
} from '../shared/util'
import { currentInstance, setCurrentInstance } from './currentInstance'
import { shallowReactive } from './reactivity/reactive'
import { proxyWithRefUnwrap } from './reactivity/ref'

/**
 * @internal
 */
export interface SetupContext {
  attrs: Record<string, any>
  listeners: Record<string, Function | Function[]>
  slots: Record<string, () => VNode[]>
  emit: (event: string, ...args: any[]) => any
  expose: (exposed: Record<string, any>) => void
}

/**
 * 初始化Setup，
 * 将setup函数的返回值赋值给组件实例的render属性，
 * 如果setup函数返回的是一个函数，则直接赋值给render属性，
 * 如果返回的是一个对象，则将对象的属性赋值给组件实例的_setupState属性，将对象的属性名作为组件实例的属性名，属性值作为组件实例的属性值
 * @param vm - 组件实例
 */
export function initSetup(vm: Component) {
  const options = vm.$options
  const setup = options.setup
  if (setup) {
    const ctx = (vm._setupContext = createSetupContext(vm))

    setCurrentInstance(vm)
    pushTarget()
    const setupResult = invokeWithErrorHandling(
      setup,
      null,
      [vm._props || shallowReactive({}), ctx],
      vm,
      `setup`
    )
    popTarget()
    setCurrentInstance()

    if (isFunction(setupResult)) {
      // render function
      // @ts-ignore
      options.render = setupResult
    } else if (isObject(setupResult)) {
      // bindings
      if (__DEV__ && setupResult instanceof VNode) {
        warn(
          `setup() should not return VNodes directly - ` +
            `return a render function instead.`
        )
      }
      vm._setupState = setupResult
      // __sfc indicates compiled bindings from <script setup>
      if (!setupResult.__sfc) {
        for (const key in setupResult) {
          if (!isReserved(key)) {
            proxyWithRefUnwrap(vm, setupResult, key)
          } else if (__DEV__) {
            warn(`Avoid using variables that start with _ or $ in setup().`)
          }
        }
      } else {
        // exposed for compiled render fn
        const proxy = (vm._setupProxy = {})
        for (const key in setupResult) {
          if (key !== '__sfc') {
            proxyWithRefUnwrap(proxy, setupResult, key)
          }
        }
      }
    } else if (__DEV__ && setupResult !== undefined) {
      warn(
        `setup() should return an object. Received: ${
          setupResult === null ? 'null' : typeof setupResult
        }`
      )
    }
  }
}

/**
 * 创建Setup上下文，
 * 即创建attrs、listeners、slots、emit、expose属性，
 * attrs、listeners、slots属性是只读的，emit、expose属性是函数，
 * emit函数是vm.$emit函数的别名，expose函数用于暴露组件实例的属性
 * @param vm - 组件实例
 */
function createSetupContext(vm: Component): SetupContext {
  let exposeCalled = false
  return {
    get attrs() {
      if (!vm._attrsProxy) {
        const proxy = (vm._attrsProxy = {})
        def(proxy, '_v_attr_proxy', true)
        syncSetupProxy(proxy, vm.$attrs, emptyObject, vm, '$attrs')
      }
      return vm._attrsProxy
    },
    get listeners() {
      if (!vm._listenersProxy) {
        const proxy = (vm._listenersProxy = {})
        syncSetupProxy(proxy, vm.$listeners, emptyObject, vm, '$listeners')
      }
      return vm._listenersProxy
    },
    get slots() {
      return initSlotsProxy(vm)
    },
    emit: bind(vm.$emit, vm) as any,
    expose(exposed?: Record<string, any>) {
      if (__DEV__) {
        if (exposeCalled) {
          warn(`expose() should be called only once per setup().`, vm)
        }
        exposeCalled = true
      }
      if (exposed) {
        Object.keys(exposed).forEach(key =>
          proxyWithRefUnwrap(vm, exposed, key)
        )
      }
    }
  }
}

/**
 * 同步Setup代理，
 * 将from对象的属性赋值给to对象，如果from对象的属性值发生变化，则将to对象的属性值也改为from对象的属性值
 * @param to - 目标对象
 * @param from - 源对象
 * @param prev - 前一个源对象
 * @param instance - 组件实例
 * @param type - 类型
 */
export function syncSetupProxy(
  to: any,
  from: any,
  prev: any,
  instance: Component,
  type: string
) {
  let changed = false
  for (const key in from) {
    if (!(key in to)) {
      changed = true
      defineProxyAttr(to, key, instance, type)
    } else if (from[key] !== prev[key]) {
      changed = true
    }
  }
  for (const key in to) {
    if (!(key in from)) {
      changed = true
      delete to[key]
    }
  }
  return changed
}

/**
 * 定义代理属性，
 * 将instance[type][key]的值赋值给proxy[key]
 * @param proxy - 代理对象
 * @param key - 键
 * @param instance - 组件实例
 * @param type - 类型
 */
function defineProxyAttr(
  proxy: any,
  key: string,
  instance: Component,
  type: string
) {
  Object.defineProperty(proxy, key, {
    enumerable: true,
    configurable: true,
    get() {
      return instance[type][key]
    }
  })
}

/**
 * 初始化插槽代理，
 * 将vm.$scopedSlots赋值给vm._slotsProxy
 * @param vm - 组件实例
 */
function initSlotsProxy(vm: Component) {
  if (!vm._slotsProxy) {
    syncSetupSlots((vm._slotsProxy = {}), vm.$scopedSlots)
  }
  return vm._slotsProxy
}

/**
 * 同步Setup插槽，
 * 将from对象的属性赋值给to对象，如果from对象的属性值发生变化，则将to对象的属性值也改为from对象的属性值
 * @param to - 目标对象
 * @param from - 源对象
 */
export function syncSetupSlots(to: any, from: any) {
  for (const key in from) {
    to[key] = from[key]
  }
  for (const key in to) {
    if (!(key in from)) {
      delete to[key]
    }
  }
}

/**
 * 使用手动类型def，因为公共设置上下文类型依赖于遗留的VNode类型
 */
export function useSlots(): SetupContext['slots'] {
  return getContext().slots
}

/**
 * 使用手动类型def，因为公共设置上下文类型依赖于遗留的VNode类型
 */
export function useAttrs(): SetupContext['attrs'] {
  return getContext().attrs
}

/**
 * Vue2独有
 * 使用手动类型def，因为公共设置上下文类型依赖于遗留VNode类型
 */
export function useListeners(): SetupContext['listeners'] {
  return getContext().listeners
}

/**
 * 获取上下文
 */
function getContext(): SetupContext {
  if (__DEV__ && !currentInstance) {
    warn(`useContext() called without active instance.`)
  }
  const vm = currentInstance!
  return vm._setupContext || (vm._setupContext = createSetupContext(vm))
}

/**
 * 用于合并默认声明的运行时帮助程序。仅由编译后的代码导入。
 * @param raw - 原始值
 * @param defaults - 默认值
 */
export function mergeDefaults(
  raw: string[] | Record<string, PropOptions>,
  defaults: Record<string, any>
): Record<string, PropOptions> {
  const props = isArray(raw)
    ? raw.reduce(
        (normalized, p) => ((normalized[p] = {}), normalized),
        {} as Record<string, PropOptions>
      )
    : raw
  for (const key in defaults) {
    const opt = props[key]
    if (opt) {
      if (isArray(opt) || isFunction(opt)) {
        props[key] = { type: opt, default: defaults[key] }
      } else {
        opt.default = defaults[key]
      }
    } else if (opt === null) {
      props[key] = { default: defaults[key] }
    } else if (__DEV__) {
      warn(`props default key "${key}" has no corresponding declaration.`)
    }
  }
  return props
}
