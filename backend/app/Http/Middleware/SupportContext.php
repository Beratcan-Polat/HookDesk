<?php

namespace App\Http\Middleware;

use App\Models\Membership;
use App\Models\SupportSession;
use Closure;
use Illuminate\Http\Request;

class SupportContext
{
    public function handle(Request $request, Closure $next)
    {
        $s = SupportSession::findOrFail($request->route('supportSession'));
        abort_unless($s->actor_id === $request->user()->id && ! $s->revoked_at && $s->expires_at->isFuture(), 403, 'support_session_expired');
        abort_unless($s->user->status === 'active' && Membership::where('workspace_id', $s->workspace_id)->where('user_id', $s->user_id)->exists(), 403, 'support_target_unavailable');
        $request->attributes->set('support_session', $s);
        $request->attributes->set('effective_user', $s->user);
        abort_if(in_array($request->route()->getName(), ['support.endpoint.create', 'support.source.create'], true), 403, 'secret_creation_not_allowed_in_support');
        $request->route()->forgetParameter('supportSession');

        return $next($request);
    }
}
