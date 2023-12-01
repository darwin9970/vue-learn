export const emptyObject: Record<string, any> = Object.freeze({})

export const isArray = Array.isArray

// These helpers produce better VM code in JS engines due to their
// explicitness and function inlining.
/**
 * 检查是否未定义值。
 * @param v - 值
 */
export function isUndef(v: any): v is undefined | null {
  return v === undefined || v === null
}

/**
 * 检查是否定义了值。
 * @param v - 值
 */
export function isDef<T>(v: T): v is NonNullable<T> {
  return v !== undefined && v !== null
}

/**
 * 检查是否为True。
 * @param v - 值
 */
export function isTrue(v: any): boolean {
  return v === true
}

/**
 * 检查是否为False。
 * @param v
 */
export function isFalse(v: any): boolean {
  return v === false
}

/**
 * 检查值是否为原始值。
 * @param value
 */
export function isPrimitive(value: any): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    // $flow-disable-line
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  )
}

/**
 * 检查值是否为function。
 * @param value
 */
export function isFunction(value: any): value is (...args: any[]) => any {
  return typeof value === 'function'
}

/**
 * Quick object check - this is primarily used to tell
 * objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
/**
 * 检查值是否为对象。
 * @param obj - 值
 */
export function isObject(obj: any): boolean {
  return obj !== null && typeof obj === 'object'
}

/**
 * Get the raw type string of a value, e.g., [object Object].
 */
const _toString = Object.prototype.toString

/**
 * 获取值的原始类型字符串，例如[object Object]。
 * @param value - 值
 */
