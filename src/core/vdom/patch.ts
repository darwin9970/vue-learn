/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 */

import VNode, { cloneVNode } from './vnode'
import config from '../config'
import { SSR_ATTR } from 'shared/constants'
import { registerRef } from './modules/template-ref'
import { traverse } from '../observer/traverse'
import { activeInstance } from '../instance/lifecycle'
import { isTextInputType } from 'web/util/element'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isArray,
  makeMap,
  isRegExp,
  isPrimitive
} from '../util/index'

export const emptyNode = new VNode('', {}, [])

const hooks = ['create', 'activate', 'update', 'remove', 'destroy'] // 钩子函数名

/**
 * sameVnode函数，判断两个VNode是否相同，如果相同，则返回true，否则返回false
 * @param a 第一个节点
 * @param b 第二个节点
 */
function sameVnode(a, b) {
  return (
    a.key === b.key &&
    a.asyncFactory === b.asyncFactory &&
    ((a.tag === b.tag &&
      a.isComment === b.isComment &&
      isDef(a.data) === isDef(b.data) &&
      sameInputType(a, b)) ||
      (isTrue(a.isAsyncPlaceholder) && isUndef(b.asyncFactory.error)))
  )
}

/**
 * sameInputType函数，判断两个input的type是否相同，如果相同，则返回true，否则返回false
 * @param a 第一个节点
 * @param b 第二个节点
 */
function sameInputType(a, b) {
  if (a.tag !== 'input') return true
  let i
  const typeA = isDef((i = a.data)) && isDef((i = i.attrs)) && i.type
  const typeB = isDef((i = b.data)) && isDef((i = i.attrs)) && i.type
  return typeA === typeB || (isTextInputType(typeA) && isTextInputType(typeB))
}

/**
 * createKeyToOldIdx函数，
 * 判断是否为原生HTML或只是普通文本，如果是原生HTML或只是普通文本，则返回该节点，如果不是，则返回undefined
 * @param children 子节点
 * @param beginIdx 开始索引
 * @param endIdx 结束索引
 */
function createKeyToOldIdx(children, beginIdx, endIdx) {
  let i, key
  const map = {}
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key
    if (isDef(key)) map[key] = i
  }
  return map
}

/**
 * createPatchFunction函数，判断是否为原生HTML或只是普通文本，如果是原生HTML或只是普通文本，则返回该节点，
 * 如果不是，则返回undefined，
 * 如果是开发环境，则判断子节点的key是否重复，
 * 如果重复，则报错
 * @param backend 处理平台的特定方法
 */
