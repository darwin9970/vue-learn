import VNode from '../vnode'

/**
 * 判断是否是注释节点且有异步工厂函数
 * @param node - 虚拟节点
 */
export function isAsyncPlaceholder(node: VNode): boolean {
  // @ts-expect-error not really boolean type
  return node.isComment && node.asyncFactory
}
