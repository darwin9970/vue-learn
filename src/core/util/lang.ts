
/**
 * 用于解析html标签、组件名称和属性路径的unicode字母。
 * 使用https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * 跳过\u10000-\uEFFFF，因为它会冻结PhantomJS
 */
export const unicodeRegExp =
  /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/


/**
 * 检查字符串是否以$或_开头
 * @param str - 字符串
 */
export function isReserved(str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5f
}

/**
 * 定义属性
 * @param obj - 对象
 * @param key - 键
 * @param val - 值
 * @param enumerable - 是否可枚举
 */
export function def(obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

const bailRE = new RegExp(`[^${unicodeRegExp.source}.$_\\d]`) // 解析简单路径
/**
 * 解析路径
 * @param path - 路径
 */
export function parsePath(path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
