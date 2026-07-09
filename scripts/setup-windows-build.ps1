#Requires -Version 5.1
<#
.SYNOPSIS
  Windows 本地 Tauri 开发：检测 OpenSSL 并设置 OPENSSL_DIR / OPENSSL_LIB_DIR。

.EXAMPLE
  .\scripts\setup-windows-build.ps1
  .\scripts\setup-windows-build.ps1 -TauriDev
  .\scripts\setup-windows-build.ps1 -InstallIfMissing
#>
param(
    [switch]$TauriDev,
    [switch]$InstallIfMissing,
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
    if ([string]::IsNullOrWhiteSpace($Dir)) { return $false }
    $hasHeaders = Test-Path (Join-Path $Dir "include\openssl\ssl.h")
    $libDir = Get-OpenSslLibDir -Dir $Dir
    return $hasHeaders -and ($null -ne $libDir)
}

function Get-OpenSslDirFromRegistry {
    $regKeys = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OpenSSL (64-bit)_is1",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\OpenSSL (64-bit)_is1"
    )
    foreach ($key in $regKeys) {
        if (-not (Test-Path $key)) { continue }
        $props = Get-ItemProperty $key -ErrorAction SilentlyContinue
        foreach ($candidate in @($props.'Inno Setup: App Path', $props.InstallLocation)) {
            if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
            $dir = $candidate.TrimEnd('\')
            if (Test-OpenSslInstall $dir) { return $dir }
        }
    }
    return $null
}

function Get-OpenSslDirFromPath {
    foreach ($dllName in @("libssl-4-x64.dll", "libssl-3-x64.dll")) {
        $dll = Get-Command $dllName -ErrorAction SilentlyContinue
        if ($null -eq $dll) { continue }
        $dir = Split-Path (Split-Path $dll.Source)
        if (Test-OpenSslInstall $dir) { return $dir }
    }
    return $null
}

function Find-OpenSslDevDir {
    param([string[]]$PreferredPaths)

    $fromRegistry = Get-OpenSslDirFromRegistry
    if ($fromRegistry) { return $fromRegistry }

    $fromPath = Get-OpenSslDirFromPath
    if ($fromPath) { return $fromPath }

    foreach ($path in $PreferredPaths) {
        if (Test-OpenSslInstall $path) { return $path }
    }
    return $null
}

function Refresh-ShellPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Invoke-WingetOpenSslDevInstall {
    param([switch]$Force)

    $wingetArgs = @(
        "install", "--id", "ShiningLight.OpenSSL.Dev",
        "--exact", "--source", "winget",
        "--accept-package-agreements", "--accept-source-agreements",
        "--disable-interactivity", "--no-upgrade"
    )
    if ($Force) { $wingetArgs += "--force" }

    $ProgressPreference = "SilentlyContinue"
    $log = & winget @wingetArgs 2>&1
    $text = $log | Out-String
    if ($LASTEXITCODE -ne 0) {
        # winget 在包已存在时也可能返回非零（https://github.com/microsoft/winget-cli/issues/4262）
        if ($text -notmatch "already installed") {
            $log | Out-Host
            throw "winget install failed with exit code $LASTEXITCODE"
        }
        Write-Host "OpenSSL Dev 已安装（winget 跳过重复安装）" -ForegroundColor Yellow
    }
}

function Install-OpenSslDev {
    Write-Host "Installing OpenSSL Dev via winget (ShiningLight.OpenSSL.Dev)..." -ForegroundColor Cyan
    Invoke-WingetOpenSslDevInstall
}

function Wait-ForOpenSslDevDir {
    param([string[]]$PreferredPaths)

    Refresh-ShellPath
    for ($attempt = 1; $attempt -le 6; $attempt++) {
        $dir = Find-OpenSslDevDir -PreferredPaths $PreferredPaths
        if ($dir) { return $dir }
        Write-Host "等待 OpenSSL Dev 文件就绪（$attempt/6）..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
        Refresh-ShellPath
    }
    return $null
}

function Export-OpenSslEnv {
    param([string]$Dir)
    $libDir = Get-OpenSslLibDir -Dir $Dir
    $env:OPENSSL_DIR = $Dir
    $env:OPENSSL_LIB_DIR = $libDir
    Write-Host "OPENSSL_DIR=$Dir"
    Write-Host "OPENSSL_LIB_DIR=$libDir"
    if ($env:GITHUB_ENV) {
        Add-Content -Path $env:GITHUB_ENV -Value "OPENSSL_DIR=$Dir"
        Add-Content -Path $env:GITHUB_ENV -Value "OPENSSL_LIB_DIR=$libDir"
    }
    $binDir = Join-Path $Dir "bin"
    if ((Test-Path $binDir) -and $env:GITHUB_PATH) {
        Add-Content -Path $env:GITHUB_PATH -Value $binDir
    }
}

$preferredPaths = @(
    $OpenSslDir,
    "C:\Program Files\OpenSSL-Win64",
    "C:\Program Files\OpenSSL",
    "C:\OpenSSL-Win64",
    "C:\OpenSSL"
) | Select-Object -Unique

$resolvedDir = Find-OpenSslDevDir -PreferredPaths $preferredPaths

if (-not $resolvedDir) {
    if ($InstallIfMissing) {
        Install-OpenSslDev
        $resolvedDir = Wait-ForOpenSslDevDir -PreferredPaths $preferredPaths
        if (-not $resolvedDir) {
            Write-Host "首次安装后仍未检测到 Dev 文件，尝试 winget --force 重装..." -ForegroundColor Yellow
            Invoke-WingetOpenSslDevInstall -Force
            $resolvedDir = Wait-ForOpenSslDevDir -PreferredPaths $preferredPaths
        }
    } else {
        Write-Host @"
未找到 OpenSSL Dev（已检查常见路径与注册表）。

请一次性安装 **Dev 版**（含头文件；Light 版无法编译 SQLCipher）：
  winget install ShiningLight.OpenSSL.Dev

或若已装 Light，可改装 Dev：
  winget install ShiningLight.OpenSSL.Dev

安装完成后重新打开终端，再运行本脚本。
"@ -ForegroundColor Yellow
        exit 1
    }
}

if (-not $resolvedDir) {
    $checked = $preferredPaths -join ', '
    Write-Error "OpenSSL Dev 安装不完整，未找到头文件或 libcrypto.lib。已检查路径：$checked。请确认安装 ShiningLight.OpenSSL.Dev（非 Light 版）。"
}

Export-OpenSslEnv -Dir $resolvedDir

if ($TauriDev) {
    Set-Location (Join-Path $PSScriptRoot "..")
    pnpm tauri dev
}
