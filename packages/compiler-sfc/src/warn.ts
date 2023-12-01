const hasWarned: Record<string, boolean> = {}

/**
 * 警告一次。
 * @param msg - 消息
 */
export function warnOnce(msg: string) {
  const isNodeProd =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
  if (!isNodeProd && !hasWarned[msg]) {
    hasWarned[msg] = true
    warn(msg)
  }
}

/**
 * 警告。
 * @param msg - 消息
 */
export function warn(msg: string) {
  console.warn(
    `\x1b[1m\x1b[33m[@vue/compiler-sfc]\x1b[0m\x1b[33m ${msg}\x1b[0m\n`
  )
}
