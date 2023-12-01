import config from '../config'
import {isArray, isFunction, noop} from 'shared/util'
import type {Component} from 'types/component'
import {currentInstance} from 'v3/currentInstance'
import {getComponentName} from '../vdom/create-component'

export let warn: (msg: string, vm?: Component | null) => void = noop
export let tip = noop
export let generateComponentTrace: (vm: Component) => string // work around flow check
export let formatComponentName: (vm: Component, includeFile?: false) => string

if (__DEV__) {
  const hasConsole = typeof console !== 'undefined' // 判断是否有console
  const classifyRE = /(?:^|[-_])(\w)/g // 匹配正则
  /**
   * 将字符串转换为大写
   * @param str - 字符串
   */
  const classify = str =>
    str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')
  /**
   * 警告
   * @param msg - 消息
   * @param vm - 组件实例
   */
  warn = (msg, vm = currentInstance) => {
    const trace = vm ? generateComponentTrace(vm) : ''

    if (config.warnHandler) {
      config.warnHandler.call(null, msg, vm, trace)
    } else if (hasConsole && !config.silent) {
      console.error(`[Vue warn]: ${msg}${trace}`)
    }
  }
  /**
   * 提示
   * @param msg - 消息
   * @param vm - 组件实例
   */
  tip = (msg, vm) => {
    if (hasConsole && !config.silent) {
      console.warn(`[Vue tip]: ${msg}` + (vm ? generateComponentTrace(vm) : ''))
    }
  }
  /**
   * 格式化组件名称
   * @param vm - 组件实例
   * @param includeFile - 是否包含文件
   */
  formatComponentName = (vm, includeFile) => {
    if (vm.$root === vm) {
      return '<Root>'
    }
    const options =
      isFunction(vm) && (vm as any).cid != null
        ? (vm as any).options
        : vm._isVue
          ? vm.$options || (vm.constructor as any).options
          : vm
    let name = getComponentName(options)
    const file = options.__file
    if (!name && file) {
      const match = file.match(/([^/\\]+)\.vue$/)
      name = match && match[1]
    }

    return (
      (name ? `<${classify(name)}>` : `<Anonymous>`) +
      (file && includeFile !== false ? ` at ${file}` : '')
    )
  }
  /**
   * 重复字符串
   * @param str - 字符串
   * @param n - 重复次数
   */
  const repeat = (str, n) => {
    let res = ''
    while (n) {
      if (n % 2 === 1) res += str
      if (n > 1) str += str
      n >>= 1
    }
    return res
  }
  /**
   * 生成组件追踪，用于调试
   * @param vm - 组件实例
   */
  generateComponentTrace = (vm: Component | undefined) => {
    if ((vm as any)._isVue && vm!.$parent) {
      const tree: any[] = []
      let currentRecursiveSequence = 0
      while (vm) {
        if (tree.length > 0) {
          const last = tree[tree.length - 1]
          if (last.constructor === vm.constructor) {
            currentRecursiveSequence++
            vm = vm.$parent!
            continue
          } else if (currentRecursiveSequence > 0) {
            tree[tree.length - 1] = [last, currentRecursiveSequence]
            currentRecursiveSequence = 0
          }
        }
        tree.push(vm)
        vm = vm.$parent!
      }
      return (
        '\n\nfound in\n\n' +
        tree
          .map(
            (vm, i) =>
              `${i === 0 ? '---> ' : repeat(' ', 5 + i * 2)}${
                isArray(vm)
                  ? `${formatComponentName(vm[0])}... (${
                    vm[1]
                  } recursive calls)`
                  : formatComponentName(vm)
              }`
          )
          .join('\n')
      )
    } else {
      return `\n\n(found in ${formatComponentName(vm!)})`
    }
  }
}
