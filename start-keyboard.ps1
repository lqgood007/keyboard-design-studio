# ============================================================
#  Keyboard Design Studio 一键启动脚本
#  用法（在项目根目录）:
#    powershell -ExecutionPolicy Bypass -File .\start-keyboard.ps1
#    powershell -ExecutionPolicy Bypass -File .\start-keyboard.ps1 -ServiceOnly   # 只起本机服务，不开外网隧道
#  说明:
#    - 自动启动后端服务(http://localhost:3001)，已运行则复用
#    - 自动启动 cloudflared 免费隧道，解析并打印公网 URL
#    - 窗口前台保持；按 Ctrl+C 退出时自动关闭隧道（本机服务保留运行）
#  升级固定域名（免费）:
#    方案A Tailscale Funnel(免费固定域名 https://<host>.<net>.ts.net):
#      1. 注册 https://login.tailscale.com 免费账号，本机装 Tailscale 并登录
#      2. tailscale funnel 3001        # 一条命令把 3001 暴露为固定公网域名
#    方案B Cloudflare 固定隧道(需自有域名, .top 首年约 10~30 元):
#      cloudflared tunnel login 后创建 named tunnel，绑定自己的域名
# ============================================================
param(
  [switch]$ServiceOnly   # 只启动本机服务，不建外网隧道
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfExe = Join-Path $env:LOCALAPPDATA 'cloudflared\cloudflared.exe'
$cfLog = Join-Path $root '.tunnel.log'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "    $msg" -ForegroundColor Green }

# ---------- 1. 确保后端服务运行 ----------
Write-Step '检查后端服务 (localhost:3001)'
$listening = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
  Write-Ok "服务已在运行 (PID $($listening.OwningProcess))，复用"
} else {
  Write-Step '启动后端服务 (node backend/src/server.js)'
  Start-Process -FilePath 'node' -ArgumentList 'backend/src/server.js' `
    -WorkingDirectory $root -WindowStyle Hidden
  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) { $ok = $true; break }
  }
  if (-not $ok) { Write-Host '!! 后端服务启动失败（请检查 node 是否安装 / 端口占用）' -ForegroundColor Red; exit 1 }
  Write-Ok '后端服务已启动'
}
Write-Ok "本机访问: http://localhost:3001"

# ---------- 2. 启动外网隧道 ----------
if ($ServiceOnly) {
  Write-Ok 'ServiceOnly 模式，跳过外网隧道'
} else {
  if (-not (Test-Path $cfExe)) {
    Write-Host "!! 未找到 cloudflared ($cfExe)，请先下载:" -ForegroundColor Red
    Write-Host "   Invoke-WebRequest -Uri https://ghfast.top/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile `"$cfExe`"" -ForegroundColor Yellow
    exit 1
  }

  # 清掉残留的旧隧道日志与进程
  Remove-Item $cfLog -Force -ErrorAction SilentlyContinue
  Remove-Item "$cfLog.err" -Force -ErrorAction SilentlyContinue
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

  Write-Step '启动 cloudflared 隧道 (映射 localhost:3001)'
  Start-Process -FilePath $cfExe -ArgumentList 'tunnel','--url','http://localhost:3001','--no-autoupdate' `
    -WindowStyle Hidden -RedirectStandardOutput $cfLog -RedirectStandardError "$cfLog.err"

  # 轮询日志直到拿到公网 URL（cloudflared 日志输出在 stderr）
  $url = $null
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    foreach ($log in @($cfLog, "$cfLog.err")) {
      if (Test-Path $log) {
        $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue
        if ($m) { $url = $m.Matches[0].Value; break }
      }
    }
    if ($url) { break }
  }
  if (-not $url) {
    Write-Host '!! 隧道 URL 未在 30 秒内出现，日志：' -ForegroundColor Red
    foreach ($log in @($cfLog, "$cfLog.err")) { if (Test-Path $log) { Get-Content $log -Tail 15 } }
    exit 1
  }
  Write-Ok "公网访问: $url"
  Write-Ok '按 Ctrl+C 退出本脚本（自动关闭隧道；本机服务保留）'
}

# ---------- 3. 前台保持，等待 Ctrl+C ----------
try {
  while ($true) { Start-Sleep -Seconds 3600 }
} finally {
  if (-not $ServiceOnly) {
    Write-Step '退出：关闭 cloudflared 隧道'
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
  }
  Write-Ok '脚本已退出（本机服务 localhost:3001 仍在运行）'
}
