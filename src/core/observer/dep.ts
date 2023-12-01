import config from '../config'
import { DebuggerOptions, DebuggerEventExtraInfo } from 'v3'

let uid = 0 // 依赖的唯一标识符

/**
 * 清理依赖
 */
const pendingCleanupDeps: Dep[] = [] // 待清理的依赖
export const cleanupDeps = () => {
  for (let i = 0; i < pendingCleanupDeps.length; i++) {
    const dep = pendingCleanupDeps[i]
    dep.subs = dep.subs.filter(s => s)
    dep._pending = false
  }
  pendingCleanupDeps.length = 0
}

/**
 * @internal
 */
export interface DepTarget extends DebuggerOptions {
  id: number
  addDep(dep: Dep): void
  update(): void
}

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * @internal
 */
export default class Dep {
  static target?: DepTarget | null // 当前正在计算的目标依赖项
  id: number // 依赖的唯一标识符
  subs: Array<DepTarget | null> // 依赖的目标依赖项
  // pending subs cleanup
  _pending = false // 是否待清理

  /**
   * 创建一个依赖
   */
  constructor() {
    this.id = uid++ // 依赖的唯一标识符
    this.subs = [] // 依赖的目标依赖项
  }

  /**
   * 添加依赖
   * @param sub - 依赖的目标依赖项
   */
  addSub(sub: DepTarget) {
    this.subs.push(sub) // 将依赖添加到依赖的目标依赖项中
  }

  /**
   * 移除依赖
   * @param sub - 依赖的目标依赖项
   */
  removeSub(sub: DepTarget) {
    // #12696 deps with massive amount of subscribers are extremely slow to
    // clean up in Chromium
    // to workaround this, we unset the sub for now, and clear them on
    // next scheduler flush.
    this.subs[this.subs.indexOf(sub)] = null // 将依赖从依赖的目标依赖项中移除
    // 如果不是待清理，则将依赖添加到待清理的依赖中
    if (!this._pending) {
      this._pending = true
      pendingCleanupDeps.push(this)
    }
  }

  /**
   * 依赖收集
   * @param info - 依赖收集的信息
   */
  depend(info?: DebuggerEventExtraInfo) {
    // 如果存在正在计算的目标依赖项，将依赖添加到正在计算的目标依赖项中
    if (Dep.target) {
      Dep.target.addDep(this)
      //
      if (__DEV__ && info && Dep.target.onTrack) {
        // 依赖收集
        Dep.target.onTrack({
          effect: Dep.target,
          ...info
        })
      }
    }
  }

  /**
   * 通知依赖更新
   * @param info - 依赖更新的信息
   */
  notify(info?: DebuggerEventExtraInfo) {
    // stabilize the subscriber list first
    const subs = this.subs.filter(s => s) as DepTarget[] // 过滤掉依赖的目标依赖项中的null
    // 如果不是异步更新，将依赖的目标依赖项按照id排序
    if (__DEV__ && !config.async) {
      subs.sort((a, b) => a.id - b.id)
    }
    // 遍历依赖的目标依赖项，更新依赖
    for (let i = 0, l = subs.length; i < l; i++) {
      const sub = subs[i]
      // 如果是开发环境，则触发依赖的目标依赖项的onTrigger方法
      if (__DEV__ && info) {
        sub.onTrigger &&
          sub.onTrigger({
            effect: subs[i],
            ...info
          })
      }
      sub.update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null // 当前正在计算的目标依赖项
const targetStack: Array<DepTarget | null | undefined> = []

/**
 * 将目标依赖项添加到targetStack中
 * @param target - 目标依赖项
 */
export function pushTarget(target?: DepTarget | null) {
  targetStack.push(target)
  Dep.target = target
}

/**
 * 将目标依赖项从targetStack中移除
 */
export function popTarget() {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
