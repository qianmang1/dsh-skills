#!/usr/bin/env node
// dsh-project-init 自检：SKILL.md frontmatter / examples 完整性 / templates 占位符一致性。
// 用法：node scripts/check.mjs [技能根目录]
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.argv[2] ?? dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '')
const problems = []
const notes = []
const fail = (msg) => problems.push(msg)
const ok = (msg) => notes.push('  OK  ' + msg)
const need = (rel) => join(root, rel)

// ---------- 1. SKILL.md frontmatter ----------
const skillFile = need('SKILL.md')
if (!existsSync(skillFile)) {
  fail('SKILL.md 不存在（这不是 dsh-project-init 技能根）')
  process.exit(1)
}
{
  const text = readFileSync(skillFile, 'utf8')
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fm) { fail('SKILL.md 缺 frontmatter'); process.exit(1) }
  const name = fm[1].match(/^name: (.+)$/m)?.[1]?.trim() ?? ''
  const desc = fm[1].match(/^description: (.+)$/m)?.[1]?.trim() ?? ''
  if (name !== 'dsh-project-init') fail('SKILL.md frontmatter name 须为 dsh-project-init（当前 ' + name + '）')
  if (desc.length < 20 || !/使用|触发|初始化/.test(desc)) fail('SKILL.md description 缺触发词或过短')
  const body = text.replace(/^---[\s\S]*?---/, '')
  for (const sec of ['## 范本位置', '## 步骤', '## 自检', '## 边界']) {
    if (!body.includes(sec)) fail('SKILL.md 缺 ' + sec + ' 节')
  }
  ok('SKILL.md frontmatter 与章节完整')
}

// ---------- 2. 自身脚本与模板 ----------
const REQUIRED = [
  'scripts/init.mjs',
  'templates/AGENTS.md',
  'templates/skills-README.md',
  'templates/notes-README.md',
  'templates/notes-implemented-AGENTS.md',
  'templates/scripts-check.mjs',
  'templates/scripts-README.md',
  'templates/skill-pre-push-checks.md',
  'templates/skill-code-review.md',
  'templates/skill-archive-agent-notes.md',
  'templates/skill-doc.md',
]
for (const p of REQUIRED) {
  if (!existsSync(need(p))) fail('缺 ' + p)
}
ok('scripts/ 与 templates/ 文件齐全')

// ---------- 3. templates 占位符一致性 ----------
const tokens = new Set()
for (const p of REQUIRED.filter((x) => x.startsWith('templates/'))) {
  const text = readFileSync(need(p), 'utf8')
  for (const m of text.matchAll(/\{\{\s*([A-Z_]+)\s*\}\}/g)) tokens.add(m[1])
}
const KNOWN = new Set(['PROJECT_NAME', 'DOMAIN'])
for (const t of tokens) {
  if (!KNOWN.has(t)) fail('templates 使用未知占位符 {{' + t + '}}（应仅在 PROJECT_NAME/DOMAIN 之间）')
}
if (!tokens.has('PROJECT_NAME')) fail('templates 未使用 {{PROJECT_NAME}}')
if (!tokens.has('DOMAIN')) fail('templates 未使用 {{DOMAIN}}（技能名域名前缀）')
ok('templates 占位符均在 {{PROJECT_NAME}}/{{DOMAIN}} 内')

// ---------- 4. examples/official 完整性 ----------
const ex = need('examples/official')
if (!existsSync(ex)) {
  fail('examples/official/ 不存在（官方原文范本缺失）')
  process.exit(1)
}
{
  // 根 AGENTS.md 全文
  const rootAgents = need('examples/official/AGENTS.md')
  if (!existsSync(rootAgents)) {
    fail('examples/official/AGENTS.md 缺失')
  } else {
    const t = readFileSync(rootAgents, 'utf8')
    if (!/^# AGENTS.md/m.test(t)) fail('examples/official/AGENTS.md 不是官方根 AGENTS.md 原文（首行须 # AGENTS.md）')
    if (!t.includes('## Conventions') || !t.includes('## Defensive patterns') || !t.includes('## Type safety')) {
      fail('examples/official/AGENTS.md 缺官方章节（Conventions / Defensive patterns / Type safety）')
    }
    ok('examples/official/AGENTS.md 为官方全文范本')
  }
  // 官方 11 个技能
  const SKILLS = [
    'dsh-archive-agent-notes', 'dsh-ci-test-reliability', 'dsh-code-review', 'dsh-doc',
    'dsh-find-simplifications', 'dsh-merging-stacked-prs', 'dsh-pre-push-checks', 'dsh-prose-standard',
    'dsh-translate-docs', 'dsh-trim-cot-leakage', 'record-browser-gif',
  ]
  const skillsDir = need('examples/official/skills')
  const present = existsSync(skillsDir)
    ? readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
    : []
  for (const s of SKILLS) {
    if (!existsSync(join(skillsDir, s, 'SKILL.md'))) fail('examples/official/skills/' + s + '/SKILL.md 缺失')
  }
  const extra = present.filter((s) => !SKILLS.includes(s))
  if (extra.length) fail('examples/official/skills/ 有意外目录：' + extra.join(', '))
  ok('examples/official/skills/ 覆盖官方 11 个技能原文')
  // notes 体系
  const notesDir = need('examples/official/notes')
  for (const p of ['README.md', 'implemented/AGENTS.md', 'archived/AGENTS.md']) {
    if (!existsSync(join(notesDir, p))) fail('examples/official/notes/' + p + ' 缺失')
  }
  const notesReadme = existsSync(join(notesDir, 'README.md')) ? readFileSync(join(notesDir, 'README.md'), 'utf8') : ''
  if (!/Supersession|supersession/.test(notesReadme)) fail('examples/official/notes/README.md 未见 supersession 检查规则')
  ok('examples/official/notes/ 覆盖 README 规则 / implemented / archived / supersession')
  // verify gates
  const gatesDir = need('examples/official/scripts')
  for (const p of ['agent-note-tree.ts', 'verify-agent-note-format.ts', 'verify-agent-note-classification.ts', 'verify-archived-agent-notes.ts', 'archived-agent-notes.ts']) {
    if (!existsSync(join(gatesDir, p))) fail('examples/official/scripts/' + p + ' 缺失')
  }
  ok('examples/official/scripts/ 覆盖 5 个 verify gates 原文')
}

// ---------- 汇总 ----------
for (const n of notes) console.log(n)
if (problems.length) {
  console.error('FAIL: ' + problems.length + ' 处')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('OK: dsh-project-init 自检通过（frontmatter / 脚本模板 / 占位符 / examples 完整性）')
