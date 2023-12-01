import { Component } from 'types/component'

export let currentInstance: Component | null = null

/**
 * 这是为了与v3兼容而公开的（例如，VueUse中的一些函数依赖于它）。不要在内部使用它，只需使用“currentInstance”即可。
 * 该函数需要手动类型声明，因为它依赖于Vue 2中以前手动编写的类型
 */
export function getCurrentInstance(): { proxy: Component } | null {
  return currentInstance && { proxy: currentInstance }
}

/**
 * @internal
 */
export function setCurrentInstance(vm: Component | null = null) {
  if (!vm) currentInstance && currentInstance._scope.off()
  currentInstance = vm
  vm && vm._scope.on()
}
