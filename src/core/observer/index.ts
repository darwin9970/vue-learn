import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  isArray,
  hasProto,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
  hasChanged,
  noop
} from '../util/index'
import { isReadonly, isRef, TrackOpTypes, TriggerOpTypes } from '../../v3'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods) // 获取arrayMethods的所有属性

const NO_INITIAL_VALUE = {} // 没有初始值

/**
 * 在某些情况下，我们希望在组件的更新计算在禁用观察
 */
export let shouldObserve: boolean = true

/**
 * Observer类附加到每个被观察的对象上。
 * @param value - 要观察的对象
 * @returns {Observer | void} - Observer实例
 */
export function toggleObserving(value: boolean) {
  shouldObserve = value
}

const mockDep = {
  notify: noop,
  depend: noop,
  addSub: noop,
  removeSub: noop
} as Dep

/**
 * Observer类附加到每个被观察的对象上。
 * 一旦附加，观察者将目标对象的属性键转换为getter/setter，
 * 收集依赖项并分派更新。
 * 附加到数组时，它将为数组的索引值转换为依赖项。
 * 当使用Object.defineProperty重新分配属性时，我们需要
 * 保留数组的原始原型来避免覆盖。
 */
export class Observer {
  dep: Dep // 依赖收集器
  vmCount: number // 作为根$data的vm的数量
  /**
   * 为目标对象创建一个新的观察者。
   * @param value - 要观察的对象
   * @param shallow - 是否应该是表层的
   * @param mock - 是否是mock
   */
  constructor(public value: any, public shallow = false, public mock = false) {
    // this.value = value
    this.dep = mock ? mockDep : new Dep() // 依赖收集器
    this.vmCount = 0 // 实例化的次数
    // 将Observer实例挂载到value的__ob__属性上
    def(value, '__ob__', this)
    // 如果是数组，则将arrayMethods的方法挂载到value上
    if (isArray(value)) {
      // 如果不是mock，则将arrayMethods的方法挂载到value上
      if (!mock) {
        // 如果支持__proto__，则直接将value的__proto__指向arrayMethods
        if (hasProto) {
          /* eslint-disable no-proto */
          ;(value as any).__proto__ = arrayMethods
          /* eslint-enable no-proto */
        } else {
          for (let i = 0, l = arrayKeys.length; i < l; i++) {
            const key = arrayKeys[i] // push、pop、shift、unshift、splice、sort、reverse
            // 将arrayMethods的方法挂载到value上
            def(value, key, arrayMethods[key])
          }
        }
      }
      if (!shallow) {
        this.observeArray(value) // 遍历数组，将数组中的每一项都转换为响应式
      }
    } else {
      /**
       * 遍历所有属性并将它们转换为getter/setter。只有当值类型为Object时，才应调用此方法。
       */
      const keys = Object.keys(value) // 获取对象的所有属性
      // 遍历对象的所有属性
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        defineReactive(value, key, NO_INITIAL_VALUE, undefined, shallow, mock) // 将对象的每一个属性都转换为响应式
      }
    }
  }

  /**
   * 数组特殊处理，因为它们的更新依赖于索引
   */
  observeArray(value: any[]) {
    for (let i = 0, l = value.length; i < l; i++) {
      observe(value[i], false, this.mock) // 将数组中的每一项都转换为响应式
    }
  }
}

// helpers

/**
 * 尝试为一个值创建一个Observe实例，
 * 如果成功观察到，则返回新的Observe，
 * 如果该值已经有一个，则返回现有的Observe。
 * @param value - 要观察的值
 * @param shallow - 是否应该是表层的
 * @param ssrMockReactivity - 是否是mock
 * @returns {Observer | void} - Observer实例
 */
