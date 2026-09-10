$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv/Scripts/python.exe'
$entry = Join-Path $PSScriptRoot 'project.py'
if (Test-Path -LiteralPath $python) {
    & $python $entry 'verify-ui' @args
} else {
    & py -3.13 $entry 'verify-ui' @args
}
exit $LASTEXITCODE
