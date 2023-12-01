import { isFunction, warn } from 'core/util'
import { currentInstance } from './currentInstance'
import type { Component } from 'types/component'

export interface InjectionKey<T> extends Symbol {}

/**
 * 为当前实例提供一个值。
 * @param key - 键
 * @param value - 值
 */
export function provide<T>(key: InjectionKey<T> | string | number, value: T) {
  if (!currentInstance) {
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`)
    }
  } else {
    // TS doesn't allow symbol as index type
    resolveProvided(currentInstance)[key as string] = value
  }
}

/**
 * 解析提供的值
 * @param vm
 */
export function resolveProvided(vm: Component): Record<string, any> {
  /**
   * 默认情况下，实例继承其父对象的provides对象
   * 但当它需要提供自己的价值时，它会创建
   * own提供对象使用parent提供对象作为原型。
   * 在“injection”中，我们可以简单地从direct中查找注射剂
   * parent并让原型链来完成工作。
   */
  const existing = vm._provided
  const parentProvides = vm.$parent && vm.$parent._provided
  if (parentProvides === existing) {
    return (vm._provided = Object.create(parentProvides))
  } else {
    return existing
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false
): T
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true
): T
/**
 * 从祖先组件的provides对象中检索值。
 * @param key - 键
 * @param defaultValue - 默认值
 * @param treatDefaultAsFactory - 是否将默认值视为工厂函数
 */
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false
) {
  // fallback to `currentRenderingInstance` so that this can be called in
  // a functional component
  const instance = currentInstance
  if (instance) {
    // #2400
    // to support `app.use` plugins,
    // fallback to appContext's `provides` if the instance is at root
    const provides = instance.$parent && instance.$parent._provided

    if (provides && (key as string | symbol) in provides) {
      // TS doesn't allow symbol as index type
      return provides[key as string]
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance)
        : defaultValue
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}
