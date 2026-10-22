$ErrorActionPreference = 'Stop'
$taskDocker = Get-Command docker -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if (-not $taskDocker -and $env:OS -eq 'Windows_NT') {
    foreach ($taskCandidate in @(
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe",
        "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe"
    )) {
        if (Test-Path -LiteralPath $taskCandidate) { $taskDocker = $taskCandidate; break }
    }
}
if (-not $taskDocker) { throw 'Install Docker Desktop with WSL2 support first.' }
$taskOriginalPath = $env:PATH
$env:PATH = (Split-Path -Parent $taskDocker) + [System.IO.Path]::PathSeparator + $env:PATH

function Invoke-Compose {
    & $taskDocker compose @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed: $args" }
}

Push-Location (Join-Path $PSScriptRoot '..\..')
try {
    $taskOs = & $taskDocker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0 -or $taskOs -ne 'linux') { throw 'Start Docker Desktop using Linux containers.' }
    if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
    Invoke-Compose config --quiet
    Invoke-Compose build app
    Invoke-Compose run --rm --user root app composer install --no-interaction --prefer-dist --no-progress
    Invoke-Compose run --rm --user root app sh -c 'chown -R www-data:www-data vendor storage bootstrap/cache'

    $taskConfig = Get-Content -Raw -LiteralPath '.env'
    if ($taskConfig -match '(?m)^APP_KEY=[ \t]*\r?$') {
        $taskKey = Invoke-Compose run --rm app php artisan key:generate --show --no-ansi
        $taskKey = $taskKey | Where-Object { $_ -match '^base64:[A-Za-z0-9+/]+=*$' } | Select-Object -Last 1
        if (-not $taskKey) { throw 'Application key generation failed.' }
        $taskConfig = $taskConfig -replace '(?m)^APP_KEY=[ \t]*\r?$', ('APP_KEY=' + $taskKey)
        [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $taskConfig)
    } elseif ($taskConfig -notmatch '(?m)^APP_KEY=\S+') {
        throw 'Set APP_KEY in the root .env file.'
    }

    # Migrate before workers and the scheduler can query application tables.
    Invoke-Compose run --rm app php artisan migrate --force
    Invoke-Compose up -d --no-build --wait --wait-timeout 600

    $taskDeadline = (Get-Date).AddMinutes(3)
    $taskReady = $false
    while ((Get-Date) -lt $taskDeadline) {
        try {
            $taskApi = Invoke-RestMethod -Uri 'http://localhost:8080/api/ready' -TimeoutSec 5
            $taskFrontend = Invoke-WebRequest -Uri 'http://localhost:8080/sign-in' -UseBasicParsing -TimeoutSec 5
            $taskMail = Invoke-WebRequest -Uri 'http://localhost:8025/livez' -UseBasicParsing -TimeoutSec 5
            if ($taskApi.status -eq 'ok' -and $taskFrontend.Content -match '<div id="root">' -and $taskMail.StatusCode -eq 200) {
                $taskReady = $true
                break
            }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $taskReady) { throw 'Services did not become ready. Inspect docker compose logs.' }
    Write-Host 'HookDesk: http://localhost:8080 | Mailpit: http://localhost:8025'
    Write-Host 'Verify the complete delivery flow: node infra/scripts/smoke.mjs'
} finally {
    $env:PATH = $taskOriginalPath
    Pop-Location
}
