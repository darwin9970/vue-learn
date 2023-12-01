import { emptyObject } from 'shared/util'
import { ASTElement, ASTModifiers } from 'types/compiler'
import { parseFilters } from './parser/filter-parser'

type Range = { start?: number; end?: number }

/* eslint-disable no-unused-vars */
export function baseWarn(msg: string, range?: Range) {
  console.error(`[Vue compiler]: ${msg}`)
}
/* eslint-enable no-unused-vars */

export function pluckModuleFunction<T, K extends keyof T>(
  modules: Array<T> | undefined,
  key: K
): Array<Exclude<T[K], undefined>> {
  // 从modules中取出key对应的值，过滤掉undefined
  return modules ? (modules.map(m => m[key]).filter(_ => _) as any) : []
}

export function addProp(
  el: ASTElement,
  name: string,
  value: string,
  range?: Range,
  dynamic?: boolean
) {
  ;(el.props || (el.props = [])).push(
    rangeSetItem({ name, value, dynamic }, range) // 将属性添加到el.props中
  )
  el.plain = false
}

export function addAttr(
  el: ASTElement,
  name: string,
  value: any,
  range?: Range,
  dynamic?: boolean
) {
  const attrs = dynamic
    ? el.dynamicAttrs || (el.dynamicAttrs = [])
    : el.attrs || (el.attrs = [])
  attrs.push(rangeSetItem({ name, value, dynamic }, range))
  el.plain = false
}

// add a raw attr (use this in preTransforms)
export function addRawAttr(
  el: ASTElement,
  name: string,
  value: any,
  range?: Range
) {
  el.attrsMap[name] = value // 将属性添加到el.attrsMap中
  el.attrsList.push(rangeSetItem({ name, value }, range)) // 将属性添加到el.attrsList中
}

export function addDirective(
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg?: string,
  isDynamicArg?: boolean,
  modifiers?: ASTModifiers,
  range?: Range
) {
  // 将指令添加到el.directives中
  ;(el.directives || (el.directives = [])).push( 
    rangeSetItem(
      {
        name,
        rawName,
        value,
        arg,
        isDynamicArg,
        modifiers
      },
      range
    )
  )
  el.plain = false
}

function prependModifierMarker(
  symbol: string,
  name: string,
  dynamic?: boolean
): string { 
  // 将事件标记为已捕获
  return dynamic ? `_p(${name},"${symbol}")` : symbol + name // mark the event as captured
}

