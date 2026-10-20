<?php

namespace App\Services;

use App\Models\UsageCounter;
use App\Models\Workspace;

class Quota
{
    // Caller holds the workspace row lock; daily increments share that same lock.
    public function increment(Workspace $workspace, string $kind): void
    {
        $counter = UsageCounter::firstOrCreate(['workspace_id' => $workspace->id, 'date' => today('UTC')->toDateString()]);
        abort_if($counter->{$kind} >= app(Settings::class)->limit($kind.'_daily', $workspace), 429, 'daily_limit_reached', ['Retry-After' => '60']);
        $counter->increment($kind);
    }
}
