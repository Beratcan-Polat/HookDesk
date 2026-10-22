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

    public function workspaceLimitKeys(): array
    {
        return array_values(array_diff(array_keys(config('hookdesk.limits')), ['owned_workspaces']));
    }

    public function workspaceLimits(Workspace $workspace): array
    {
        $keys = $this->workspaceLimitKeys();
        $platform = PlatformSetting::whereIn('key', array_map(fn ($key) => 'limit.'.$key, $keys))->pluck('value', 'key');
        $overrides = WorkspaceLimitOverride::where('workspace_id', $workspace->id)->whereIn('key', $keys)->get();
        $defaults = [];
        foreach ($keys as $key) {
            $defaults[$key] = (int) ($platform['limit.'.$key] ?? config('hookdesk.limits.'.$key));
        }

        return ['limits' => $overrides, 'default_limits' => $defaults, 'effective_limits' => array_replace($defaults, $overrides->pluck('value', 'key')->all())];
    }
}
