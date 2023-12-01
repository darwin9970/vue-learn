import Watcher from 'core/observer/watcher'
import {warn} from 'core/util'

export let activeEffectScope: EffectScope | undefined

export class EffectScope {
  active = true // 是否激活
  effects: Watcher[] = [] // 副作用数组
  cleanups: (() => void)[] = [] // 清理函数数组
  parent: EffectScope | undefined // 父scope
  scopes: EffectScope[] | undefined // 子scope数组
  _vm?: boolean // 是否是组件根scope
  private index: number | undefined // 子scope在父scope的scopes数组中的索引

  /**
   * 创建一个scope
   * @param detached
   */
  constructor(public detached = false) {
    this.parent = activeEffectScope
    if (!detached && activeEffectScope) {
      // 如果不是detached，且activeEffectScope存在，将当前scope添加到activeEffectScope的scopes数组中
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1
    }
  }

  /**
   * 执行函数
   * @param fn - 函数
   */
  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  /**
   * 将activeEffectScope设置为当前scope
   */
  on() {
    activeEffectScope = this //
  }

  /**
   * 将activeEffectScope设置为parent
   */
  off() {
    activeEffectScope = this.parent //
  }

  /**
   * 停止scope
   * @param fromParent
   */
  stop(fromParent?: boolean) {
    if (this.active) {
      // 如果是激活的，就停止
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].teardown() // 停止副作用
      }
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]() // 执行清理函数
      }
      if (this.scopes) {
        // 停止子scope
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true) // 递归停止子scope
        }
      }
      if (!this.detached && this.parent && !fromParent) {
        // 如果不是detached，且有parent，且不是从parent停止的，就从parent的scopes数组中删除当前scope
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
      this.active = false
    }
  }
}

/**
 * 创建一个副作用scope
 * @param detached - 是否是detached
 */
export function effectScope(detached?: boolean) {
  return new EffectScope(detached)
}

/**
 * 将effect添加到scope的effects数组中
 * @param effect - 副作用
 * @param scope - scope
 */
export function recordEffectScope(
  effect: Watcher,
  scope: EffectScope | undefined = activeEffectScope
) {
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

/**
 * 将scope设置为当前scope
 */
export function getCurrentScope() {
  return activeEffectScope
}

/**
 * 如果有activeEffectScope，就将fn添加到activeEffectScope的cleanups数组中，否则报警告
 * @param fn - 函数
 */
export function onScopeDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
      ` to be associated with.`
    )
  }
}
