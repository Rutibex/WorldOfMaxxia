param([switch]$Publish, [string]$Runtime = 'win-x64')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
Push-Location $workspace
try {
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Install the .NET 10 SDK to build Maxxia Maker.' }
    if ($Publish) {
        dotnet publish editor/MaxxiaMaker.WinForms/MaxxiaMaker.WinForms.csproj -c Release -r $Runtime --self-contained true -o "artifacts/editor-$Runtime" --disable-build-servers -m:1
        if ($LASTEXITCODE -ne 0) { throw "Editor publish failed ($LASTEXITCODE)." }
        New-Item -ItemType Directory -Force -Path "artifacts/editor-$Runtime/docs" | Out-Null
        Copy-Item docs/* "artifacts/editor-$Runtime/docs/" -Recurse -Force
        Copy-Item README.md "artifacts/editor-$Runtime/README.md" -Force
    } else {
        dotnet build editor/MaxxiaMaker.sln -c Release --disable-build-servers -m:1
        if ($LASTEXITCODE -ne 0) { throw "Editor build failed ($LASTEXITCODE)." }
    }
} finally { Pop-Location }
