<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        abort_unless($user?->isSuperAdmin() && $user->hasVerifiedEmail() && $user->two_factor_confirmed_at, 403, 'admin_access_denied');

        return $next($request);
    }
}
