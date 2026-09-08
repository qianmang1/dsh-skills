#!/usr/bin/env node
/**
 * dsh-skills 安装器 CLI（零 npm 依赖）。
 *
 * 用法：
 *   npx github:qianmang1/dsh-skills --target dsh      # 装 user-dsh（rank 400，$DSH_HOME/skills）
 *   npx github:qianmang1/dsh-skills --target agents   # 装 user-agents（rank 500，$AGENTS_HOME/skills）
 *   node bin/dsh-skills.mjs --target dsh [--skill dsh-hermes-plugin]
 *
 * 安全顺序：下载 tarball → 暂存区解压 → 校验 SKILL.md → 备份旧版 → 替换目标。
 * 目标回退：dsh → $DSH_HOME ?? ~/.dsh；agents → $AGENTS_HOME ?? ~/.agents。
 */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const REPO = "qianmang1/dsh-skills";
const TARBALL_URL = `https://github.com/${REPO}/archive/refs/heads/main.tar.gz`;
const TAR_ROOT = "dsh-skills-main";

function parseArgs(argv) {
  const args = { target: "dsh", skill: "dsh-hermes-plugin" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") args.target = argv[++i];
    else if (a === "--skill") args.skill = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
    else throw new Error(`未知参数：${a}`);
  }
  if (!["dsh", "agents"].includes(args.target)) {
    throw new Error(`--target 必须是 dsh 或 agents，收到：${args.target}`);
  }
  if (!/^[\w.-]+$/.test(args.skill)) {
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

function extractTarball(tarball, destDir) {
  // Windows 10+ 内置 bsdtar；Linux/macOS 为 GNU tar，两者都支持 --strip-components
  const proc = spawnSync(
    "tar",
    ["-xzf", tarball, "-C", destDir, "--strip-components=2", `${TAR_ROOT}/skills/${args.skill}`],
    { stdio: "inherit" },
  );
  if (proc.status !== 0) throw new Error(`tar 解压失败（exit ${proc.status}）`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log("用法：dsh-skills [--target dsh|agents] [--skill <名称>]");
  process.exit(0);
}

const home = resolveHome(args.target);
const dest = path.join(home, "skills", args.skill);
const destDir = path.dirname(dest);
const tmp = await mkdtemp(path.join(tmpdir(), "dsh-skills-"));

console.log(`[dsh-skills] 目标：${dest}`);

try {
  console.log("[dsh-skills] 下载 main 分支压缩包…");
  await downloadTarball(path.join(tmp, "repo.tar.gz"));

  console.log("[dsh-skills] 解压到暂存区…");
  await extractTarball(path.join(tmp, "repo.tar.gz"), tmp);

  const staged = path.join(tmp, args.skill);
  let stagedFiles;
  try {
    stagedFiles = await readdir(staged);
  } catch {
    throw new Error(`暂存区未找到 ${args.skill}/，压缩包内容异常`);
  }
  if (!stagedFiles.includes("SKILL.md")) {
    throw new Error(`暂存区未找到 ${args.skill}/SKILL.md，压缩包内容异常`);
  }

  await mkdir(destDir, { recursive: true });
  if (await exists(dest)) {
    const backup = `${dest}.bak-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`;
    await rename(dest, backup);
    console.log(`[dsh-skills] 已存在，旧版本备份至 ${backup}`);
  }
  await rename(staged, dest);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(`[dsh-skills] 完成，已安装到：${dest}`);
console.log(`[dsh-skills] ${home}/skills 现有：`, (await readdir(path.join(home, "skills"))).join(", "));

async function exists(p) {
  try {
    await readdir(p);
    return true;
  } catch {
    return false;
  }
}