export function createPatchFunction(backend) {
  let i, j // 索引
  const cbs: any = {} // 钩子函数

  const { modules, nodeOps } = backend // 模块,节点操作
  // 遍历hooks,并将hooks中的钩子函数添加到cbs中
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]])
      }
    }
  }
  /**
   * emptyNodeAt函数，创建一个空节点
   * @param elm 真实dom
   */
  function emptyNodeAt(elm) {
    return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
  }

  /**
   * createRmCb函数，创建一个文本节点
   * @param childElm 真实dom
   * @param listeners 监听器
   */
  function createRmCb(childElm, listeners) {
    function remove() {
      if (--remove.listeners === 0) {
        removeNode(childElm)
      }
    }
    remove.listeners = listeners
    return remove
  }

  /**
   * removeNode函数，删除节点
   * @param el dom元素
   */
  function removeNode(el) {
    const parent = nodeOps.parentNode(el)
    // element may have already been removed due to v-html / v-text
    if (isDef(parent)) {
      nodeOps.removeChild(parent, el)
    }
  }

  /**
   * isUnknownElement函数，判断是否为原生HTML或只是普通文本，则返回true，否则返回false
   * @param vnode 虚拟节点
   * @param inVPre 是否存在v-pre指令
   */
  function isUnknownElement(vnode, inVPre) {
    return (
      !inVPre &&
      !vnode.ns &&
      !(
        config.ignoredElements.length &&
        config.ignoredElements.some(ignore => {
          return isRegExp(ignore)
            ? ignore.test(vnode.tag)
            : ignore === vnode.tag
        })
      ) &&
      config.isUnknownElement(vnode.tag)
    )
  }

  let creatingElmInVPre = 0 // 创建节点的数量
  /**
   * createElm函数，如果是组件,则创建组件实例,插入到父节点中,并返回该组件实例,
   * 如果是文本节点,则创建文本节点,插入到父节点中,并返回该文本节点
   * @param vnode 虚拟节点
   * @param insertedVnodeQueue 插入节点队列
   * @param parentElm 父节点
   * @param refElm 参考节点
   * @param nested 是否嵌套
   * @param ownerArray 父节点的子节点数组
   * @param index 父节点的子节点数组的索引
   */
  function createElm(
    vnode, // 虚拟节点
    insertedVnodeQueue, // 插入节点队列
    parentElm?: any, // 父节点
    refElm?: any, // 参考节点
    nested?: any, // 是否嵌套
    ownerArray?: any, // 父节点的子节点数组
    index?: any // 父节点的子节点数组的索引
  ) {
    // 如果存在elm,并且存在父节点的子节点数组，则将该节点插入到父节点的子节点数组中
    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // This vnode was used in a previous render!
      // now it's used as a new node, overwriting its elm would cause
      // potential patch errors down the road when it's used as an insertion
      // reference node. Instead, we clone the node on-demand before creating
      // associated DOM element for it.
      vnode = ownerArray[index] = cloneVNode(vnode)
    }

    vnode.isRootInsert = !nested // for transition enter check
    // 如果是组件,则创建组件实例,插入到父节点中,并返回该组件实例
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }

    const data = vnode.data
    const children = vnode.children
    const tag = vnode.tag
    // 如果存在tag，则创建节点，并插入到父节点中
    if (isDef(tag)) {
      // 如果是开发环境
      if (__DEV__) {
        // 如果存在v-pre指令，则创建节点，并插入到父节点中
        if (data && data.pre) {
          creatingElmInVPre++
        }
        // 如果是未知元素，则报错
        if (isUnknownElement(vnode, creatingElmInVPre)) {
          warn(
            'Unknown custom element: <' +
              tag +
              '> - did you ' +
              'register the component correctly? For recursive components, ' +
              'make sure to provide the "name" option.',
            vnode.context
          )
        }
      }
      // 如果不存在命名空间，则创建节点，并插入到父节点中
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode)
      setScope(vnode)

      createChildren(vnode, children, insertedVnodeQueue)
      // 如果存在data，则调用create钩子函数，并插入到父节点中
      if (isDef(data)) {
        invokeCreateHooks(vnode, insertedVnodeQueue)
      }
      insert(parentElm, vnode.elm, refElm)
      // 如果是开发环境，并且存在v-pre指令，则创建节点，并插入到父节点中
      if (__DEV__ && data && data.pre) {
        creatingElmInVPre--
      }
    } else if (isTrue(vnode.isComment)) {
      // 如果是注释节点，则创建注释节点，并插入到父节点中
      vnode.elm = nodeOps.createComment(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    } else {
      // 如果是文本节点，则创建文本节点，并插入到父节点中
      vnode.elm = nodeOps.createTextNode(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    }
  }

  /**
   * createComponent函数，如果是组件,则创建组件实例,并插入到父节点中,并返回该组件实例,
   * 如果是文本节点,则创建文本节点,并插入到父节点中,并返回该文本节点
   * @param vnode 虚拟节点
   * @param insertedVnodeQueue 插入节点队列
   * @param parentElm 父节点
   * @param refElm 参考节点
   */
  function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
      if (isDef((i = i.hook)) && isDef((i = i.init))) {
        i(vnode, false /* hydrating */)
      }
      // after calling the init hook, if the vnode is a child component
      // it should've created a child instance and mounted it. the child
      // component also has set the placeholder vnode's elm.
      // in that case we can just return the element and be done.
      if (isDef(vnode.componentInstance)) {
        initComponent(vnode, insertedVnodeQueue)
        insert(parentElm, vnode.elm, refElm)
        if (isTrue(isReactivated)) {
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
        }
        return true
      }
    }
  }
  /**
   * initComponent函数，初始化组件,并插入到父节点中,并返回该组件实例
   * @param vnode 虚拟节点
   * @param insertedVnodeQueue 插入节点队列
   */
  function initComponent(vnode, insertedVnodeQueue) {
    if (isDef(vnode.data.pendingInsert)) {
      insertedVnodeQueue.push.apply(
        insertedVnodeQueue,
        vnode.data.pendingInsert
      )
      vnode.data.pendingInsert = null
    }
    vnode.elm = vnode.componentInstance.$el
    if (isPatchable(vnode)) {
      invokeCreateHooks(vnode, insertedVnodeQueue)
      setScope(vnode)
    } else {
      // empty component root.
      // skip all element-related modules except for ref (#3455)
      registerRef(vnode)
      // make sure to invoke the insert hook
      insertedVnodeQueue.push(vnode)
    }
  }

  /**
   * reactivateComponent函数，重新激活组件,并插入到父节点中,并返回该组件实例
   * @param  vnode 虚拟节点
   * @param insertedVnodeQueue 插入节点队列
   * @param parentElm 父节点
   * @param refElm 参考节点
   */
  function reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
    let innerNode = vnode
    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode
      if (isDef((i = innerNode.data)) && isDef((i = i.transition))) {
        for (i = 0; i < cbs.activate.length; ++i) {
          cbs.activate[i](emptyNode, innerNode)
        }
        insertedVnodeQueue.push(innerNode)
        break
      }
    }
    // unlike a newly created component,
    // a reactivated keep-alive component doesn't insert itself
    insert(parentElm, vnode.elm, refElm)
  }

  /**
   * insert函数，插入节点
   * @param parent 父节点
   * @param elm 节点
   * @param ref 参考节点
   */
  function insert(parent, elm, ref) {
    if (isDef(parent)) { // 如果父节点存在
      if (isDef(ref)) { // 如果参考节点存在
        if (nodeOps.parentNode(ref) === parent) { // 如果参考节点的父节点等于父节点
          nodeOps.insertBefore(parent, elm, ref) // 在参考节点前插入节点
        }
      } else { // 如果参考节点不存在
        nodeOps.appendChild(parent, elm) // 在父节点中插入节点
      }
    }
  }

  /**
   * createChildren函数，创建子节点,并插入到父节点中
   * @param vnode 虚拟节点
   * @param children 子节点
   * @param insertedVnodeQueue 插入节点队列
   */
  function createChildren(vnode, children, insertedVnodeQueue) {
    if (isArray(children)) { // 如果子节点是数组
      if (__DEV__) { // 如果是开发环境
        checkDuplicateKeys(children) // 检查子节点的key是否重复
      }
      for (let i = 0; i < children.length; ++i) { // 遍历子节点,并创建子节点,并插入到父节点中
        createElm(
          children[i],
          insertedVnodeQueue,
          vnode.elm,
          null,
          true,
          children,
          i
        )
      }
    } else if (isPrimitive(vnode.text)) { // 如果子节点是原始值,则创建文本节点,并插入到父节点中
      nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(String(vnode.text)))
    }
  }

  /**
   * isPatchable函数，判断是否为原生HTML或只是普通文本
   * @param  vnode 虚拟节点
   */
  function isPatchable(vnode) {
    while (vnode.componentInstance) { // 如果是组件,则返回组件的根节点
      vnode = vnode.componentInstance._vnode
    }
    return isDef(vnode.tag)
  }

  /**
   * invokeCreateHooks函数，调用create钩子函数,并插入到父节点中
   * @param vnode 虚拟节点
   * @param insertedVnodeQueue 插入节点队列
   */
  function invokeCreateHooks(vnode, insertedVnodeQueue) {
    for (let i = 0; i < cbs.create.length; ++i) { // 遍历create钩子函数
      cbs.create[i](emptyNode, vnode)
    }
    i = vnode.data.hook // Reuse variable // 重用变量
    if (isDef(i)) { // 如果存在hook
      if (isDef(i.create)) i.create(emptyNode, vnode) // 调用create钩子函数
      if (isDef(i.insert)) insertedVnodeQueue.push(vnode) // 如果存在insert钩子函数,则插入到父节点中
    }
  }
  /**
   * setScope函数，为作用域CSS设置作用域id属性,这是作为一种特殊情况实现的,以避免经过正常的属性修补过程的开销。
   * 如果存在作用域id,设置作用域id,如果不存在作用域id,获取祖先节点,遍历祖先节点,如果存在作用域id,设置作用域id
   * @param vnode 虚拟节点
   **/
  function setScope(vnode) {
    let i
    if (isDef((i = vnode.fnScopeId))) {
      nodeOps.setStyleScope(vnode.elm, i)
    } else {
      let ancestor = vnode //
      while (ancestor) { //
        if (isDef((i = ancestor.context)) && isDef((i = i.$options._scopeId))) {
          nodeOps.setStyleScope(vnode.elm, i)
        }
        ancestor = ancestor.parent
      }
    }
    // for slot content they should also get the scopeId from the host instance.
    // 如果是插槽内容,它们还应该从主机实例获取scopeId。
    if (
      isDef((i = activeInstance)) &&
      i !== vnode.context &&
      i !== vnode.fnContext &&
      isDef((i = i.$options._scopeId))
    ) {
      nodeOps.setStyleScope(vnode.elm, i)
    }
  }
  // 添加节点,并调用insert钩子函数
  /**
   * addVnodes函数，添加节点,并调用insert钩子函数
   * @param parentElm 父节点
   * @param refElm 参考节点
   * @param vnodes 虚拟节点列表
   * @param startIdx 开始索引
   * @param endIdx 结束索引
   * @param insertedVnodeQueue 插入节点队列
   */
  function addVnodes(
    parentElm,
    refElm,
    vnodes,
    startIdx,
    endIdx,
    insertedVnodeQueue
  ) {
    for (; startIdx <= endIdx; ++startIdx) {
      createElm(
        vnodes[startIdx],
        insertedVnodeQueue,
        parentElm,
        refElm,
        false,
        vnodes,
        startIdx
      )
    }
  }
  /**
   * invokeDestroyHook函数，调用destroy钩子函数,并删除节点
   * @param vnode 虚拟节点
   **/
  function invokeDestroyHook(vnode) {
    let i, j
    const data = vnode.data
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.destroy))) i(vnode)
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
    }
    if (isDef((i = vnode.children))) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j])
      }
    }
  }

  /**
   * removeVnodes函数，删除节点
   * @param vnodes 虚拟节点
   * @param startIdx 开始索引
   * @param endIdx 结束索引
   */
  function removeVnodes(vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx]
      if (isDef(ch)) {
        if (isDef(ch.tag)) {
          removeAndInvokeRemoveHook(ch)
          invokeDestroyHook(ch)
        } else {
          // Text node
          removeNode(ch.elm)
        }
      }
    }
  }

  /**
   * removeAndInvokeRemoveHook函数，删除节点,并调用remove钩子函数
   * @param vnode 虚拟节点
   * @param rm 删除回调函数
   */
  function removeAndInvokeRemoveHook(vnode, rm?: any) {
    if (isDef(rm) || isDef(vnode.data)) {
      let i
      const listeners = cbs.remove.length + 1
      // 如果存在rm,增加监听器计数,如果不存在rm,创建一个删除回调函数
      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        rm.listeners += listeners
      } else {
        // directly removing
        rm = createRmCb(vnode.elm, listeners)
      }
      // recursively invoke hooks on child component root node
      // 如果存在组件实例并并存在组件实例的根节点，并存在组件实例的根节点的data，则递归调用删除节点,并调用remove钩子函数
      if (
        isDef((i = vnode.componentInstance)) &&
        isDef((i = i._vnode)) &&
        isDef(i.data)
      ) {
        removeAndInvokeRemoveHook(i, rm)
      }
      // 遍历remove钩子函数,并调用remove钩子函数
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm)
      }
      // 如果存在remove钩子函数,则调用remove钩子函数，如果不存在rm,并且不存在vnode.data,则删除节点
      i(vnode, rm)
      if (isDef((i = vnode.data.hook)) && isDef((i = i.remove))) {
      } else {
        rm()
      }
    } else {
      removeNode(vnode.elm)
    }
  }

  /**
   * updateChildren函数，更新子节点
   * @param parentElm 父节点
   * @param oldCh 旧子节点
   * @param newCh 新子节点
   * @param insertedVnodeQueue 插入节点队列
   * @param removeOnly 是否只删除
   */
  function updateChildren(
    parentElm,
    oldCh,
    newCh,
    insertedVnodeQueue,
    removeOnly
  ) {
    let oldStartIdx = 0 // 旧开始节点的索引
    let newStartIdx = 0 // 新开始节点的索引
    let oldEndIdx = oldCh.length - 1 // 旧结束节点的索引
    let oldStartVnode = oldCh[0] // 旧开始节点
    let oldEndVnode = oldCh[oldEndIdx] // 旧结束节点
    let newEndIdx = newCh.length - 1 // 新结束节点的索引
    let newStartVnode = newCh[0] // 新开始节点
    let newEndVnode = newCh[newEndIdx] // 新结束节点
    let oldKeyToIdx, idxInOld, vnodeToMove, refElm // 旧子节点的key到旧子节点的索引的映射,旧子节点的索引,旧子节点,参考节点

    const canMove = !removeOnly // 是否可以移动
    // 如果是开发环境，检查子节点的key是否重复
    if (__DEV__) {
      checkDuplicateKeys(newCh)
    }
    // 如果旧开始节点的索引小于等于旧结束节点的索引，并且新开始节点的索引小于等于新结束节点的索引，则遍历子节点
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (isUndef(oldStartVnode)) { // 如果旧开始节点不存在，则旧开始节点向后移动一位
        oldStartVnode = oldCh[++oldStartIdx]
      } else if (isUndef(oldEndVnode)) { // 如果旧结束节点不存在，则旧结束节点向前移动一位
        oldEndVnode = oldCh[--oldEndIdx]
      } else if (sameVnode(oldStartVnode, newStartVnode)) {  // 如果旧开始节点和新开始节点相同，则更新旧开始节点
        patchVnode(
          oldStartVnode,
          newStartVnode,
          insertedVnodeQueue,
          newCh,
          newStartIdx
        )
        oldStartVnode = oldCh[++oldStartIdx]
        newStartVnode = newCh[++newStartIdx]
      } else if (sameVnode(oldEndVnode, newEndVnode)) {  // 如果旧结束节点和新结束节点相同，则更新旧结束节点
        patchVnode(
          oldEndVnode,
          newEndVnode,
          insertedVnodeQueue,
          newCh,
          newEndIdx
        )
        oldEndVnode = oldCh[--oldEndIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // 如果旧开始节点和新结束节点相同，则更新旧开始节点
        // Vnode moved right
        patchVnode(
          oldStartVnode,
          newEndVnode,
          insertedVnodeQueue,
          newCh,
          newEndIdx
        )
        canMove &&
          nodeOps.insertBefore(
            parentElm,
            oldStartVnode.elm,
            nodeOps.nextSibling(oldEndVnode.elm)
          )
        oldStartVnode = oldCh[++oldStartIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // 如果旧结束节点和新开始节点相同，则更新旧结束节点
        // Vnode moved left
        patchVnode(
          oldEndVnode,
          newStartVnode,
          insertedVnodeQueue,
          newCh,
          newStartIdx
        )
        canMove &&
          nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
        oldEndVnode = oldCh[--oldEndIdx]
        newStartVnode = newCh[++newStartIdx]
      } else { // 如果旧开始节点和新开始节点不相同，则遍历旧子节点，找到与新开始节点相同的节点，如果找到，则更新该节点，如果没找到，则创建新节点
        if (isUndef(oldKeyToIdx)) // 如果旧子节点的key不存在，则创建旧子节点的key到旧子节点的索引的映射
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)
        idxInOld = isDef(newStartVnode.key)
          ? oldKeyToIdx[newStartVnode.key]
          : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx)
        if (isUndef(idxInOld)) { // 如果没找到，则创建新节点
          // New element
          createElm(
            newStartVnode,
            insertedVnodeQueue,
            parentElm,
            oldStartVnode.elm,
            false,
            newCh,
            newStartIdx
          )
        } else { // 如果找到，则更新该节点
          vnodeToMove = oldCh[idxInOld]
          if (sameVnode(vnodeToMove, newStartVnode)) { // 如果找到的节点与新开始节点相同，则更新该节点
            patchVnode(
              vnodeToMove,
              newStartVnode,
              insertedVnodeQueue,
              newCh,
              newStartIdx
            )
            oldCh[idxInOld] = undefined
            canMove &&
              nodeOps.insertBefore(
                parentElm,
                vnodeToMove.elm,
                oldStartVnode.elm
              )
          } else { // 如果找到的节点与新开始节点不相同，则创建新节点
            // same key but different element. treat as new element
            createElm(
              newStartVnode,
              insertedVnodeQueue,
              parentElm,
              oldStartVnode.elm,
              false,
              newCh,
              newStartIdx
            )
          }
        }
        newStartVnode = newCh[++newStartIdx]
      }
    }
    if (oldStartIdx > oldEndIdx) { // 如果旧开始节点大于旧结束节点，则添加节点
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
      addVnodes(
        parentElm,
        refElm,
        newCh,
        newStartIdx,
        newEndIdx,
        insertedVnodeQueue
      )
    } else if (newStartIdx > newEndIdx) { // 如果新开始节点大于新结束节点，则删除节点
      removeVnodes(oldCh, oldStartIdx, oldEndIdx)
    }
  }

  /**
   * checkDuplicateKeys函数，检查子节点的key是否重复，如果重复，则报错
   * @param children 子节点
   */
  function checkDuplicateKeys(children) {
    const seenKeys = {}
    for (let i = 0; i < children.length; i++) {
      const vnode = children[i]
      const key = vnode.key
      if (isDef(key)) {
        if (seenKeys[key]) {
          warn(
            `Duplicate keys detected: '${key}'. This may cause an update error.`,
            vnode.context
          )
        } else {
          seenKeys[key] = true
        }
      }
    }
  }

  /**
   * findIdxInOld函数，在旧子节点中找到与新开始节点相同的节点的索引，如果找到，则返回该索引，如果没找到，则返回undefined
   * @param node 新开始节点
   * @param oldCh 旧子节点
   * @param start 开始索引
   * @param end 结束索引
   */
  function findIdxInOld(node, oldCh, start, end) {
    for (let i = start; i < end; i++) {
      const c = oldCh[i]
      if (isDef(c) && sameVnode(node, c)) return i
    }
  }

  /**
   * patchVnode函数，更新节点
   * @param oldVnode 旧节点
   * @param vnode 新节点
   * @param insertedVnodeQueue 插入节点队列
   * @param ownerArray 父节点的子节点数组
   * @param index 父节点的子节点数组的索引
   * @param removeOnly 是否只删除
   */
  function patchVnode(
    oldVnode,
    vnode,
    insertedVnodeQueue,
    ownerArray,
    index,
    removeOnly?: any
  ) {
    if (oldVnode === vnode) { // 如果旧节点和新节点相同，则返回
      return
    }

    if (isDef(vnode.elm) && isDef(ownerArray)) { // 如果新节点存在elm，并且父节点存在，则克隆新节点
      // clone reused vnode
      vnode = ownerArray[index] = cloneVNode(vnode)
    }

    const elm = (vnode.elm = oldVnode.elm)

    if (isTrue(oldVnode.isAsyncPlaceholder)) { // 如果旧节点是异步占位符，则设置新节点为异步占位符
      if (isDef(vnode.asyncFactory.resolved)) { // 如果新节点的异步工厂已经解析，则调用hydrate函数
        hydrate(oldVnode.elm, vnode, insertedVnodeQueue)
      } else { // 如果新节点的异步工厂没有解析，则设置新节点为异步占位符
        vnode.isAsyncPlaceholder = true
      }
      return
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    // 如果新节点是静态节点，并且旧节点是静态节点，并且新节点的key等于旧节点的key，并且新节点是克隆节点或者是v-once节点，则设置新节点的静态节点的elm为旧节点的静态节点的elm，并返回
    if (
      isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
      vnode.componentInstance = oldVnode.componentInstance
      return
    }

    let i
    const data = vnode.data
    // 如果新节点存在hook，并且存在prepatch钩子函数，则调用prepatch钩子函数
    if (isDef(data) && isDef((i = data.hook)) && isDef((i = i.prepatch))) {
      i(oldVnode, vnode)
    }

    const oldCh = oldVnode.children
    const ch = vnode.children
    // 如果新节点存在data，并且是可修补的，则调用update钩子函数
    if (isDef(data) && isPatchable(vnode)) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
      // 如果新节点存在hook，并且存在update钩子函数，则调用update钩子函数
      if (isDef((i = data.hook)) && isDef((i = i.update))) i(oldVnode, vnode)
    }
    // 如果新节点不存在文本节点
    if (isUndef(vnode.text)) {
      // 如果旧子节点存在，并且新子节点存在，则更新子节点
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) // 如果旧子节点不等于新子节点，则更新子节点
          updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
      } else if (isDef(ch)) {
        // 如果旧子节点不存在，并且新子节点存在，则添加子节点
        if (__DEV__) {
          // 如果是开发环境，检查子节点的key是否重复
          checkDuplicateKeys(ch)
        }
        // 如果旧节点存在文本节点，则设置旧节点的文本节点为空
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
      } else if (isDef(oldCh)) {
        // 如果旧子节点存在，并且新子节点不存在，则删除子节点
        removeVnodes(oldCh, 0, oldCh.length - 1)
      } else if (isDef(oldVnode.text)) {
        // 如果旧节点存在文本节点，则设置旧节点的文本节点为空
        nodeOps.setTextContent(elm, '')
      }
    } else if (oldVnode.text !== vnode.text) {
      // 如果旧节点的文本节点不等于新节点的文本节点，则设置旧节点的文本节点为新节点的文本节点
      nodeOps.setTextContent(elm, vnode.text)
    }
    // 如果新节点存在data，并且存在postpatch钩子函数，则调用postpatch钩子函数
    if (isDef(data)) {
      // 如果新节点存在data，并且存在postpatch钩子函数，则调用postpatch钩子函数
      if (isDef((i = data.hook)) && isDef((i = i.postpatch))) i(oldVnode, vnode)
    }
  }

  /**
   * invokeInsertHook函数，调用insert钩子函数
   * @param vnode 虚拟节点
   * @param queue 插入节点队列
   * @param initial 是否初始的
   */
  function invokeInsertHook(vnode, queue, initial) {
    // delay insert hooks for component root nodes, invoke them after the
    // element is really inserted
    // 如果是初始的，并且存在父节点，则将vnode插入到父节点中
    if (isTrue(initial) && isDef(vnode.parent)) {
      vnode.parent.data.pendingInsert = queue
    } else {
      // 如果不是初始的，则遍历queue，将vnode插入到父节点中
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i])
      }
    }
  }

  let hydrationBailed = false // 是否跳过hydration

  // 创建一个map，包含attrs,class,staticClass,staticStyle,key
  const isRenderedModule = makeMap('attrs,class,staticClass,staticStyle,key')

  /**
   * hydrate函数，判断节点是否匹配
   * @param elm 节点
   * @param vnode 虚拟节点
   * @param insertedVnodeQueue 插入节点队列
   * @param inVPre 是否在v-pre中
   */
  function hydrate(elm, vnode, insertedVnodeQueue, inVPre?: boolean) {
    let i
    const { tag, data, children } = vnode
    inVPre = inVPre || (data && data.pre)
    vnode.elm = elm
    // 如果是注释节点，并且存在异步工厂，则设置异步占位符为true
    if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
      vnode.isAsyncPlaceholder = true
      return true
    }
    // assert node match
    // 如果是开发环境，断言节点匹配
    if (__DEV__) {
      // 如果节点不匹配，则返回false
      if (!assertNodeMatch(elm, vnode, inVPre)) {
        return false
      }
    }
    // 如果存在data
    if (isDef(data)) {
      // 如果存在hook，并且存在init钩子函数，则调用init钩子函数
      if (isDef((i = data.hook)) && isDef((i = i.init)))
        i(vnode, true /* hydrating */)
      // 如果存在组件实例
      if (isDef((i = vnode.componentInstance))) {
        // child component. it should have hydrated its own tree.
        initComponent(vnode, insertedVnodeQueue)
        return true
      }
    }
    // 如果存在标签
    if (isDef(tag)) {
      // 如果存在子节点
      if (isDef(children)) {
        // empty element, allow client to pick up and populate children
        // 如果节点没有子节点，则创建子节点，并插入到父节点中
        if (!elm.hasChildNodes()) {
          createChildren(vnode, children, insertedVnodeQueue)
        } else {
          // 如果节点有子节点，则获取子节点
          // v-html and domProps: innerHTML
          if (
            isDef((i = data)) && // 如果存在data
            isDef((i = i.domProps)) && // 如果存在domProps
            isDef((i = i.innerHTML)) // 如果存在innerHTML
          ) {
            // 如果存在innerHTML，则判断innerHTML是否等于子节点的文本节点
            if (i !== elm.innerHTML) {
              /* istanbul ignore if */
              // 如果是开发环境，则打印警告信息
              if (
                __DEV__ &&
                typeof console !== 'undefined' &&
                !hydrationBailed
              ) {
                hydrationBailed = true
                console.warn('Parent: ', elm)
                console.warn('server innerHTML: ', i)
                console.warn('client innerHTML: ', elm.innerHTML)
              }
              return false
            }
          } else {
            // 如果不存在innerHTML，则创建子节点，并插入到父节点中
            // iterate and compare children lists
            let childrenMatch = true
            let childNode = elm.firstChild
            for (let i = 0; i < children.length; i++) {
              if (
                !childNode ||
                !hydrate(childNode, children[i], insertedVnodeQueue, inVPre)
              ) {
                childrenMatch = false
                break
              }
              childNode = childNode.nextSibling
            }
            // if childNode is not null, it means the actual childNodes list is
            // longer than the virtual children list.
            if (!childrenMatch || childNode) {
              // 如果子节点不匹配，则返回false
              /* istanbul ignore if */
              if (
                __DEV__ &&
                typeof console !== 'undefined' &&
                !hydrationBailed
              ) {
                // 如果是开发环境，则打印警告信息
                hydrationBailed = true
                console.warn('Parent: ', elm)
                console.warn(
                  'Mismatching childNodes vs. VNodes: ',
                  elm.childNodes,
                  children
                )
              }
              return false
            }
          }
        }
      }
      // 如果存在data，并且存在invokeCreateHooks函数，则调用invokeCreateHooks函数
      if (isDef(data)) {
        let fullInvoke = false
        for (const key in data) {
          if (!isRenderedModule(key)) {
            fullInvoke = true
            invokeCreateHooks(vnode, insertedVnodeQueue)
            break
          }
        }
        // 如果不是完整调用，则调用create钩子函数
        if (!fullInvoke && data['class']) {
          // ensure collecting deps for deep class bindings for future updates
          traverse(data['class'])
        }
      }
    } else if (elm.data !== vnode.text) {
      // 如果不存在标签，并且节点的data不等于节点的文本节点，则设置节点的data为节点的文本节点
      elm.data = vnode.text
    }
    return true
  }

  /**
   * assertNodeMatch函数，断言节点匹配
   * @param node 节点
   * @param vnode 虚拟节点
   * @param inVPre 是否在v-pre中
   */
  function assertNodeMatch(node, vnode, inVPre) {
    // 如果存在标签，则判断标签是否相同
    if (isDef(vnode.tag)) {
      return (
        vnode.tag.indexOf('vue-component') === 0 ||
        (!isUnknownElement(vnode, inVPre) &&
          vnode.tag.toLowerCase() ===
            (node.tagName && node.tagName.toLowerCase()))
      )
    } else {
      // 如果不存在标签，则判断节点是否为注释节点
      return node.nodeType === (vnode.isComment ? 8 : 3)
    }
  }

  /**
   * patch函数，用于更新节点，
   * 如果旧节点不存在，则创建新节点，
   * 如果旧节点存在，则更新旧节点，
   * 如果新节点不存在，则删除旧节点，
   * 如果旧节点不存在，并且新节点存在，则插入新节点，
   * 如果旧节点存在，并且新节点不存在，则删除旧节点
   * @param oldVnode 旧节点
   * @param vnode 新节点
   * @param hydrating
   * @param removeOnly
   */
  return function patch(oldVnode, vnode, hydrating, removeOnly) {
    // 如果新节点不存在，则删除旧节点
    if (isUndef(vnode)) {
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
      return
    }

    let isInitialPatch = false
    const insertedVnodeQueue: any[] = []
    // 如果旧节点不存在
    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      isInitialPatch = true
      createElm(vnode, insertedVnodeQueue)
    } else {
      // 如果旧节点存在，并且旧节点是真实节点
      const isRealElement = isDef(oldVnode.nodeType)
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // 如果旧节点不是真实节点，并且旧节点和新节点相同，则更新旧节点
        // patch existing root node
        patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly)
      } else {
        // 如果旧节点是真实节点，则创建空节点，并替换旧节点
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.

          // 如果旧节点是元素节点，并且旧节点存在SSR_ATTR属性，则删除SSR_ATTR属性，并设置hydrating为true
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR)
            hydrating = true
          }
           // 如果hydrating为true，则调用hydrate函数，并返回旧节点
          if (isTrue(hydrating)) {
            // 如果hydrate函数返回true，则调用invokeInsertHook函数，并返回旧节点
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              invokeInsertHook(vnode, insertedVnodeQueue, true)
              return oldVnode
            } else if (__DEV__) {
              // 如果是开发环境，则打印警告信息
              warn(
                'The client-side rendered virtual DOM tree is not matching ' +
                  'server-rendered content. This is likely caused by incorrect ' +
                  'HTML markup, for example nesting block-level elements inside ' +
                  '<p>, or missing <tbody>. Bailing hydration and performing ' +
                  'full client-side render.'
              )
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it
          oldVnode = emptyNodeAt(oldVnode) // 创建空节点
        }

        // replacing existing element
        const oldElm = oldVnode.elm // 获取旧节点的真实节点
        const parentElm = nodeOps.parentNode(oldElm) // 获取旧节点的父节点

        // create new node
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm)
        ) // 创建新节点，并插入到父节点中

        // update parent placeholder node element, recursively
        // 如果新节点存在父节点，则更新父节点的占位符节点的真实节点
        if (isDef(vnode.parent)) {
          let ancestor = vnode.parent
          const patchable = isPatchable(vnode)
          // 遍历祖先节点，更新祖先节点的占位符节点的真实节点，并调用create钩子函数
          while (ancestor) {
            for (let i = 0; i < cbs.destroy.length; ++i) {
              cbs.destroy[i](ancestor)
            }
            ancestor.elm = vnode.elm
            // 如果新节点是可修补的，则调用create钩子函数
            if (patchable) {
              for (let i = 0; i < cbs.create.length; ++i) {
                cbs.create[i](emptyNode, ancestor)
              }
              // #6513
              // invoke insert hooks that may have been merged by create hooks.
              // e.g. for directives that uses the "inserted" hook.
              const insert = ancestor.data.hook.insert
              // 如果存在insert钩子函数，则调用insert钩子函数
              if (insert.merged) {
                // start at index 1 to avoid re-invoking component mounted hook
                // clone insert hooks to avoid being mutated during iteration.
                // e.g. for customed directives under transition group.
                const cloned = insert.fns.slice(1)
                for (let i = 0; i < cloned.length; i++) {
                  cloned[i]()
                }
              }
            } else {
               // 如果新节点不是可修补的，则调用create钩子函数
              registerRef(ancestor)
            }
            ancestor = ancestor.parent // 获取祖先节点
          }
        }

        // destroy old node
        // 如果旧节点存在父节点，则删除旧节点
        if (isDef(parentElm)) {
          removeVnodes([oldVnode], 0, 0)
        } else if (isDef(oldVnode.tag)) {
          // 如果旧节点存在标签，则调用destroy钩子函数
          invokeDestroyHook(oldVnode)
        }
      }
    }

    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch) // 调用insert钩子函数
    return vnode.elm // 返回新节点
  }
}
