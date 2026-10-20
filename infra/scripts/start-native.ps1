$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskRuntime = Join-Path $taskRoot '.runtime'
New-Item -ItemType Directory -Path $taskRuntime -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'backend\.env'))) { throw 'Configure backend/.env first. See docs/runbooks/native-development.md.' }
$taskIni = Join-Path $taskRuntime 'php-conf'
if (Test-Path -LiteralPath (Join-Path $taskIni 'pgsql.ini')) { $env:PHP_INI_SCAN_DIR = $taskIni }
function Test-TaskPort([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try { $pending = $client.ConnectAsync('127.0.0.1', $Port); return ($pending.Wait(300) -and $client.Connected) }
    catch { return $false } finally { $client.Dispose() }
}
$taskPgCtl = Join-Path $taskRuntime 'postgresql\pgsql\bin\pg_ctl.exe'
$taskPgData = Join-Path $taskRuntime 'pgdata'
if ((Test-Path -LiteralPath $taskPgCtl) -and (Test-Path -LiteralPath $taskPgData) -and -not (Test-TaskPort 55432)) {
    $taskArguments = @('-D', ('"' + $taskPgData + '"'), '-l', ('"' + (Join-Path $taskRuntime 'postgres.log') + '"'), '-o', '"-h 127.0.0.1 -p 55432"', '-w', 'start')
    $taskPgProcess = Start-Process -FilePath $taskPgCtl -ArgumentList $taskArguments -WindowStyle Hidden -PassThru -Wait
    if ($taskPgProcess.ExitCode -ne 0) { throw 'Local PostgreSQL startup failed.' }
}
$taskPidFile = Join-Path $taskRuntime 'native-processes.json'
$taskRecords = @()
if (Test-Path -LiteralPath $taskPidFile) {
    $taskRecords = @(Get-Content -Raw -LiteralPath $taskPidFile | ConvertFrom-Json | Where-Object {
        $process = Get-Process -Id $_.id -ErrorAction SilentlyContinue
        $process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $_.started
    })
}
function Start-TaskService([string]$Name,[string]$Executable,[string[]]$Arguments,[string]$Directory,[int]$Port=0,[string]$Role='app') {
    if ($Port -gt 0 -and (Test-TaskPort $Port)) { Write-Host "$Name already has a local listener; leaving it running."; return }
    if ($script:taskRecords | Where-Object { $_.name -eq $Name }) { return }
    $previousRole = $env:APP_ROLE
    try {
        $env:APP_ROLE = $Role
        $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime ($Name + '.out.log')) -RedirectStandardError (Join-Path $taskRuntime ($Name + '.err.log'))
        $script:taskRecords += [pscustomobject]@{name=$Name;id=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o');path=$process.Path}
    } finally { $env:APP_ROLE = $previousRole }
}
$taskPhp = (Get-Command php -ErrorAction Stop).Source
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskBackend = Join-Path $taskRoot 'backend'
Start-TaskService 'api' $taskPhp @('-S','127.0.0.1:8000','-t','public') $taskBackend 8000
Start-TaskService 'receiver' $taskPhp @('-S','127.0.0.1:8001','-t','public') $taskBackend 8001 'receiver'
Start-TaskService 'worker' $taskPhp @('artisan','queue:work','--queue=deliveries,default','--sleep=1','--tries=1') $taskBackend
Start-TaskService 'scheduler' $taskPhp @('artisan','schedule:work') $taskBackend
Start-TaskService 'frontend' $taskNode @('node_modules/vite/bin/vite.js','--host','127.0.0.1') (Join-Path $taskRoot 'frontend') 5173
$taskRecords | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $taskPidFile
Write-Host 'HookDesk: http://localhost:5173 | generated local credentials: .runtime/demo-credentials.txt'
