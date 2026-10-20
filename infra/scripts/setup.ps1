$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop with WSL2 support first.' }
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
docker compose build app
if ($LASTEXITCODE -ne 0) { throw 'Docker build failed.' }
docker compose run --rm --user root app composer install --no-interaction
if ($LASTEXITCODE -ne 0) { throw 'Composer install failed.' }
docker compose run --rm --user root app sh -c 'chown -R www-data:www-data storage bootstrap/cache'
if ($LASTEXITCODE -ne 0) { throw 'Storage permissions could not be prepared.' }
$taskKey = docker compose run --rm app php artisan key:generate --show
if ($LASTEXITCODE -ne 0) { throw 'Key generation failed.' }
$taskConfig = Get-Content -Raw -LiteralPath '.env'
if ($taskConfig -match '(?m)^APP_KEY=$') { $taskConfig = $taskConfig -replace '(?m)^APP_KEY=$', ('APP_KEY=' + ($taskKey | Select-Object -Last 1)); Set-Content -LiteralPath '.env' -Value $taskConfig }
docker compose up -d
docker compose exec app php artisan migrate --force
if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
Write-Host 'HookDesk: http://localhost:8080 | Mailpit: http://localhost:8025'
