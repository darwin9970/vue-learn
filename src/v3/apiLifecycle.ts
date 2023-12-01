import { DebuggerEvent } from './debug'
import { Component } from 'types/component'
import { mergeLifecycleHook, warn } from '../core/util'
import { currentInstance } from './currentInstance'

/**
 * 创建生命周期
 * @param hookName - 钩子名称
 */
function createLifeCycle<T extends (...args: any[]) => any = () => void>(
  hookName: string
) {
  return (fn: T, target: any = currentInstance) => {
    if (!target) {
      __DEV__ &&
        warn(
          `${formatName(
            hookName
          )} is called when there is no active component instance to be ` +
            `associated with. ` +
            `Lifecycle injection APIs can only be used during execution of setup().`
        )
      return
    }
    return injectHook(target, hookName, fn)
  }
}

/**
 * 格式化名称
 * @param name - 名称
 */
function formatName(name: string) {
  if (name === 'beforeDestroy') {
    name = 'beforeUnmount'
  } else if (name === 'destroyed') {
    name = 'unmounted'
  }
  return `on${name[0].toUpperCase() + name.slice(1)}`
}

/**
 * 注入钩子
 * @param instance - 组件实例
 * @param hookName - 钩子名称
 * @param fn - 函数
 */
function injectHook(instance: Component, hookName: string, fn: () => void) {
  const options = instance.$options
  options[hookName] = mergeLifecycleHook(options[hookName], fn)
}

export const onBeforeMount = createLifeCycle('beforeMount') // 在挂载之前
export const onMounted = createLifeCycle('mounted') // 挂载
export const onBeforeUpdate = createLifeCycle('beforeUpdate') // 在更新之前
export const onUpdated = createLifeCycle('updated') // 更新
export const onBeforeUnmount = createLifeCycle('beforeDestroy') // 在销毁之前
export const onUnmounted = createLifeCycle('destroyed') // 销毁
export const onActivated = createLifeCycle('activated') // 激活
export const onDeactivated = createLifeCycle('deactivated') // 停用
export const onServerPrefetch = createLifeCycle('serverPrefetch') // 服务器预取

export const onRenderTracked =
  createLifeCycle<(e: DebuggerEvent) => any>('renderTracked') // 渲染跟踪
export const onRenderTriggered =
  createLifeCycle<(e: DebuggerEvent) => any>('renderTriggered') // 渲染触发

export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: any,
  info: string
) => boolean | void

const injectErrorCapturedHook =
  createLifeCycle<ErrorCapturedHook<any>>('errorCaptured')

export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: any = currentInstance
) {
  injectErrorCapturedHook(hook, target)
}
