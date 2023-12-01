import { isServerRendering, noop, warn, def, isFunction } from 'core/util'
import { Ref, RefFlag } from './ref'
import Watcher from 'core/observer/watcher'
import Dep from 'core/observer/dep'
import { currentInstance } from '../currentInstance'
import { ReactiveFlags } from './reactive'
import { TrackOpTypes } from './operations'
import { DebuggerOptions } from '../debug'

declare const ComputedRefSymbol: unique symbol

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
  [ComputedRefSymbol]: true
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: any /* Watcher */
}

export type ComputedGetter<T> = (...args: any[]) => T
export type ComputedSetter<T> = (v: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions
): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
): WritableComputedRef<T>
/**
 * 创建一个计算属性。
 * @param getterOrOptions - getter函数或者选项
 * @param debugOptions - 调试选项
 */
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
) {
  let getter: ComputedGetter<T> // getter函数
  let setter: ComputedSetter<T> // setter函数

  const onlyGetter = isFunction(getterOrOptions) // 是否是函数
  if (onlyGetter) {
    // 如果是函数，只有getter只会报警告
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
          warn('Write operation failed: computed value is readonly')
        }
      : noop
  } else {
    // 如果不是函数，就是选项
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  /**
   * 创建一个计算属性，
   * 如果是服务端渲染，就没有watcher，
   * 如果不是服务端渲染，就创建一个watcher，这个watcher的getter就是getter函数，这个watcher是lazy的，所以不会立即执行
   */
  const watcher = isServerRendering()
    ? null //
    : new Watcher(currentInstance, getter, noop, { lazy: true })
  if (__DEV__ && watcher && debugOptions) {
    // 如果是开发环境，就设置调试选项，这里的调试选项就是在watcher上设置onTrack和onTrigger
    watcher.onTrack = debugOptions.onTrack
    watcher.onTrigger = debugOptions.onTrigger
  }
  const ref = {
    // some libs rely on the presence effect for checking computed refs
    // from normal refs, but the implementation doesn't matter
    effect: watcher,
    get value() {
      if (watcher) {
        // 如果有watcher
        if (watcher.dirty) {
          // 如果watcher是脏的，就执行watcher的evaluate方法
          watcher.evaluate()
        }
        if (Dep.target) {
          // 如果有Dep.target
          if (__DEV__ && Dep.target.onTrack) {
            // 如果是开发环境，就执行Dep.target.onTrack
            Dep.target.onTrack({
              effect: Dep.target,
              target: ref,
              type: TrackOpTypes.GET,
              key: 'value'
            })
          }
          // 执行watcher的depend方法
          watcher.depend()
        }
        // 返回watcher的value
        return watcher.value
      } else {
        // 如果没有watcher，就执行getter函数
        return getter()
      }
    },
    // 设置value的时候，执行setter函数
    set value(newVal) {
      setter(newVal)
    }
  } as any

  def(ref, RefFlag, true)
  def(ref, ReactiveFlags.IS_READONLY, onlyGetter)

  return ref
}
