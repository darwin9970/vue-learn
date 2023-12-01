import { addProp } from 'compiler/helpers'
import { ASTDirective, ASTElement } from 'types/compiler'

/**
 * 处理text指令，添加textContent属性
 * @param el - 元素
 * @param dir - 指令
 */
export default function text(el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'textContent', `_s(${dir.value})`, dir)
  }
}
