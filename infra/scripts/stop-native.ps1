$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskPidFile = Join-Path $taskRoot '.runtime\native-processes.json'
if (-not (Test-Path -LiteralPath $taskPidFile)) { Write-Host 'No recorded native processes.'; return }
$taskRecords = @(Get-Content -Raw -LiteralPath $taskPidFile | ConvertFrom-Json)
foreach ($record in $taskRecords) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $record.started -and $process.Path -eq $record.path) {
        Stop-Process -Id $process.Id
        Write-Host ('Stopped ' + $record.name)
    }
}
Set-Content -LiteralPath $taskPidFile -Value '[]'
