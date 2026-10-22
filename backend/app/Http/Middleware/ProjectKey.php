<?php

namespace App\Http\Middleware;

use App\Models\ProjectApiKey;
use App\Services\Settings;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class ProjectKey
{
    public function handle(Request $request, Closure $next)
    {
        $key = ProjectApiKey::where('token_hash', hash('sha256', $request->bearerToken() ?? ''))->first();
        abort_unless($key && ! $key->revoked_at && $key->expires_at->isFuture(), 401, 'invalid_api_key');
        abort_if($key->project->blocked(), 403, 'project_blocked');
        $ability = $request->isMethod('POST') ? 'events:write' : 'events:read';
        abort_unless(in_array($ability, $key->abilities, true), 403, 'missing_ability');
        if ($request->isMethod('POST')) {
            $limiter = 'ingest:'.$key->project_id;
            $max = app(Settings::class)->limit('ingest_per_minute', $key->project->workspace);
            abort_if(RateLimiter::tooManyAttempts($limiter, $max), 429, 'rate_limit_reached', ['Retry-After' => (string) RateLimiter::availableIn($limiter)]);
            RateLimiter::hit($limiter, 60);
        }
        $key->update(['last_used_at' => now()]);
        $request->attributes->set('project', $key->project);

        return $next($request);
    }
}
