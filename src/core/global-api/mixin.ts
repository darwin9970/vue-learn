import type { GlobalAPI } from 'types/global-api'
import { mergeOptions } from '../util/index'

/**
 * 初始化混入，用于全局混入mixin
 * @param Vue - 全局API
 */
export function initMixin(Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
