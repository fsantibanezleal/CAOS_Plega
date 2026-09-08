$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv/Scripts/python.exe'
$entry = Join-Path $PSScriptRoot 'project.py'
if (Test-Path -LiteralPath $python) {
    & $python $entry 'dev' @args
} else {
    & py -3.13 $entry 'dev' @args
}
exit $LASTEXITCODE
