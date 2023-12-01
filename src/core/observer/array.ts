/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { TriggerOpTypes } from '../../v3'
import { def } from '../util/index'

const arrayProto = Array.prototype // 获取Array.prototype
export const arrayMethods = Object.create(arrayProto) // 创建一个对象，该对象的原型指向Array.prototype

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
] // push、pop、shift、unshift、splice、sort、reverse

/**
 * Intercept mutating methods and emit events
 */
/**
 * 重写数组的方法，使得数组的方法能够触发依赖的目标依赖项的onTrigger方法
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method] // 缓存Array.prototype的方法
  // 将arrayMethods的方法挂载到value上
  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args) // 调用Array.prototype的方法
    const ob = this.__ob__ // 获取Observer实例
    let inserted
    // 判断调用的是哪个方法
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 如果插入的值存在，则将插入的值转换为响应式
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 如果是开发环境，则触发依赖的目标依赖项的onTrigger方法
    if (__DEV__) {
      ob.dep.notify({
        type: TriggerOpTypes.ARRAY_MUTATION,
        target: this,
        key: method
      })
    } else {
      // 如果不是开发环境，则触发依赖的目标依赖项的update方法
      ob.dep.notify()
    }
    return result // 返回调用Array.prototype的方法的返回值
  })
})
