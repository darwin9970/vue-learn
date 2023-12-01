import { addProp } from 'compiler/helpers'
import { ASTDirective, ASTElement } from 'types/compiler'

/**
 * 处理html指令，添加innerHTML属性
 * @param el - 元素
 * @param dir - 指令
 */
export default function html(el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'innerHTML', `_s(${dir.value})`, dir)
  }
}
