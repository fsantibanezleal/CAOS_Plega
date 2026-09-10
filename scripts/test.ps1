$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv/Scripts/python.exe'
$entry = Join-Path $PSScriptRoot 'project.py'
if (Test-Path -LiteralPath $python) {
    & $python $entry 'test' @args
} else {
    & py -3.13 $entry 'test' @args
}
exit $LASTEXITCODE
