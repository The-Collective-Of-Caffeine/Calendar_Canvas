$ErrorActionPreference = "Stop"

function Invoke-NpmScript {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory = $true)]
    [string]$ScriptName
  )

  Push-Location $WorkingDirectory
  try {
    & npm.cmd run $ScriptName
    exit $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

function Copy-ProjectFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
  )

  $destinationDir = Split-Path -Parent $DestinationPath
  if (-not (Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir | Out-Null
  }

  Copy-Item -Force $SourcePath $DestinationPath
}

function Get-FileSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath
  )

  $stream = [System.IO.File]::OpenRead($FilePath)
  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha256.ComputeHash($stream)
      return ([System.BitConverter]::ToString($hashBytes)).Replace("-", "")
    } finally {
      $sha256.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$localBin = Join-Path $projectRoot "node_modules\.bin\concurrently.cmd"

if (Test-Path $localBin) {
  Remove-Item Env:CALENDAR_CANVAS_SOURCE_ROOT -ErrorAction SilentlyContinue
  Write-Host "Using local dependencies in $projectRoot"
  Invoke-NpmScript -WorkingDirectory $projectRoot -ScriptName "dev:stack"
}

$shadowRoot = Join-Path $env:LOCALAPPDATA "CalendarCanvasDev"
$shadowPackageJson = Join-Path $shadowRoot "package.json"
$shadowSrc = Join-Path $shadowRoot "src"
$shadowMarker = Join-Path $shadowRoot ".deps-ready"

Write-Host "Local dependencies are incomplete on this drive."
Write-Host "Falling back to a shadow dev folder at $shadowRoot"

if (-not (Test-Path $shadowRoot)) {
  New-Item -ItemType Directory -Path $shadowRoot | Out-Null
}

$filesToCopy = @(
  "package.json",
  "index.html",
  "tsconfig.json",
  "tsconfig.main.json",
  "vite.config.ts",
  "README.md",
  "scripts\watch-main.js",
  "scripts\clear-ready.js"
)

foreach ($relativePath in $filesToCopy) {
  Copy-ProjectFile `
    -SourcePath (Join-Path $projectRoot $relativePath) `
    -DestinationPath (Join-Path $shadowRoot $relativePath)
}

if (Test-Path $shadowSrc) {
  cmd /c "rmdir /s /q `"$shadowSrc`"" | Out-Null
}

cmd /c "mklink /J `"$shadowSrc`" `"$($projectRoot)\src`"" | Out-Null

$packageHash = Get-FileSha256 -FilePath $shadowPackageJson
$previousHash = if (Test-Path $shadowMarker) { Get-Content $shadowMarker -Raw } else { "" }
$shadowBin = Join-Path $shadowRoot "node_modules\.bin\concurrently.cmd"

if (-not (Test-Path $shadowBin) -or $packageHash -ne $previousHash) {
  Write-Host "Installing dependencies into shadow folder..."

  Push-Location $shadowRoot
  try {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }

  Set-Content -Path $shadowMarker -Value $packageHash -NoNewline
}

$env:CALENDAR_CANVAS_SOURCE_ROOT = $projectRoot
Invoke-NpmScript -WorkingDirectory $shadowRoot -ScriptName "dev:stack"
