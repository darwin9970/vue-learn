import { makeMap, isBuiltInTag, cached, no } from 'shared/util'
import { ASTElement, CompilerOptions, ASTNode } from 'types/compiler'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
export function optimize(
  root: ASTElement | null | undefined,
  options: CompilerOptions
) {
  if (!root) return // 没有根节点，直接返回
  // 生成静态key
  isStaticKey = genStaticKeysCached(options.staticKeys || '') 
  // 是否是平台保留标签
  isPlatformReservedTag = options.isReservedTag || no 
  // first pass: mark all non-static nodes.
  // 标记静态节点
  markStatic(root) 
  // second pass: mark static roots.
  // 标记静态根节点
  markStaticRoots(root, false) 
}
// 生成静态key
function genStaticKeys(keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
      (keys ? ',' + keys : '')
  )
}
// 标记静态节点
function markStatic(node: ASTNode) {
  // 判断是否是静态节点
  node.static = isStatic(node)
  // 判断是元素节点，遍历子节点，递归调用markStatic
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    // 判断不是保留标签，不是slot标签，没有inline-template属性
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    // 遍历子节点，递归调用markStatic
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      // 如果子节点不是静态节点，那么父节点也不是静态节点
      if (!child.static) { 
        node.static = false
      }
    }
    // 判断条件渲染节点
    if (node.ifConditions) {
      // 从1开始，因为第一个条件渲染节点已经在上面遍历过了
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        // 如果条件渲染节点不是静态节点，那么父节点也不是静态节点
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}
// 标记静态根节点
function markStaticRoots(node: ASTNode, isInFor: boolean) {
  // 判断是否是静态节点，如果是静态节点，判断是否在v-for内，如果在v-for内，设置staticInFor为true，否则为false
  if (node.type === 1) {
    // 如果是静态节点或者v-once指令节点
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    // 如果是静态节点，且有子节点，且子节点不是只有一个文本节点
    if (
      node.static &&
      node.children.length &&
      !(node.children.length === 1 && node.children[0].type === 3)
    ) { 
      node.staticRoot = true
      return
    } else {
      // 如果不是静态节点，或者没有子节点，或者子节点只有一个文本节点
      node.staticRoot = false
    }
    // 遍历子节点，递归调用markStaticRoots
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for) // 如果是v-for节点，isInFor为true，否则为false
      }
    }
    // 判断条件渲染节点，递归调用markStaticRoots
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}
// 判断是否是静态节点
function isStatic(node: ASTNode): boolean {
  // 如果是表达式，不是静态节点
  if (node.type === 2) {
    // expression
    return false
  }
  // 如果是纯文本，是静态节点
  if (node.type === 3) {
    // text
    return true
  }
  return !!( 
    // 如果是元素节点，判断是否是静态节点，
    // 如果是静态节点，判断是否有v-pre指令，
    // 如果有v-pre指令，返回false，否则返回true，
    // 如果不是静态节点，返回false，否则返回true
    node.pre ||
    (!node.hasBindings && // no dynamic bindings
      !node.if &&
      !node.for && // not v-if or v-for or v-else
      !isBuiltInTag(node.tag) && // not a built-in
      isPlatformReservedTag(node.tag) && // not a component
      !isDirectChildOfTemplateFor(node) &&
      Object.keys(node).every(isStaticKey))
  )
}
// 判断是否是直接子节点的template标签，且有v-for指令，如果是，返回true，否则返回false
function isDirectChildOfTemplateFor(node: ASTElement): boolean {
  // 循环向上查找父节点
  while (node.parent) {
    node = node.parent // 父节点
    if (node.tag !== 'template') {
      // 如果不是template标签，返回false
      return false
    }
    if (node.for) {
      // 如果有v-for指令，返回true
      return true
    }
  }
  // 如果没有父节点，返回false
  return false
}
