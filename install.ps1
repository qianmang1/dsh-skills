# dsh-skills 一键安装脚本（user-dsh，rank 400：<dshHome>/skills）
# 用法：irm https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install.ps1 | iex
#       或本地执行：.\install.ps1 [-Skill dsh-hermes-plugin]
# DSH_HOME 未设置时回退到 %USERPROFILE%\.dsh
param(
    [string]$Skill = "dsh-hermes-plugin"
)

$ErrorActionPreference = "Stop"

$dshHome = $env:DSH_HOME
if (-not $dshHome) { $dshHome = Join-Path $env:USERPROFILE ".dsh" }
$dest = Join-Path $dshHome "skills\$Skill"
$destDir = Split-Path $dest
$tmp = Join-Path ([IO.Path]::GetTempPath()) "dsh-skills-$([guid]::NewGuid().ToString('N'))"

Write-Host "[dsh-skills] 目标：$dest"

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
if (Test-Path $dest) {
    $backup = "$dest.bak-$(Get-Date -Format yyyyMMddHHmmss)"
    Move-Item $dest $backup
    Write-Host "[dsh-skills] 已存在，旧版本备份至 $backup"
}

try {
    Write-Host "[dsh-skills] 下载 main 分支压缩包…"
    Invoke-WebRequest "https://github.com/qianmang1/dsh-skills/archive/refs/heads/main.tar.gz" -OutFile "$tmp.tgz"
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    Move-Item "$tmp.tgz" "$tmp\repo.tar.gz"

    Write-Host "[dsh-skills] 解压…"
    tar -xzf "$tmp\repo.tar.gz" -C $destDir --strip-components=2 "dsh-skills-main/skills/$Skill"
}
finally {
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    if (Test-Path "$tmp.tgz") { Remove-Item -Force "$tmp.tgz" }
}

Write-Host "[dsh-skills] 完成，已安装到：$dest"
Get-ChildItem -Name (Join-Path $dshHome "skills")
