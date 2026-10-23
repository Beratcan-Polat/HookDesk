<?php

function requireBrowserDatabase(): void
{
    $database = config('database.connections.'.config('database.default').'.database');
    if (! app()->environment('testing') || ! is_string($database) || ! preg_match('/^hookdesk_browser(?:_[a-z0-9]+)?$/D', $database)) {
        throw new RuntimeException('Use APP_ENV=testing and a dedicated hookdesk_browser database.');
    }
}
