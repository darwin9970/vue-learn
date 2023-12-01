import merge from 'merge-source-map'
import { RawSourceMap } from 'source-map'
import { isFunction } from 'shared/util'

export type StylePreprocessor = (
  source: string,
  map: RawSourceMap | undefined,
  options: {
    [key: string]: any
    additionalData?: string | ((source: string, filename: string) => string)
    filename: string
  }
) => StylePreprocessorResults

export interface StylePreprocessorResults {
  code: string
  map?: object
  errors: Error[]
  dependencies: string[]
}

// .scss/.sass processor
/**
 * scss预编译器
 * @param source - scss源码
 * @param map - scss源码的sourcemap
 * @param options - scss编译器的配置项
 */
const scss: StylePreprocessor = (source, map, options) => {
  const nodeSass = require('sass')
  const finalOptions = {
    ...options,
    data: getSource(source, options.filename, options.additionalData),
    file: options.filename,
    outFile: options.filename,
    sourceMap: !!map
  }

  try {
    const result = nodeSass.renderSync(finalOptions)
    const dependencies = result.stats.includedFiles
    if (map) {
      return {
        code: result.css.toString(),
        map: merge(map, JSON.parse(result.map.toString())),
        errors: [],
        dependencies
      }
    }

    return { code: result.css.toString(), errors: [], dependencies }
  } catch (e: any) {
    return { code: '', errors: [e], dependencies: [] }
  }
}
/**
 * sass预编译器
 * @param source - sass源码
 * @param map - sass源码的sourcemap
 * @param options - sass编译器的配置项
 */
const sass: StylePreprocessor = (source, map, options) =>
  scss(source, map, {
    ...options,
    indentedSyntax: true
  })

// .less
/**
 * less预编译器
 * @param source - less源码
 * @param map - less源码的sourcemap
 * @param options - less编译器的配置项
 */
const less: StylePreprocessor = (source, map, options) => {
  const nodeLess = require('less')

  let result: any
  let error: Error | null = null
  nodeLess.render(
    getSource(source, options.filename, options.additionalData),
    { ...options, syncImport: true },
    (err: Error | null, output: any) => {
      error = err
      result = output
    }
  )

  if (error) return { code: '', errors: [error], dependencies: [] }
  const dependencies = result.imports
  if (map) {
    return {
      code: result.css.toString(),
      map: merge(map, result.map),
      errors: [],
      dependencies: dependencies
    }
  }

  return {
    code: result.css.toString(),
    errors: [],
    dependencies: dependencies
  }
}

// .styl
/**
 * stylus预编译器
 * @param source - stylus源码
 * @param map - stylus源码的sourcemap
 * @param options - stylus编译器的配置项
 */
const styl: StylePreprocessor = (source, map, options) => {
  const nodeStylus = require('stylus')
  try {
    const ref = nodeStylus(source)
    Object.keys(options).forEach(key => ref.set(key, options[key]))
    if (map) ref.set('sourcemap', { inline: false, comment: false })

    const result = ref.render()
    const dependencies = ref.deps()
    if (map) {
      return {
        code: result,
        map: merge(map, ref.sourcemap),
        errors: [],
        dependencies
      }
    }

    return { code: result, errors: [], dependencies }
  } catch (e: any) {
    return { code: '', errors: [e], dependencies: [] }
  }
}

/**
 * 获取源码
 * @param source - 源码
 * @param filename - 文件名
 * @param additionalData - 额外的数据
 */
function getSource(
  source: string,
  filename: string,
  additionalData?: string | ((source: string, filename: string) => string)
) {
  if (!additionalData) return source
  if (isFunction(additionalData)) {
    return additionalData(source, filename)
  }
  return additionalData + source
}

export type PreprocessLang = 'less' | 'sass' | 'scss' | 'styl' | 'stylus'

export const processors: Record<PreprocessLang, StylePreprocessor> = {
  less,
  sass,
  scss,
  styl,
  stylus: styl
}
