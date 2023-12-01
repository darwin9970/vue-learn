import Watcher from 'core/observer/watcher'
import { noop } from 'shared/util'
import { currentInstance } from '../currentInstance'

// export type EffectScheduler = (...args: any[]) => any

/**
 * @internal since we are not exposing this in Vue 2, it's used only for
 * internal testing.
 */
/**
 * 创建一个副作用，
 * 副作用会在组件渲染时执行，
 * 如果传入了scheduler，副作用会在scheduler执行时执行
 * @param fn - 副作用函数
 * @param scheduler - 调度器
 */
export function effect(fn: () => any, scheduler?: (cb: any) => void) {
  const watcher = new Watcher(currentInstance, fn, noop, {
    sync: true
  })
  if (scheduler) {
    watcher.update = () => {
      scheduler(() => watcher.run())
    }
  }
}
