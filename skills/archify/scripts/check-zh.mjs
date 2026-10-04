#!/usr/bin/env node
// check-zh：校验 archify 候选 JSON 符合"标识符英文、说明中文"双轨策略。
// 命名区（components/nodes/states/participants/steps 的 label、boundaries label、tag）禁中文；
// 叙述区（sublabel/cards/views/connections 的 label 与 note/title 等）语言自由。
// 用法：node check-zh.mjs <候选.json>
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) { console.error('用法：node check-zh.mjs <候选.json>'); process.exit(2) }
const doc = JSON.parse(readFileSync(file, 'utf8'))

// 名字/结构字段：必须保持英文原文（能 grep 到的 token）
const STRUCT = new Set(['id', 'from', 'to', 'variant', 'kind', 'type', 'phase', 'target', 'dot', 'pos', 'size', 'wraps', 'focus', 'schema_version', 'diagram_type', 'output', 'quality_profile', 'preset'])
const NODE_ARR = ['components', 'nodes', 'states', 'participants', 'steps']
const hasCJK = (s) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(s)
const violations = []
const isInNodeArray = (path) => NODE_ARR.some((k) => path.includes('.' + k + '['))

const walk = (node, path) => {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, path + '[' + i + ']')); return }
  for (const [k, v] of Object.entries(node)) {
    const p = path + '.' + k
    if (typeof v === 'string' && hasCJK(v)) {
      const nameField = k === 'label' && (isInNodeArray(p) || p.includes('.boundaries['))
      const tagField = k === 'tag'
      const structField = STRUCT.has(k)
      if (nameField || tagField || structField) violations.push(p + ' = ' + JSON.stringify(v))
    } else if (v && typeof v === 'object') {
      walk(v, p)
    }
  }
}
walk(doc, 'doc')

if (violations.length) {
  console.error('FAIL: ' + violations.length + ' 处名字/结构字段含中文（保留原文以对上代码/文档）')
  for (const v of violations) console.error('  - ' + v)
  console.error('说明字段（sublabel/cards/note/views/connections 标签）语言自由，不受限制')
  process.exit(1)
}
console.log('OK: 名字字段均为原文；说明字段（sublabel/cards/note/连线与视图标签）语言自由')
