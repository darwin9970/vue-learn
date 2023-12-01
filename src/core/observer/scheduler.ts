import type Watcher from './watcher'
import config from '../config'
import Dep, { cleanupDeps } from './dep'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import { warn, nextTick, devtools, inBrowser, isIE } from '../util/index'
import type { Component } from 'types/component'

export const MAX_UPDATE_COUNT = 100 // 最大更新次数
const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: true | undefined | null } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * 重置调度程序的状态。
 * 重置index、queue、activatedChildren、has、circular、waiting、flushing
 */
function resetSchedulerState() {
  index = queue.length = activatedChildren.length = 0 // 重置index、queue、activatedChildren
  has = {} // 重置has
  if (__DEV__) { // 如果是开发环境，则重置circular
    circular = {}
  }
  waiting = flushing = false // 重置waiting、flushing
}

export let currentFlushTimestamp = 0 // 当前刷新时间戳

let getNow: () => number = Date.now // 获取当前时间戳

// 如果是浏览器环境，并且不是IE浏览器
if (inBrowser && !isIE) {
  const performance = window.performance // 获取performance
   // 如果performance存在，并且performance.now是一个函数，并且当前时间戳大于document.createEvent('Event').timeStamp
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // 如果事件时间戳，尽管在Date.now()之后计算，但小于它，则表示事件正在使用高分辨率时间戳，我们也需要为事件侦听器时间戳使用高分辨率版本。
    getNow = () => performance.now() // 获取performance.now
  }
}
/**
 * Flush both queues and run the watchers.
 * @param a - Watcher
 * @param b - Watcher
 */
const sortCompareFn = (a: Watcher, b: Watcher): number => {
  // 如果a.post存在，则返回-1
  if (a.post) {
    if (!b.post) return 1
  } else if (b.post) {
    // 如果b.post存在，则返回1
    return -1
  }
  return a.id - b.id
}

/**
 * 刷新队列并运行Watcher，调用Watcher的run方法
 */
function flushSchedulerQueue() {
  currentFlushTimestamp = getNow() // 获取当前时间戳
  flushing = true // 设置flushing为true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort(sortCompareFn) // 对queue进行排序

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 遍历queue，调用Watcher的run方法
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index] // 获取Watcher
    if (watcher.before) {
      watcher.before() //
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    // 如果是开发环境， // circular[id]加1，
    if (__DEV__ && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      // 如果超出最大更新次数，则打印警告信息
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' +
            (watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice() // 获取activatedChildren的副本
  const updatedQueue = queue.slice() // 获取queue的副本

  resetSchedulerState() // 重置调度程序的状态

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue) // 调用activatedChildren的钩子函数
  callUpdatedHooks(updatedQueue) // 调用queue的钩子函数
  cleanupDeps() // 清理依赖

  // devtool hook
  /* istanbul ignore if */
  // 如果devtools存在，并且config.devtools为true
  if (devtools && config.devtools) {
    devtools.emit('flush') // 触发flush事件
  }
}

/**
 * 调用观察者列表中的更新hook。
 * @param queue - Watcher列表
 */
function callUpdatedHooks(queue: Watcher[]) { //
  let i = queue.length // 获取queue的长度
  while (i--) {
    const watcher = queue[i] // 获取Watcher
    const vm = watcher.vm // 获取Watcher的vm
    // 如果vm存在，并且vm._watcher等于watcher，并且vm._isMounted为true，并且vm._isDestroyed为false，则调用updated钩子函数
    if (vm && vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}
/**
 * 将activatedChildren添加到queue中，然后在下一个事件循环中刷新队列
 * @param vm - 组件实例
 */
export function queueActivatedComponent(vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm) // 将vm添加到activatedChildren中
}

/**
 * 将queue添加到queue中，然后在下一个事件循环中刷新队列
 * @param queue - Watcher列表
 */
function callActivatedHooks(queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */) // 激活子组件
  }
}

/**
 * 将Watcher添加到queue中，然后在下一个事件循环中刷新队列
 * @param watcher - Watcher
 */
export function queueWatcher(watcher: Watcher) {
  const id = watcher.id
  // 如果has[id]不为null，则直接返回
  if (has[id] != null) {
    return
  }
  // 如果watcher等于Dep.target，并且watcher.noRecurse为true，则直接返回
  if (watcher === Dep.target && watcher.noRecurse) {
    return
  }

  has[id] = true // 设置has[id]为true
  // 如果不是正在刷新，则将Watcher添加到queue中
  if (!flushing) {
    queue.push(watcher)
  } else {
    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    // 如果正在刷新，则将Watcher添加到queue中，然后对queue进行排序，将Watcher按照id排序，然后将Watcher添加到queue中
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }
  // queue the flush
  // 如果不是等待刷新，则等待刷新
  if (!waiting) {
    waiting = true
    // 如果是开发环境，并且config.async为true，则在下一个事件循环中刷新队列，否则立即刷新队列
    if (__DEV__ && !config.async) {
      flushSchedulerQueue()
      return
    }
    // 在下一个事件循环中刷新队列，如果是浏览器环境，则调用nextTick(flushSchedulerQueue)，否则调用setTimeout(flushSchedulerQueue, 0)
    nextTick(flushSchedulerQueue)
  }
}
