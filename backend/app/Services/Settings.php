<?php

namespace App\Services;

use App\Models\PlatformSetting;
use App\Models\Workspace;
use App\Models\WorkspaceLimitOverride;

class Settings
{
    public function get(string $key, mixed $default = null): mixed
    {
        return PlatformSetting::find($key)?->value ?? $default;
    }

    public function limit(string $key, ?Workspace $workspace = null): int
    {
        return (int) (($workspace ? WorkspaceLimitOverride::where('workspace_id', $workspace->id)->where('key', $key)->value('value') : null)
            ?? $this->get('limit.'.$key, config('hookdesk.limits.'.$key)));
    }
}
