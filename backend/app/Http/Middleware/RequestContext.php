<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RequestContext
{
    public function handle(Request $request, Closure $next)
    {
        $request->attributes->set('request_id', (string) Str::ulid());
        $locale = $request->header('X-Locale') ?? $request->user()?->locale ?? 'en';
        app()->setLocale(in_array($locale, ['tr', 'en'], true) ? $locale : 'en');
        if ($request->user() && $request->user()->status !== 'active') {
            abort(403, 'account_suspended');
        }
        $response = $next($request);
        if ($request->is('api/*', 'user/two-factor*')) {
            $response->headers->set('Cache-Control', 'no-store');
        }
        $response->headers->set('X-Request-Id', $request->attributes->get('request_id'));

        return $response;
    }
}
