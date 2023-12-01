import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import type { VNodeDirective, VNodeWithData } from 'types/vnode'
import type { Component } from 'types/component'

export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives(vnode: VNodeWithData) {
    // @ts-expect-error emptyNode is not VNodeWithData
    updateDirectives(vnode, emptyNode)
  }
}

/**
 * 更新指令
 * @param oldVnode - 旧的虚拟节点
 * @param vnode - 新的虚拟节点
 */
function updateDirectives(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

/**
 * 更新，创建，销毁指令
 * @param oldVnode - 旧的虚拟节点
 * @param vnode - 新的虚拟节点
 */
function _update(oldVnode, vnode) {
  const isCreate = oldVnode === emptyNode
  const isDestroy = vnode === emptyNode
  const oldDirs = normalizeDirectives(
    oldVnode.data.directives,
    oldVnode.context
  )
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)

  const dirsWithInsert: any[] = []
  const dirsWithPostpatch: any[] = []

  let key, oldDir, dir
  for (key in newDirs) {
    oldDir = oldDirs[key]
    dir = newDirs[key]
    if (!oldDir) {
      // new directive, bind
      callHook(dir, 'bind', vnode, oldVnode)
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir)
      }
    } else {
      // existing directive, update
      dir.oldValue = oldDir.value
      dir.oldArg = oldDir.arg
      callHook(dir, 'update', vnode, oldVnode)
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir)
      }
    }
  }

  if (dirsWithInsert.length) {
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    if (isCreate) {
      mergeVNodeHook(vnode, 'insert', callInsert)
    } else {
      callInsert()
    }
  }

  if (dirsWithPostpatch.length) {
    mergeVNodeHook(vnode, 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  if (!isCreate) {
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // no longer present, unbind
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

/**
 * 规范化指令
 * @param dirs - 指令
 * @param vm - 组件实例
 */
function normalizeDirectives(
  dirs: Array<VNodeDirective> | undefined,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)
  if (!dirs) {
    // $flow-disable-line
    return res
  }
  let i: number, dir: VNodeDirective
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    if (!dir.modifiers) {
      // $flow-disable-line
      dir.modifiers = emptyModifiers
    }
    res[getRawDirName(dir)] = dir
    if (vm._setupState && vm._setupState.__sfc) {
      const setupDef = dir.def || resolveAsset(vm, '_setupState', 'v-' + dir.name)
      if (typeof setupDef === 'function') {
        dir.def = {
          bind: setupDef,
          update: setupDef,
        }
      } else {
        dir.def = setupDef
      }
    }
    dir.def = dir.def || resolveAsset(vm.$options, 'directives', dir.name, true)
  }
  // $flow-disable-line
  return res
}

/**
 * 获取原始指令名
 * @param dir - 指令
 */
function getRawDirName(dir: VNodeDirective): string {
  return (
    dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
  )
}

/**
 * 调用钩子函数
 * @param dir - 指令
 * @param hook - 钩子函数名
 * @param vnode - 虚拟节点
 * @param oldVnode - 旧的虚拟节点
 * @param isDestroy - 是否销毁
 */
function callHook(dir, hook, vnode, oldVnode, isDestroy?: any) {
  const fn = dir.def && dir.def[hook]
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e: any) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