export function addHandler(
  el: ASTElement,
  name: string,
  value: string,
  modifiers?: ASTModifiers | null,
  important?: boolean,
  warn?: Function,
  range?: Range,
  dynamic?: boolean
) {
  modifiers = modifiers || emptyObject
  // warn prevent and passive modifier
  /* istanbul ignore if */
  // 非生产环境下，如果事件名是click，同时有prevent和passive修饰符，发出警告
  if (__DEV__ && warn && modifiers.prevent && modifiers.passive) {
    warn(
      "passive and prevent can't be used together. " +
        "Passive handler can't prevent default event.",
      range
    )
  }

  // normalize click.right and click.middle since they don't actually fire
  // this is technically browser-specific, but at least for now browsers are
  // the only target envs that have right/middle clicks.
  // 右键点击
  if (modifiers.right) {
    // 动态绑定
    if (dynamic) { 
      name = `(${name})==='click'?'contextmenu':(${name})` // 动态绑定，如果是click事件，转换为contextmenu事件
    } else if (name === 'click') {
      // 静态绑定，如果是click事件，转换为contextmenu事件
      name = 'contextmenu'
      delete modifiers.right
    }
  } else if (modifiers.middle) {
    // 中键点击
    if (dynamic) {
      name = `(${name})==='click'?'mouseup':(${name})` // 动态绑定，如果是click事件，转换为mouseup事件
    } else if (name === 'click') {
      name = 'mouseup' // 静态绑定，如果是click事件，转换为mouseup事件
    }
  }

  // check capture modifier
  // 捕获
  if (modifiers.capture) {
    delete modifiers.capture // 删除capture修饰符
    name = prependModifierMarker('!', name, dynamic) // 将事件标记为已捕获
  }
  // 一次性事件
  if (modifiers.once) {
    delete modifiers.once // 删除once修饰符
    name = prependModifierMarker('~', name, dynamic) // 将事件标记为一次性事件
  }
  /* istanbul ignore if */
  // 被动
  if (modifiers.passive) { 
    delete modifiers.passive // 删除passive修饰符
    name = prependModifierMarker('&', name, dynamic) // 将事件标记为被动
  }

  let events // 事件
  // 原生事件
  if (modifiers.native) {
    delete modifiers.native // 删除native修饰符
    events = el.nativeEvents || (el.nativeEvents = {}) // 原生事件
  } else {
    // 普通事件
    events = el.events || (el.events = {})
  }
  // 将事件添加到newHandler中
  const newHandler: any = rangeSetItem({ value: value.trim(), dynamic }, range) 
  // 修饰符不为空
  if (modifiers !== emptyObject) { 
    newHandler.modifiers = modifiers // 将修饰符添加到newHandler中
  }
  // 获取事件名
  const handlers = events[name]
  /* istanbul ignore if */
  // 如果事件名对应的事件是数组
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler) // 将事件添加到事件数组中
  } else if (handlers) { 
    // 如果事件名对应的事件不是数组
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler] // 将事件添加到事件数组中
  } else {
    // 如果事件名对应的事件不存在
    events[name] = newHandler // 将事件添加到事件数组中
  }

  el.plain = false 
}

export function getRawBindingAttr(el: ASTElement, name: string) {
  return (
    // 获取动态绑定的属性值，如：:id="id"，返回id，:class="class"，返回class，:style="style"，返回style，:[key]="value"，返回key，:key="value"，返回key
    el.rawAttrsMap[':' + name] ||
    el.rawAttrsMap['v-bind:' + name] ||
    el.rawAttrsMap[name] // 
  )
}

export function getBindingAttr(
  el: ASTElement,
  name: string,
  getStatic?: boolean
): string | undefined {
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) || getAndRemoveAttr(el, 'v-bind:' + name) 
    // 动态绑定
    if (dynamicValue != null) {
    return parseFilters(dynamicValue) // 解析过滤器
  } else if (getStatic !== false) { 
    // 静态绑定
    const staticValue = getAndRemoveAttr(el, name) // 获取静态绑定的属性值
    // 静态绑定的属性值不为空
    if (staticValue != null) { 
      return JSON.stringify(staticValue) // 返回静态绑定的属性值
    }
  }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
export function getAndRemoveAttr(
  el: ASTElement,
  name: string,
  removeFromMap?: boolean
): string | undefined {
  let val
  // 获取属性值
  if ((val = el.attrsMap[name]) != null) { 
    const list = el.attrsList // 属性列表
    // 遍历属性列表，找到属性，删除属性，跳出循环
    for (let i = 0, l = list.length; i < l; i++) { 
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  // 删除属性
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  return val
}
// 获取属性值，通过正则表达式匹配，返回匹配到的属性值，并删除属性
export function getAndRemoveAttrByRegex(el: ASTElement, name: RegExp) {
  const list = el.attrsList // 属性列表
  for (let i = 0, l = list.length; i < l; i++) { 
    const attr = list[i]
    if (name.test(attr.name)) {
      list.splice(i, 1)
      return attr
    }
  }
}
// 判断是否是指定的标签，如：isReservedTag('div')，返回true，isReservedTag('abc')，返回false
function rangeSetItem(item: any, range?: { start?: number; end?: number }) {
  if (range) {
    if (range.start != null) {
      item.start = range.start
    }
    if (range.end != null) {
      item.end = range.end
    }
  }
  return item
}
