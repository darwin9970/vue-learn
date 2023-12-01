import { observe, Observer } from 'core/observer'
import {
  def,
  isArray,
  isPrimitive,
  warn,
  toRawType,
  isServerRendering
} from 'core/util'
import type { Ref, UnwrapRefSimple, RawSymbol } from './ref'

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}

export interface Target {
  __ob__?: Observer
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}

// only unwrap nested ref
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

/**
 * 创建一个响应式对象。
 * @param target - 目标对象
 */
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
  makeReactive(target, false)
  return target
}

export declare const ShallowReactiveMarker: unique symbol

export type ShallowReactive<T> = T & { [ShallowReactiveMarker]?: true }

/**
 * 创建一个浅响应式对象，只有根属性是响应式的
 * @param target - 目标对象
 */
export function shallowReactive<T extends object>(
  target: T
): ShallowReactive<T> {
  makeReactive(target, true)
  def(target, ReactiveFlags.IS_SHALLOW, true)
  return target
}

/**
 * 创建一个只读的响应式对象
 * @param target
 * @param shallow
 */
function makeReactive(target: any, shallow: boolean) {
  // if trying to observe a readonly proxy, return the readonly version.
  if (!isReadonly(target)) {
    // 如果不是只读的
    if (__DEV__) {
      // 如果是开发环境
      if (isArray(target)) {
        // 如果是数组，报警告
        warn(
          `Avoid using Array as root value for ${
            shallow ? `shallowReactive()` : `reactive()`
          } as it cannot be tracked in watch() or watchEffect(). Use ${
            shallow ? `shallowRef()` : `ref()`
          } instead. This is a Vue-2-only limitation.`
        )
      }
      const existingOb = target && target.__ob__ // 获取target的__ob__属性

      if (existingOb && existingOb.shallow !== shallow) {
        // 如果已经存在__ob__属性，且shallow不等于当前shallow，报警告
        warn(
          `Target is already a ${
            existingOb.shallow ? `` : `non-`
          }shallow reactive object, and cannot be converted to ${
            shallow ? `` : `non-`
          }shallow.`
        )
      }
    }
    // 如果没有__ob__属性，创建一个Observer对象
    const ob = observe(
      target,
      shallow,
      isServerRendering() /* ssr mock reactivity */
    )

    if (__DEV__ && !ob) {
      // 如果是开发环境
      if (target == null || isPrimitive(target)) {
        // 如果target是null或者是原始值，报警告
        warn(`value cannot be made reactive: ${String(target)}`)
      }
      if (isCollectionType(target)) {
        // 如果是集合类型，报警告
        warn(
          `Vue 2 does not support reactive collection types such as Map or Set.`
        )
      }
    }
  }
}

/**
 * 判断是否是响应式对象
 * @param value
 */
export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target).__ob__)
}

/**
 * 判断是否是浅响应式
 * @param value
 */
export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target).__v_isShallow)
}

/**
 * 判断是否是只读的
 * @param value
 */
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target).__v_isReadonly)
}

/**
 * 判断是否是响应式对象或者只读的响应式对象
 * @param value
 */
export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

/**
 * 将对象标记为只读的，不可修改
 * @param observed
 */
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

/**
 * 将对象标记为只读的，不可修改
 * @param value
 */
export function markRaw<T extends object>(
  value: T
): T & { [RawSymbol]?: true } {
  // non-extensible objects won't be observed anyway
  if (Object.isExtensible(value)) {
    def(value, ReactiveFlags.SKIP, true)
  }
  return value
}

/**
 * 判断是否是集合类型
 * @param value
 */
export function isCollectionType(value: unknown): boolean {
  const type = toRawType(value)
  return (
    type === 'Map' || type === 'WeakMap' || type === 'Set' || type === 'WeakSet'
  )
}
