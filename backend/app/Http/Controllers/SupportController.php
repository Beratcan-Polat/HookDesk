<?php

namespace App\Http\Controllers;

use App\Models\Membership;
use App\Models\SupportSession;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportController extends Controller
{
    public function index()
    {
        return ['data' => SupportSession::where('actor_id', request()->user()->id)->with(['user:id,name,email', 'workspace:id,name'])->latest()->limit(50)->get()];
    }

    public function store(Request $r)
    {
        $data = $r->validate(['user_id' => 'required|exists:users,id', 'workspace_id' => 'required|exists:workspaces,id']);
        $target = User::findOrFail($data['user_id']);
        abort_if($target->platform_role === 'super_admin' || $target->status !== 'active' || ! $target->hasVerifiedEmail(), 422, 'invalid_support_target');
        abort_unless(Membership::where('workspace_id', $data['workspace_id'])->where('user_id', $target->id)->exists(), 422, 'target_not_member');
        $s = DB::transaction(function () use ($r, $data) {
            User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            SupportSession::where('actor_id', $r->user()->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);

            return SupportSession::create([...$data, 'actor_id' => $r->user()->id, 'reason' => $r->input('reason'), 'expires_at' => null]);
        }, 3);
        app(Audit::class)->record('admin.support_started', $s, reason: $s->reason, workspaceId: $s->workspace_id);

        return response()->json(['data' => $s->load(['user:id,name,email', 'workspace:id,name'])], 201);
    }

    public function destroy(Request $r, SupportSession $supportSession)
    {
        abort_unless($supportSession->actor_id === $r->user()->id, 403);
        $supportSession->update(['revoked_at' => now()]);
        app(Audit::class)->record('admin.support_ended', $supportSession, reason: $supportSession->reason, workspaceId: $supportSession->workspace_id);

        return response()->noContent();
    }
}
