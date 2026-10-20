<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminMutation
{
    public function handle(Request $request, Closure $next)
    {
        if (! $request->isMethodSafe()) {
            abort_unless($request->hasSession() && (int) $request->session()->get('admin_step_up_at', 0) >= now()->subMinutes(5)->timestamp, 423, 'admin_step_up_required');
            $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);
        }

        return $next($request);
    }
}
