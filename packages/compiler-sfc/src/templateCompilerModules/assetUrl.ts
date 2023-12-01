// vue compiler module for transforming `<tag>:<attribute>` to `require`

import { urlToRequire } from './utils'
import { ASTNode, ASTAttr } from 'types/compiler'

export interface AssetURLOptions {
  [name: string]: string | string[]
}

export interface TransformAssetUrlsOptions {
  /**
   * If base is provided, instead of transforming relative asset urls into
   * imports, they will be directly rewritten to absolute urls.
   */
  base?: string
  /**
   * If true, also processes absolute urls.
   */
  includeAbsolute?: boolean
}

const defaultOptions: AssetURLOptions = {
  audio: 'src',
  video: ['src', 'poster'],
  source: 'src',
  img: 'src',
  image: ['xlink:href', 'href'],
  use: ['xlink:href', 'href']
}

export default (
  userOptions?: AssetURLOptions,
  transformAssetUrlsOption?: TransformAssetUrlsOptions
) => {
  const options = userOptions
    ? Object.assign({}, defaultOptions, userOptions)
    : defaultOptions

  return {
    postTransformNode: (node: ASTNode) => {
      transform(node, options, transformAssetUrlsOption)
    }
  }
}

/**
 * 将URL转换为绝对路径或相对路径。
 * @param node - AST节点
 * @param options - URL配置项
 * @param transformAssetUrlsOption - 转换的配置项
 */
function transform(
  node: ASTNode,
  options: AssetURLOptions,
  transformAssetUrlsOption?: TransformAssetUrlsOptions
) {
  if (node.type !== 1 || !node.attrs) return
  for (const tag in options) {
    if (tag === '*' || node.tag === tag) {
      const attributes = options[tag]
      if (typeof attributes === 'string') {
        node.attrs!.some(attr =>
          rewrite(attr, attributes, transformAssetUrlsOption)
        )
      } else if (Array.isArray(attributes)) {
        attributes.forEach(item =>
          node.attrs!.some(attr =>
            rewrite(attr, item, transformAssetUrlsOption)
          )
        )
      }
    }
  }
}

/**
 * 重写属性
 * @param attr - 属性
 * @param name - 名称
 * @param transformAssetUrlsOption - 转换的配置项
 */
function rewrite(
  attr: ASTAttr,
  name: string,
  transformAssetUrlsOption?: TransformAssetUrlsOptions
) {
  if (attr.name === name) {
    const value = attr.value
    // only transform static URLs
    if (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      attr.value = urlToRequire(value.slice(1, -1), transformAssetUrlsOption)
      return true
    }
  }
  return false
}
