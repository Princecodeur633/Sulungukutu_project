# Generation des PNG UML — sulungukutu
# Prerequisites : Java 11+ et Graphviz (dot) deja presents sur cette machine.
# Usage :  powershell -ExecutionPolicy Bypass -File .\generer-png.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$pumlDir = Join-Path $root "puml"
$outDir = $root
$toolsDir = Join-Path $root "tools"
$jar = Join-Path $toolsDir "plantuml.jar"
$dot = "C:\Program Files\Graphviz\bin\dot.exe"

New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

if (-not (Test-Path $jar)) {
    Write-Host "Telechargement de PlantUML 1.2026.6..."
    Invoke-WebRequest `
        -Uri "https://github.com/plantuml/plantuml/releases/download/v1.2026.6/plantuml-1.2026.6.jar" `
        -OutFile $jar `
        -UseBasicParsing
}

if (-not (Test-Path $dot)) {
    $dotCmd = Get-Command dot -ErrorAction SilentlyContinue
    if ($dotCmd) { $dot = $dotCmd.Source } else { throw "Graphviz (dot.exe) introuvable." }
}

Write-Host "Java :"
java -version
Write-Host "Graphviz : $dot"
Write-Host "PlantUML : $jar"
Write-Host "Sources  : $pumlDir"
Write-Host ""

$files = Get-ChildItem -Path $pumlDir -Filter "*.puml" | Where-Object { $_.Name -ne "_theme.puml" }
foreach ($f in $files) {
    Write-Host ">>> $($f.Name)"
    & java -Djava.awt.headless=true -jar $jar `
        -charset UTF-8 `
        -tpng `
        -graphvizdot $dot `
        -o $outDir `
        $f.FullName
    if ($LASTEXITCODE -ne 0) { throw "Echec de generation : $($f.Name)" }
}

Write-Host ""
Write-Host "PNG generes dans $outDir :"
Get-ChildItem -Path $outDir -Filter "*.png" | ForEach-Object { Write-Host ("  {0,-45} {1,8:N0} Ko" -f $_.Name, ($_.Length/1KB)) }
