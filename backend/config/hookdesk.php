<?php

return [
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),
    'receiver_url' => env('RECEIVER_URL', 'http://receiver:8080'),
    'app_role' => env('APP_ROLE', 'app'),
    'max_body_bytes' => 262144, 'max_response_bytes' => 16384,
    'limits' => ['owned_workspaces' => 3, 'members' => 10, 'projects' => 3, 'endpoints' => 5, 'sources' => 3, 'api_keys' => 5, 'events_daily' => 500, 'replays_daily' => 100, 'ingest_per_minute' => 30, 'workspace_per_second' => 5, 'endpoint_per_second' => 2],
    'retry_delays' => [10, 60, 300, 900, 3600],
];
