<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ProtectAdminTwoFactor
{
    public function handle(Request $r, Closure $next)
    {
        if ($r->isMethod('DELETE') && $r->is('user/two-factor-authentication') && $r->user()?->isSuperAdmin()) {
            abort(403, 'demote_admin_before_disabling_2fa');
        }

        return $next($r);
    }
}
