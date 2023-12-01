import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop,
  isFunction
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget, DepTarget } from './dep'
import { DebuggerEvent, DebuggerOptions } from 'v3/debug'

import type { SimpleSet } from '../util/index'
import type { Component } from 'types/component'
import { activeEffectScope, recordEffectScope } from 'v3/reactivity/effectScope'

let uid = 0 // 依赖的唯一标识符

/**
 * @internal
 */
export interface WatcherOptions extends DebuggerOptions {
  deep?: boolean
  user?: boolean
  lazy?: boolean
  sync?: boolean
  before?: Function
}

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * @internal
 */
export default class Watcher implements DepTarget {
  vm?: Component | null
  expression: string
  cb: Function
  id: number
  deep: boolean
  user: boolean
  lazy: boolean
  sync: boolean
  dirty: boolean
  active: boolean
  deps: Array<Dep>
  newDeps: Array<Dep>
  depIds: SimpleSet
  newDepIds: SimpleSet
  before?: Function
  onStop?: Function
  noRecurse?: boolean
  getter: Function
  value: any
  post: boolean

  // dev only
  onTrack?: ((event: DebuggerEvent) => void) | undefined
  onTrigger?: ((event: DebuggerEvent) => void) | undefined

  /**
   * 观察者解析表达式、收集依赖关系，并在表达式的值更改时触发回调。
   * @param vm - 组件实例
   * @param expOrFn - 表达式或函数
   * @param cb - 回调函数
   * @param options - Watcher的配置项
   * @param isRenderWatcher - 是否是渲染Watcher
   */
  constructor(
    vm: Component | null, // 组件实例
    expOrFn: string | (() => any), // 表达式或函数
    cb: Function, // 回调函数
    options?: WatcherOptions | null, // Watcher的配置项
    isRenderWatcher?: boolean // 是否是渲染Watcher
  ) {
    // 组件实例，如果是渲染Watcher，则将Watcher添加到组件实例的_watcher中，否则不添加
    recordEffectScope(
      this, // 当前Watcher
      activeEffectScope && !activeEffectScope._vm // 如果activeEffectScope是手动创建的（不是组件作用域），则优先使用它
        ? activeEffectScope // activeEffectScope
        : vm // 组件实例
        ? vm._scope // 组件实例的作用域
        : undefined // undefined
    )
    // 将Watcher添加到组件实例的effects中
    if ((this.vm = vm) && isRenderWatcher) {
      vm._watcher = this
    }
    // options
    // Watcher的配置项，如果有配置项，则将deep、user、lazy、sync、before设置为配置项中的值，否则将deep、user、lazy、sync、before设置为false
    if (options) {
      this.deep = !!options.deep // 是否深度监听
      this.user = !!options.user // 是否是用户Watcher
      this.lazy = !!options.lazy // 是否是懒执行
      this.sync = !!options.sync // 是否同步执行
      this.before = options.before // 在执行Watcher的run方法之前执行的函数
      if (__DEV__) {
        this.onTrack = options.onTrack
        this.onTrigger = options.onTrigger
      }
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    //
    this.cb = cb // 回调函数
    this.id = ++uid // 依赖的唯一标识符
    this.active = true // 是否激活
    this.post = false // 是否是后置的
    this.dirty = this.lazy // 是否懒执行
    this.deps = [] // 依赖
    this.newDeps = [] // 新的依赖
    this.depIds = new Set() // 依赖的唯一标识符
    this.newDepIds = new Set() // 新的依赖的唯一标识符
    this.expression = __DEV__ ? expOrFn.toString() : '' // 表达式
    // parse expression for getter
    // 如果expOrFn是函数，则将expOrFn赋值给this.getter
    if (isFunction(expOrFn)) {
      this.getter = expOrFn
    } else {
      // 否则将expOrFn解析为getter
      this.getter = parsePath(expOrFn)
      // 如果解析失败，则将this.getter设置为noop，并打印警告信息
      if (!this.getter) {
        this.getter = noop
        __DEV__ &&
          warn(
            `Failed watching path: "${expOrFn}" ` +
              'Watcher only accepts simple dot-delimited paths. ' +
              'For full control, use a function instead.',
            vm
          )
      }
    }
    this.value = this.lazy ? undefined : this.get() // 如果解析成功，则将this.value设置为this.get方法的返回值，否则将this.value设置为undefined
  }

  /**
   * 获取值并收集依赖
   */
  get() {
    pushTarget(this) // 将当前Watcher添加到Dep.target中
    let value
    const vm = this.vm
    //
    try {
      // 调用this.getter，获取值
      value = this.getter.call(vm, vm)
    } catch (e: any) {
      // 如果出错，则打印错误信息
      if (this.user) {
        // 如果是用户Watcher，则打印错误信息
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        // 否则抛出错误
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 如果是深度监听，则递归遍历value，将value的每一个属性都添加到依赖中
      if (this.deep) {
        traverse(value)
      }
      popTarget() // 将Dep.target设置为上一个Watcher
      this.cleanupDeps() // 清理依赖
    }
    return value// 返回值
  }

  /**
   * 添加依赖
   * @param dep
   */
  addDep(dep: Dep) {
    const id = dep.id // 依赖的唯一标识符
    // 如果新的依赖的唯一标识符中不存在依赖的唯一标识符，将依赖的唯一标识符添加到新的依赖的唯一标识符中，将依赖添加到新的依赖中
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
       // 如果依赖的唯一标识符中不存在依赖的唯一标识符，则将当前Watcher添加到依赖中
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * 将新的依赖项集合设置为依赖项集合，将新的依赖项集合清空，将依赖项集合清空
   */
  cleanupDeps() {
    let i = this.deps.length // 依赖的长度
    while (i--) {
      const dep = this.deps[i]
      // 如果新的依赖的唯一标识符中不存在依赖的唯一标识符，则将当前Watcher从依赖中移除
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp: any = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * 订阅依赖项的更改
   */
  update() {
    /* istanbul ignore else */
    // 如果是懒执行，则将this.dirty设置为true
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      // 如果是同步执行，则调用this.run方法
      this.run()
    } else {
      // 如果不是同步执行，则将当前Watcher添加到队列中
      queueWatcher(this)
    }
  }

  /**
   * 调度程序作为观察者的回调
   */
  run() {
    // 如果当前Watcher是激活的
    if (this.active) {
      const value = this.get() // 获取值
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(
            this.cb,
            this.vm,
            [value, oldValue],
            this.vm,
            info
          )
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * 评估观察者的值，这仅适用于懒执行观察者。
   */
  evaluate() {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * 收集当前Watcher的所有依赖
   */
  depend() {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * 从所有依赖项的订阅者列表中删除自身
   */
  teardown() {
    if (this.vm && !this.vm._isBeingDestroyed) {
      remove(this.vm._scope.effects, this) // 将当前Watcher从组件实例的effects中移除
    }
    if (this.active) {
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this) // 将当前Watcher从依赖中移除
      }
      this.active = false // 将当前Watcher设置为非激活
      if (this.onStop) {
        this.onStop() // 调用this.onStop方法
      }
    }
  }
}
