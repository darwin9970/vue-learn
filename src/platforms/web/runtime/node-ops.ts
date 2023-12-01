import VNode from 'core/vdom/vnode'
import { namespaceMap } from 'web/util/index'

/**
 * 创建元素，
 * 如果是select元素，需要设置multiple属性
 * @param tagName
 * @param vnode
 */
export function createElement(tagName: string, vnode: VNode): Element {
  const elm = document.createElement(tagName)
  if (tagName !== 'select') {
    return elm
  }
  // false or null will remove the attribute but undefined will not
  if (
    vnode.data && // 如果有data
    vnode.data.attrs && // 如果有attrs
    vnode.data.attrs.multiple !== undefined // 如果multiple不是undefined
  ) {
    // 设置multiple属性
    elm.setAttribute('multiple', 'multiple')
  }
  return elm
}

/**
 * 创建命名空间元素
 * @param namespace - 命名空间
 * @param tagName - 标签名
 */
export function createElementNS(namespace: string, tagName: string): Element {
  return document.createElementNS(namespaceMap[namespace], tagName)
}

/**
 * 创建文本节点
 * @param text - 文本
 */
export function createTextNode(text: string): Text {
  return document.createTextNode(text)
}

/**
 * 创建注释节点
 * @param text - 注释
 */
export function createComment(text: string): Comment {
  return document.createComment(text)
}

/**
 * 插入节点
 * @param parentNode - 父节点
 * @param newNode - 新节点
 * @param referenceNode - 参考节点
 */
export function insertBefore(
  parentNode: Node,
  newNode: Node,
  referenceNode: Node
) {
  parentNode.insertBefore(newNode, referenceNode)
}

/**
 * 移除节点
 * @param node - 节点
 * @param child - 子节点
 */
export function removeChild(node: Node, child: Node) {
  node.removeChild(child)
}

/**
 * 添加子节点
 * @param node - 节点
 * @param child - 子节点
 */
export function appendChild(node: Node, child: Node) {
  node.appendChild(child)
}

/**
 * 获取父节点
 * @param node - 节点
 */
export function parentNode(node: Node) {
  return node.parentNode
}

/**
 * 获取下一个兄弟节点
 * @param node - 节点
 */
export function nextSibling(node: Node) {
  return node.nextSibling
}

/**
 * 获取标签名
 * @param node - 节点
 */
export function tagName(node: Element): string {
  return node.tagName
}

/**
 * 设置文本内容
 * @param node - 节点
 * @param text - 文本
 */
export function setTextContent(node: Node, text: string) {
  node.textContent = text
}

/**
 * 设置属性
 * @param node - 节点
 * @param scopeId - 作用域id
 */
export function setStyleScope(node: Element, scopeId: string) {
  node.setAttribute(scopeId, '')
}
