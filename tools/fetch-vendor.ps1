# 获取 three.js 本地 vendor 文件（three.core.js / three.module.js）
# 用法：powershell -ExecutionPolicy Bypass -File tools\fetch-vendor.ps1
# 说明：仓库不直接内嵌大文件（GitHub 单文件友好），首次 clone 后执行本脚本即可恢复前端 3D 依赖。
# 来源：unpkg CDN（three npm 包 build 目录），与前端 import '../vendor/three.module.js' 对应。
$ErrorActionPreference = 'Stop'
$Vendor = Join-Path $PSScriptRoot '..\frontend\public\vendor'
New-Item -ItemType Directory -Force -Path $Vendor | Out-Null

$Base = 'https://unpkg.com/three@0.169.0/build'
$Files = @('three.module.js', 'three.core.js')
foreach ($f in $Files) {
    $url = "$Base/$f"
    $out = Join-Path $Vendor $f
    Write-Host "下载 $url -> $out"
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    Write-Host ("OK {0}  {1:N0} bytes" -f $f, (Get-Item $out).Length)
}
Write-Host '完成：three.js 本地 vendor 已就绪'
