#!/usr/bin/env node
/**
 * dsh-skills 安装器 CLI（零 npm 依赖）。
 *
 * 用法：
 *   npx github:qianmang1/dsh-skills --target dsh      # 全量安装到 user-dsh（rank 400，$DSH_HOME/skills）
 *   npx github:qianmang1/dsh-skills --target agents   # 全量安装到 user-agents（rank 500，$AGENTS_HOME/skills）
 *   npx github:qianmang1/dsh-skills --target dsh --skill dsh-hermes-plugin   # 只装一个
 *
 * 默认全量：把仓库 skills/ 下所有技能装入目标目录（一次下载，逐个校验→备份→替换；
 * 与已装版本内容一致时跳过，避免堆积 .bak 备份）。
 * 目标回退：dsh → $DSH_HOME ?? ~/.dsh；agents → $AGENTS_HOME ?? ~/.agents。
 */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const REPO = "qianmang1/dsh-skills";
const TARBALL_URL = `https://github.com/${REPO}/archive/refs/heads/main.tar.gz`;
const TAR_ROOT = "dsh-skills-main";

function parseArgs(argv) {
  const args = { target: "dsh", skill: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") args.target = argv[++i];
    else if (a === "--skill" || a === "-s") args.skill = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
    else throw new Error(`未知参数：${a}`);
  }
  if (!["dsh", "agents"].includes(args.target)) {
    throw new Error(`--target 必须是 dsh 或 agents，收到：${args.target}`);
  }
  if (args.skill && !/^[\w.-]+$/.test(args.skill)) {
    throw new Error(`--skill 含非法字符：${args.skill}`);
  }
  return args;
}

function resolveHome(target) {
  if (target === "dsh") {
    return process.env.DSH_HOME || path.join(homedir(), ".dsh");
  }
  return process.env.AGENTS_HOME || path.join(homedir(), ".agents");
}

async function downloadTarball(destFile) {
  const res = await fetch(TARBALL_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}（${TARBALL_URL}）`);
  await writeFile(destFile, Buffer.from(await res.arrayBuffer()));
}

function extractTarball(tarball, destDir, components) {
  // Windows 10+ 内置 bsdtar；Linux/macOS 为 GNU tar，两者都支持 --strip-components
  const proc = spawnSync(
    "tar",
    ["-xzf", tarball, "-C", destDir, `--strip-components=${components}`, `${TAR_ROOT}/skills`],
    { stdio: "inherit" },
  );
  if (proc.status !== 0) throw new Error(`tar 解压失败（exit ${proc.status}）`);
}

/** 递归收集 dir 下所有文件的「相对路径 → 字节数」映射，用于轻量一致性对比。 */
async function collectFiles(dir, prefix = "") {
  const map = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const [k, v] of await collectFiles(p, rel)) map.set(k, v);
    } else {
      map.set(rel, (await stat(p)).size);
    }
  }
  return map;
}

async function dirsEqual(a, b) {
  const [fa, fb] = [await collectFiles(a), await collectFiles(b)];
  if (fa.size !== fb.size) return false;
  for (const [k, v] of fa) {
    if (fb.get(k) !== v) return false;
  }
  return true;
}

async function installOne(staged, dest, summary) {
  if (await exists(dest)) {
    if (await dirsEqual(staged, dest)) {
      summary.skipped.push(path.basename(dest));
      console.log(`[dsh-skills] 内容一致，跳过：${path.basename(dest)}`);
      return;
    }
    const backup = `${dest}.bak-${timestamp()}`;
    await rename(dest, backup);
    summary.updated.push(path.basename(dest));
    console.log(`[dsh-skills] 有变化，旧版备份至 ${backup}，已更新：${path.basename(dest)}`);
  } else {
    summary.added.push(path.basename(dest));
    console.log(`[dsh-skills] 新增：${path.basename(dest)}`);
  }
  await rename(staged, dest);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(
    "用法：dsh-skills [--target dsh|agents] [--skill <名称>]\n" +
      "  默认全量安装仓库 skills/ 下所有技能；--skill 指定只装某一个。\n" +
      "  目标：dsh → $DSH_HOME ?? ~/.dsh；agents → $AGENTS_HOME ?? ~/.agents",
  );
  process.exit(0);
}

const home = resolveHome(args.target);
const skillsDir = path.join(home, "skills");
const tmp = await mkdtemp(path.join(tmpdir(), "dsh-skills-"));
const summary = { added: [], updated: [], skipped: [] };

console.log(`[dsh-skills] 目标根：${skillsDir}（${args.skill ? `单装 ${args.skill}` : "全量安装"}）`);

try {
  console.log("[dsh-skills] 下载 main 分支压缩包…");
  await downloadTarball(path.join(tmp, "repo.tar.gz"));

  console.log("[dsh-skills] 解压到暂存区…");
  await mkdir(skillsDir, { recursive: true });
  if (args.skill) {
    extractTarball(path.join(tmp, "repo.tar.gz"), tmp, 2);
    await installOne(path.join(tmp, args.skill), path.join(skillsDir, args.skill), summary);
  } else {
    // --strip-components=1 去掉 tarball 根目录，得到 tmp/skills/<name> 整个子树
    extractTarball(path.join(tmp, "repo.tar.gz"), tmp, 1);
    const stageRoot = path.join(tmp, "skills");
    const entries = (await readdir(stageRoot, { withFileTypes: true })).filter((e) => e.isDirectory());
    if (entries.length === 0) throw new Error("压缩包内未找到任何技能目录");
    for (const entry of entries) {
      const staged = path.join(stageRoot, entry.name);
      if (! (await exists(path.join(staged, "SKILL.md")))) {
        console.log(`[dsh-skills] 警告：${entry.name} 缺少 SKILL.md，已跳过`);
        continue;
      }
      await installOne(staged, path.join(skillsDir, entry.name), summary);
    }
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(
  `[dsh-skills] 摘要：新增 ${summary.added.length}，更新 ${summary.updated.length}，跳过 ${summary.skipped.length}` +
    (summary.added.length ? `；新增：${summary.added.join(", ")}` : "") +
    (summary.updated.length ? `；更新：${summary.updated.join(", ")}` : ""),
);
