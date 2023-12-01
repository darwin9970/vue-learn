/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false

const callbacks: Array<Function> = []
let pending = false

/**
 * 刷新回调，执行回调函数
 */
function flushCallbacks() {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

/**
 * 在这里，我们使用微任务进行异步延迟包装。
 * 在 2.5 中，我们使用（宏）任务（与微任务结合使用）。
 * 但是，当状态在重新绘制之前发生变化时，它会产生一些微妙的问题（例如 #6813，out-in 过渡）。
 * 此外，在事件处理程序中使用（宏）任务会导致一些奇怪的行为，无法规避（例如 #7109，#7153，#7546，#7834，#8109）。
 * 所以我们现在又到处使用微任务了。
 * 这种权衡的一个主要缺点是，有些情况下，微任务的优先级太高，在假定的顺序事件之间触发（例如 #4521，#6690，有解决方法），
 * 甚至在同一事件的冒泡之间触发（#6566）。
 */
let timerFunc

/**
 * nextTick 行为利用了可以通过原生的 Promise.then 或 MutationObserver 访问的微任务队列。
 * MutationObserver 有更广泛的支持，但是在 iOS >= 9.3.3 的 UIWebView 中，在触摸事件处理程序中触发时，它会严重出错。
 * 触发几次后，它就完全停止工作了……所以，如果原生的 Promise 可用，我们将使用它：
 */
/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    /**
     * 在有问题的UIWebViews中，Promise.then不会完全中断，但是
     * 它可能会陷入一种奇怪的状态，其中回调被推入
     * 微任务队列，但队列没有被刷新，直到浏览器
     * 需要做一些其他工作，例如处理计时器。因此我们可以
     * 通过添加一个空计时器来“强制”刷新微任务队列。
     */
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (
  !isIE &&
  typeof MutationObserver !== 'undefined' &&
  (isNative(MutationObserver) ||
    // PhantomJS and iOS 7.x
    MutationObserver.toString() === '[object MutationObserverConstructor]')
) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Technically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

export function nextTick(): Promise<void>
export function nextTick<T>(this: T, cb: (this: T, ...args: any[]) => any): void
export function nextTick<T>(cb: (this: T, ...args: any[]) => any, ctx: T): void
/**
 * @internal
 */
/**
 * nextTick
 * @param cb - 回调函数
 * @param ctx - 上下文
 */
export function nextTick(cb?: (...args: any[]) => any, ctx?: object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e: any) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