export function observe(
  value: any,
  shallow?: boolean,
  ssrMockReactivity?: boolean
): Observer | void {
  // 如果已经有__ob__属性，则直接返回
  if (value && hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    return value.__ob__
  }
  // 如果是数组或者对象，则创建一个Observe实例
  if (
    shouldObserve &&
    (ssrMockReactivity || !isServerRendering()) &&
    (isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value.__v_skip /* ReactiveFlags.SKIP */ &&
    !isRef(value) &&
    !(value instanceof VNode)
  ) {
    return new Observer(value, shallow, ssrMockReactivity)
  }
}

/**
 * 定义一个响应式属性。
 * @param obj - 要定义的对象
 * @param key - 要定义的属性
 * @param val - 要定义的值
 * @param customSetter - 自定义setter
 * @param shallow - 是否应该是表层的
 * @param mock - 是否是mock
 * @returns {Dep} - 依赖收集器
 */
export function defineReactive(
  obj: object,
  key: string,
  val?: any,
  customSetter?: Function | null,
  shallow?: boolean,
  mock?: boolean
) {
  const dep = new Dep() // 依赖收集器

  const property = Object.getOwnPropertyDescriptor(obj, key) // 获取对象的属性描述符
  // 如果属性描述符中的configurable为false，则直接返回
  if (property && property.configurable === false) {
    return
  }

  // 预定义getter和setter
  const getter = property && property.get
  const setter = property && property.set
  // 如果没有getter或者有setter，则直接返回
  if (
    (!getter || setter) &&
    (val === NO_INITIAL_VALUE || arguments.length === 2)
  ) {
    val = obj[key]
  }

  let childOb = !shallow && observe(val, false, mock) // 将childOb对象的每一个属性都转换为响应式
  // 为对象的每一个属性都创建一个依赖收集器
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    /**
     * 获取对象的属性。
     * @returns {*} - 对象的属性
     */
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val // 如果有getter，则调用getter，否则直接返回val
      // 如果有依赖收集器，则进行依赖收集
      if (Dep.target) {
        // 如果是开发环境，则进行依赖收集
        if (__DEV__) {
          dep.depend({
            target: obj, // 依赖收集器的目标对象
            type: TrackOpTypes.GET, // 依赖收集器的类型
            key // 依赖收集器的key
          })
        } else {
          dep.depend() // 进行依赖收集
        }
        // 如果childOb存在，则进行依赖收集
        if (childOb) {
          childOb.dep.depend() // 进行依赖收集
          // 如果value是数组，则进行特殊处理
          if (isArray(value)) {
            dependArray(value)
          }
        }
      }
      return isRef(value) && !shallow ? value.value : value // 如果是ref，则返回value.value，否则直接返回value
    },
    /**
     * 为对象的每一个属性都创建一个依赖收集器
     * @param newVal - 新值
     * @returns {void}
     */
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val // 如果有getter，则调用getter，否则直接返回val
      // 对比新值与旧值，如果新值和旧值相等，则直接返回
      if (!hasChanged(value, newVal)) {
        return
      }
      // 如果是开发环境，则调用customSetter
      if (__DEV__ && customSetter) {
        customSetter()
      }
      // 如果有setter，则调用setter
      if (setter) {
        setter.call(obj, newVal)
      } else if (getter) {
        // 如果没有setter，但是有getter，则直接返回
        return
      } else if (!shallow && isRef(value) && !isRef(newVal)) {
        // 如果没有setter，没有getter，但是value是ref，而newVal不是ref，则直接返回
        value.value = newVal
        return
      } else {
        val = newVal // 如果没有setter，没有getter，则直接将新值赋值给val
      }
      childOb = !shallow && observe(newVal, false, mock) // 将childOb对象的每一个属性都转换为响应式
      // 如果是开发环境，则触发依赖的目标依赖项的onTrigger方法
      if (__DEV__) {
        // 通知依赖收集器
        dep.notify({
          type: TriggerOpTypes.SET,
          target: obj,
          key,
          newValue: newVal,
          oldValue: value
        })
      } else {
        dep.notify() // 通知依赖收集器
      }
    }
  })

  return dep
}

export function set<T>(array: T[], key: number, value: T): T
export function set<T>(object: object, key: string | number, value: T): T
/**
 * 设置对象的属性。
 * @param target - 要设置的对象
 * @param key - 要设置的属性
 * @param val - 要设置的值
 * @returns {any}
 */
