# dsh-skills 一键安装脚本（user-dsh，rank 400：<dshHome>/skills）
# 用法：irm https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-dsh.ps1 | iex
#       或本地执行：.\install-dsh.ps1 [-Skill dsh-hermes-plugin]
# DSH_HOME 未设置时回退到 %USERPROFILE%\.dsh
# 安全顺序：先下载解压到临时暂存区，校验成功后才替换目标（失败不影响已有安装）
param(
    [string]$Skill = "dsh-hermes-plugin"
)

$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 默认协议栈可能不含 TLS 1.2，GitHub 强制要求
if ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12 -eq 0) {
    [Net.ServicePointManager]::SecurityProtocol += [Net.SecurityProtocolType]::Tls12
}

$dshHome = $env:DSH_HOME
if (-not $dshHome) { $dshHome = Join-Path $env:USERPROFILE ".dsh" }
$dest = Join-Path $dshHome "skills\$Skill"
$destDir = Split-Path $dest
$tmp = Join-Path ([IO.Path]::GetTempPath()) "dsh-skills-$([guid]::NewGuid().ToString('N'))"

Write-Host "[dsh-skills] 目标：$dest"

New-Item -ItemType Directory -Force -Path $destDir, $tmp | Out-Null

try {
    Write-Host "[dsh-skills] 下载 main 分支压缩包…"
    Invoke-WebRequest "https://github.com/qianmang1/dsh-skills/archive/refs/heads/main.tar.gz" -OutFile "$tmp\repo.tar.gz"

    Write-Host "[dsh-skills] 解压到暂存区…"
    tar -xzf "$tmp\repo.tar.gz" -C $tmp --strip-components=2 "dsh-skills-main/skills/$Skill"
    $staged = Join-Path $tmp $Skill
    if (-not (Test-Path (Join-Path $staged "SKILL.md"))) {
        throw "暂存区未找到 $Skill/SKILL.md，压缩包内容异常"
    }

    if (Test-Path $dest) {
        $backup = "$dest.bak-$(Get-Date -Format yyyyMMddHHmmss)"
        Move-Item $dest $backup
        Write-Host "[dsh-skills] 已存在，旧版本备份至 $backup"
    }
    Move-Item $staged $dest
}
finally {
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
}

Write-Host "[dsh-skills] 完成，已安装到：$dest"
Get-ChildItem -Name (Join-Path $dshHome "skills")