export function toRawType(value: any): string {
  return _toString.call(value).slice(8, -1)
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
/**
 * 严格的对象类型检查。仅对纯JavaScript对象返回true。
 * @param obj
 */
export function isPlainObject(obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}

/**
 * 检查是否为正则表达式。
 * @param v - 值
 */
export function isRegExp(v: any): v is RegExp {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * 检查val是否为有效的数组索引。
 * @param val - 值
 */
export function isValidArrayIndex(val: any): boolean {
  const n = parseFloat(String(val))
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

/**
 * 检查val是否是Promise的实例。
 * @param val - 值
 */
export function isPromise(val: any): val is Promise<any> {
  return (
    isDef(val) &&
    typeof val.then === 'function' &&
    typeof val.catch === 'function'
  )
}

/**
 * 将值转换为实际呈现的字符串。
 * @param val
 */
export function toString(val: any): string {
  return val == null
    ? ''
    : Array.isArray(val) || (isPlainObject(val) && val.toString === _toString)
    ? JSON.stringify(val, null, 2)
    : String(val)
}

/**
 * 将输入值转换为数字以进行持久化。
 * @param val
 */
export function toNumber(val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

/**
 * 创建一个映射并返回一个函数，用于检查键是否在该映射中。
 * @param str
 * @param expectsLowerCase
 */
export function makeMap(
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | undefined {
  const map = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase ? val => map[val.toLowerCase()] : val => map[val]
}

/**
 * 检查标签是否为内置标签。
 */
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * 检查属性是否为保留属性。
 */
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')

/**
 * 从数组中删除项。
 * @param arr - 数组
 * @param item - 项
 */
export function remove(arr: Array<any>, item: any): Array<any> | void {
  const len = arr.length
  if (len) {
    // fast path for the only / last item
    if (item === arr[len - 1]) {
      arr.length = len - 1
      return
    }
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}


const hasOwnProperty = Object.prototype.hasOwnProperty
/**
 * 检查对象是否具有属性。
 * @param obj - 对象
 * @param key - 键
 */
export function hasOwn(obj: Object | Array<any>, key: string): boolean {
  return hasOwnProperty.call(obj, key)
}

/**
 * 创建纯函数的缓存版本。
 * @param fn - 函数
 */
export function cached<R>(fn: (str: string) => R): (sr: string) => R {
  const cache: Record<string, R> = Object.create(null)
  return function cachedFn(str: string) {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }
}

const camelizeRE = /-(\w)/g
/**
 * 将连字符分隔的字符串转换为驼峰命名。
 * @param str - 字符串
 */
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
})

/**
 * 将字符串的第一个字符转换为大写。
 * @param str - 字符串
 */
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * 将驼峰命名的字符串转换为连字符分隔的字符串。
 * @param str - 字符串
 */
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str: string): string => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * 简单的绑定polyfill，用于不支持它的环境，例如PhantomJS 1.x。
 * 从技术上讲，我们不再需要它，因为现在大多数浏览器中的本机绑定已经足够高效。
 * 但是删除它将意味着破坏能够在PhantomJS 1.x中运行的代码，因此必须保留它以实现向后兼容。
 * @param fn - 函数
 * @param ctx - 上下文
 */

/* istanbul ignore next */
function polyfillBind(fn: Function, ctx: Object): Function {
  function boundFn(a: any) {
    const l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }

  boundFn._length = fn.length
  return boundFn
}

/**
 * 将原生bind分配给变量，以便在需要时可以轻松地导出。
 * @param fn - 函数
 * @param ctx - 上下文
 */
function nativeBind(fn: Function, ctx: Object): Function {
  return fn.bind(ctx)
}

// @ts-expect-error bind cannot be `undefined`
export const bind = Function.prototype.bind ? nativeBind : polyfillBind

/**
 * 将类数组对象转换为真实数组。
 * @param list - 列表
 * @param start - 开始索引
 */
export function toArray(list: any, start?: number): Array<any> {
  start = start || 0
  let i = list.length - start
  const ret: Array<any> = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * 将属性混合到目标对象中。
 * @param to - 目标对象
 * @param _from - 源对象
 */
export function extend(
  to: Record<PropertyKey, any>,
  _from?: Record<PropertyKey, any>
): Record<PropertyKey, any> {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * 将对象数组合并为单个对象。
 * @param arr - 数组
 */
export function toObject(arr: Array<any>): object {
  const res = {}
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i])
    }
  }
  return res
}

/* eslint-disable no-unused-vars */

/**
 * 不执行任何操作。
 * @param a - 参数a
 * @param b - 参数b
 * @param c - 参数c
 */
export function noop(a?: any, b?: any, c?: any) {}

/**
 * Always return false.
 */
/**
 * 始终返回false。
 * @param a - 参数a
 * @param b - 参数b
 * @param c - 参数c
 */
export const no = (a?: any, b?: any, c?: any) => false

/* eslint-enable no-unused-vars */

/**
 * 返回相同的值。
 * @param _ - 参数
 */
export const identity = (_: any) => _

/**
 * 从编译器模块生成包含静态键的字符串。
 * @param modules - 模块
 */
export function genStaticKeys(
  modules: Array<{ staticKeys?: string[] } /* ModuleOptions */>
): string {
  return modules
    .reduce<string[]>((keys, m) => keys.concat(m.staticKeys || []), [])
    .join(',')
}

/**
 * 检查两个值是否松散相等-也就是说，如果它们是普通对象，它们是否具有相同的形状？
 * @param a - 参数a
 * @param b - 参数b
 */
export function looseEqual(a: any, b: any): boolean {
  if (a === b) return true
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  if (isObjectA && isObjectB) {
    try {
      const isArrayA = Array.isArray(a)
      const isArrayB = Array.isArray(b)
      if (isArrayA && isArrayB) {
        return (
          a.length === b.length &&
          a.every((e: any, i: any) => {
            return looseEqual(e, b[i])
          })
        )
      } else if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime()
      } else if (!isArrayA && !isArrayB) {
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        return (
          keysA.length === keysB.length &&
          keysA.every(key => {
            return looseEqual(a[key], b[key])
          })
        )
      } else {
        /* istanbul ignore next */
        return false
      }
    } catch (e: any) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

/**
 * 返回数组中可以找到松散相等值的第一个索引（如果值是普通对象，则数组必须包含相同形状的对象），
 * 如果不存在，则返回-1。
 * @param arr - 数组
 * @param val - 值
 */
export function looseIndexOf(arr: Array<unknown>, val: unknown): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * 确保函数只调用一次。
 * @param fn - 函数
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  return function () {
    if (!called) {
      called = true
      fn.apply(this, arguments as any)
    }
  } as any
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is#polyfill
/**
 * 检查两个值是否严格相等。
 * @param x - 参数x
 * @param y - 参数y
 */
export function hasChanged(x: unknown, y: unknown): boolean {
  if (x === y) {
    return x === 0 && 1 / x !== 1 / (y as number)
  } else {
    return x === x || y === y
  }
}