export function set(
  target: any[] | Record<string, any>,
  key: any,
  val: any
): any {
  // 如果target是undefined、null，则打印警告信息
  if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${target}`
    )
  }
  // 如果target是只读的，则直接返回
  if (isReadonly(target)) {
    __DEV__ && warn(`Set operation on key "${key}" failed: target is readonly.`)
    return
  }
  // 获取target的Observer实例
  const ob = (target as any).__ob__
  // 如果target是数组，并且key是有效的数组索引，则将数组转换为相应式后返回
  if (isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key) // 设置数组的长度
    target.splice(key, 1, val) // 设置数组的值
    // when mocking for SSR, array methods are not hijacked
    if (ob && !ob.shallow && ob.mock) {
      observe(val, false, true) // 将val转换为响应式
    }
    return val // 返回val
  }
  // 如果key在target中已经存在，并且不是原型上的属性，则直接赋值并返回
  if (key in target && !(key in Object.prototype)) {
    target[key] = val // 赋值
    return val
  }
  // 如果target没有Observer实例，则打印警告信息并返回val
  if ((target as any)._isVue || (ob && ob.vmCount)) {
    __DEV__ &&
      warn(
        'Avoid adding reactive properties to a Vue instance or its root $data ' +
          'at runtime - declare it upfront in the data option.'
      ) //
    return val
  }
  // 如果没有Observer实例，则直接赋值并返回
  if (!ob) {
    target[key] = val
    return val
  }
  // 将key转换为响应式
  defineReactive(ob.value, key, val, undefined, ob.shallow, ob.mock)
  // 如果是开发环境，则触发依赖的目标依赖项的onTrigger方法
  if (__DEV__) {
    ob.dep.notify({
      type: TriggerOpTypes.ADD, // 依赖收集器的类型
      target: target, // 依赖收集器的目标对象
      key, // 依赖收集器的key
      newValue: val, // 依赖收集器的新值
      oldValue: undefined // 依赖收集器的旧值
    })
  } else {
    // 如果不是开发环境，则触发依赖的目标依赖项的update方法
    ob.dep.notify()
  }
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del<T>(array: T[], key: number): void
export function del(object: object, key: string | number): void
/**
 * 删除对象的属性。
 * @param target - 要删除的对象
 * @param key - 要删除的属性
 * @returns {void}
 */
export function del(target: any[] | object, key: any) {
  // 不能删除undefined、null、或者是基本类型的属性
  if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${target}`
    )
  }
  // 如果target是数组，并且key是有效的数组索引，则删除数组的属性
  if (isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  // 获取target的Observer实例
  const ob = (target as any).__ob__
  // 如果是Vue实例或者是根$data，则打印警告信息并直接返回
  if ((target as any)._isVue || (ob && ob.vmCount)) {
    __DEV__ &&
      warn(
        'Avoid deleting properties on a Vue instance or its root $data ' +
          '- just set it to null.'
      )
    return
  }
  // 如果target是只读的，则打印警告信息并直接返回
  if (isReadonly(target)) {
    __DEV__ &&
      warn(`Delete operation on key "${key}" failed: target is readonly.`)
    return
  }
  // 如果target没有key属性，则直接返回
  if (!hasOwn(target, key)) {
    return
  }
  // 删除target的key属性
  delete target[key]
  // 如果没有Observer实例，则直接返回
  if (!ob) {
    return
  }
  // 如果是开发环境，则触发依赖的目标依赖项的onTrigger方法
  if (__DEV__) {
    ob.dep.notify({
      type: TriggerOpTypes.DELETE, // 依赖收集器的类型
      target: target, // 依赖收集器的目标对象
      key // 依赖收集器的key
    })
  } else {
    // 如果不是开发环境，则触发依赖的目标依赖项的update方法
    ob.dep.notify()
  }
}

/**
 * 递归地删除对象上的所有观察者
 * @param value - 要观察的数组
 * @returns {void}
 */
// 依赖收集数组的每一项
function dependArray(value: Array<any>) {
  // 遍历数组的每一项
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i] // 获取数组的每一项
    // 如果数组的每一项有Observer实例，则进行依赖收集
    if (e && e.__ob__) {
      e.__ob__.dep.depend() // 进行依赖收集
    }
    // 如果数组的每一项是数组，则进行依赖收集
    if (isArray(e)) {
      dependArray(e)
    }
  }
}
