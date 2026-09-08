# dsh-skills 一键安装脚本（user-dsh，rank 400：<dshHome>/skills）
# 用法：irm https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-dsh.ps1 | iex
#       或本地执行：.\install-dsh.ps1 [-Skill dsh-hermes-plugin]   # -Skill 省略时全量安装
# DSH_HOME 未设置时回退到 %USERPROFILE%\.dsh
# 安全顺序：先下载解压到临时暂存区，校验成功后才替换；内容一致时跳过（不堆积备份）
param(
    [string]$Skill = ""
)

$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 默认协议栈可能不含 TLS 1.2，GitHub 强制要求
if ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12 -eq 0) {
    [Net.ServicePointManager]::SecurityProtocol += [Net.SecurityProtocolType]::Tls12
}

$dshHome = $env:DSH_HOME
if (-not $dshHome) { $dshHome = Join-Path $env:USERPROFILE ".dsh" }
$skillsDir = Join-Path $dshHome "skills"
$tmp = Join-Path ([IO.Path]::GetTempPath()) "dsh-skills-$([guid]::NewGuid().ToString('N'))"
$summary = @{ added = @(); updated = @(); skipped = @() }

Write-Host "[dsh-skills] 目标根：$skillsDir（$(if ($Skill) { "单装 $Skill" } else { "全量安装" })）"
New-Item -ItemType Directory -Force -Path $tmp, $skillsDir | Out-Null

function Test-DirsEqual([string]$a, [string]$b) {
    $fa = Get-ChildItem -Recurse -File $a | ForEach-Object { "{0}|{1}" -f $_.FullName.Substring($a.Length + 1), $_.Length } | Sort-Object
    $fb = Get-ChildItem -Recurse -File $b | ForEach-Object { "{0}|{1}" -f $_.FullName.Substring($b.Length + 1), $_.Length } | Sort-Object
    return (($fa.Count -eq $fb.Count) -and -not (Compare-Object $fa $fb))
}

function Install-One([string]$staged, [string]$dest) {
    $name = Split-Path $dest -Leaf
    if (Test-Path $dest) {
        if (Test-DirsEqual $staged $dest) {
            Write-Host "[dsh-skills] 内容一致，跳过：$name"
            $summary.skipped += $name
            return
        }
        $backup = "$dest.bak-$(Get-Date -Format yyyyMMddHHmmss)"
        Move-Item $dest $backup
        Write-Host "[dsh-skills] 有变化，旧版备份至 $backup，已更新：$name"
        $summary.updated += $name
    }
    else {
        Write-Host "[dsh-skills] 新增：$name"
        $summary.added += $name
    }
    Move-Item $staged $dest
}

try {
    Write-Host "[dsh-skills] 下载 main 分支压缩包…"
    Invoke-WebRequest "https://github.com/qianmang1/dsh-skills/archive/refs/heads/main.tar.gz" -OutFile "$tmp\repo.tar.gz"

    if ($Skill) {
        Write-Host "[dsh-skills] 解压到暂存区…"
        tar -xzf "$tmp\repo.tar.gz" -C $tmp --strip-components=2 "dsh-skills-main/skills/$Skill"
        $staged = Join-Path $tmp $Skill
        if (-not (Test-Path (Join-Path $staged "SKILL.md"))) {
            throw "暂存区未找到 $Skill/SKILL.md，压缩包内容异常"
        }
        Install-One $staged (Join-Path $skillsDir $Skill)
    }
    else {
        Write-Host "[dsh-skills] 解压到暂存区…"
        tar -xzf "$tmp\repo.tar.gz" -C $tmp --strip-components=1 "dsh-skills-main/skills"
        $stageRoot = Join-Path $tmp "skills"
        $entries = Get-ChildItem -Directory $stageRoot
        if (-not $entries) { throw "压缩包内未找到任何技能目录" }
        foreach ($entry in $entries) {
            if (-not (Test-Path (Join-Path $entry.FullName "SKILL.md"))) {
                Write-Host "[dsh-skills] 警告：$($entry.Name) 缺少 SKILL.md，已跳过"
                continue
            }
            Install-One $entry.FullName (Join-Path $skillsDir $entry.Name)
        }
    }
}
finally {
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
}

Write-Host ("[dsh-skills] 摘要：新增 {0}，更新 {1}，跳过 {2}" -f $summary.added.Count, $summary.updated.Count, $summary.skipped.Count)
if ($summary.added.Count)    { Write-Host ("[dsh-skills] 新增：" + ($summary.added -join ", ")) }
if ($summary.updated.Count)  { Write-Host ("[dsh-skills] 更新：" + ($summary.updated -join ", ")) }
