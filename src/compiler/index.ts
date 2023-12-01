import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'
import { CompilerOptions, CompiledResult } from 'types/compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile(
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 解析模板字符串，生成抽象语法树
  const ast = parse(template.trim(), options)
  // 优化抽象语法树
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  const code = generate(ast, options) // 生成代码
  return {
    ast, // 抽象语法树
    render: code.render, // 渲染函数
    staticRenderFns: code.staticRenderFns // 静态渲染函数
  }
})
