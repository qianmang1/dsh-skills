#!/usr/bin/env node
// dsh-project-init 生成器：为目标项目生成与官方 deepseek-harness 同构的 Agent 规则骨架。
// 用法：node init.mjs <目标目录> [--domain <域名前缀>] [--name <项目名>]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const skillRoot = dirname(here)
const templatesDir = join(skillRoot, 'templates')

const LIFECYCLES = ['proposed', 'implemented', 'rejected', 'archived']
const CLASSES = ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing']
const SKILLS = [
  ['pre-push-checks', 'skill-pre-push-checks.md'],
  ['code-review', 'skill-code-review.md'],
  ['archive-agent-notes', 'skill-archive-agent-notes.md'],
  ['doc', 'skill-doc.md'],
]

// ---- 参数 ----
const argv = process.argv.slice(2)
const positional = []
const opts = {}
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--domain' || a === '--name') { opts[a.slice(2)] = argv[++i] ?? ''; continue }
  positional.push(a)
}
const targetRaw = positional[0]
if (!targetRaw) {
  console.error('用法：node init.mjs <目标目录> [--domain <域名前缀>] [--name <项目名>]')
  process.exit(2)
}
const target = resolve(targetRaw)
const sanitize = (s) => (String(s).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'project')
const name = opts.name ?? basename(target)
const domain = sanitize(opts.domain ?? name)

if (!existsSync(target)) mkdirSync(target, { recursive: true })

// ---- 边界：不覆盖已有 AGENTS.md ----
if (existsSync(join(target, 'AGENTS.md'))) {
  console.error('中止：目标已有 AGENTS.md（' + join(target, 'AGENTS.md') + '）。dsh-project-init 不覆盖已有规则，请手工合并。')
  process.exit(1)
}

const subst = (text) => text.split('{{PROJECT_NAME}}').join(name).split('{{DOMAIN}}').join(domain)
const tmpl = (f) => readFileSync(join(templatesDir, f), 'utf8')
const write = (rel, content) => {
  const p = join(target, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content)
}

// ---- 骨架文件 ----
write('AGENTS.md', subst(tmpl('AGENTS.md')))
write('.agents/skills/README.md', subst(tmpl('skills-README.md')))
write('.agents/notes/README.md', subst(tmpl('notes-README.md')))
write('.agents/notes/implemented/AGENTS.md', subst(tmpl('notes-implemented-AGENTS.md')))
write('scripts/check.mjs', subst(tmpl('scripts-check.mjs')))
write('scripts/README.md', subst(tmpl('scripts-README.md')))

// ---- 项目技能（域名前缀） ----
for (const [suffix, file] of SKILLS) {
  write('.agents/skills/' + domain + '-' + suffix + '/SKILL.md', subst(tmpl(file)))
}

// ---- 决策记录分类目录（空骨架用 .gitkeep 占位） ----
for (const lc of LIFECYCLES) {
  for (const c of CLASSES) {
    write('.agents/notes/' + lc + '/' + c + '/.gitkeep', '')
  }
}

// ---- 输出生成树 ----
console.log('已生成：' + target + '（project=' + name + ', domain=' + domain + '）')
const printTree = (d, prefix) => {
  const entries = readdirSync(d, { withFileTypes: true })
    .filter((e) => e.name !== '.gitkeep')
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
  entries.forEach((e, i) => {
    const last = i === entries.length - 1
    console.log(prefix + (last ? '└─ ' : '├─ ') + e.name + (e.isDirectory() ? '/' : ''))
    if (e.isDirectory()) printTree(join(d, e.name), prefix + (last ? '   ' : '│  '))
  })
}
printTree(target, '')

// ---- 生成后自检（stdio 直通，交由调用方观察） ----
const check = spawnSync(process.execPath, [join(target, 'scripts', 'check.mjs'), target], { stdio: 'inherit' })
process.exit(check.status ?? 1)
