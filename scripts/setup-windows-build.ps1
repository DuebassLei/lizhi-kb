#Requires -Version 5.1
<#
.SYNOPSIS
  Windows 本地 Tauri 开发：检测 OpenSSL 并设置 OPENSSL_DIR / OPENSSL_LIB_DIR。

.EXAMPLE
  .\scripts\setup-windows-build.ps1
  .\scripts\setup-windows-build.ps1 -TauriDev
#>
param(
    [switch]$TauriDev,
    [string]$OpenSslDir = "C:\Program Files\OpenSSL-Win64"
)

$ErrorActionPreference = "Stop"

function Get-OpenSslLibDir {
    param([string]$Dir)
    $legacy = Join-Path $Dir "lib\libcrypto.lib"
    if (Test-Path $legacy) {
        return (Join-Path $Dir "lib")
    }
    $vcMd = Join-Path $Dir "lib\VC\x64\MD\libcrypto.lib"
    if (Test-Path $vcMd) {
        return (Join-Path $Dir "lib\VC\x64\MD")
    }
    return $null
}

function Test-OpenSslInstall {
    param([string]$Dir)
    $hasHeaders = Test-Path (Join-Path $Dir "include\openssl\ssl.h")
    $libDir = Get-OpenSslLibDir -Dir $Dir
    return $hasHeaders -and ($null -ne $libDir)
}

if (-not (Test-OpenSslInstall $OpenSslDir)) {
    Write-Host @"
未找到 OpenSSL（预期路径：$OpenSslDir）。

请一次性安装 **Dev 版**（含头文件；Light 版无法编译 SQLCipher）：
  winget install ShiningLight.OpenSSL.Dev

或若已装 Light，可改装 Dev：
  winget install ShiningLight.OpenSSL.Dev

安装完成后重新打开终端，再运行本脚本。
"@ -ForegroundColor Yellow
    exit 1
}

$libDir = Get-OpenSslLibDir -Dir $OpenSslDir
$env:OPENSSL_DIR = $OpenSslDir
$env:OPENSSL_LIB_DIR = $libDir
Write-Host "OPENSSL_DIR=$OpenSslDir"
Write-Host "OPENSSL_LIB_DIR=$libDir"

if ($TauriDev) {
    Set-Location (Join-Path $PSScriptRoot "..")
    pnpm tauri dev
}