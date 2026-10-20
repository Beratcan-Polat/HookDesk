<?php

namespace App\Actions;

use App\Models\Membership;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

class TransferOwnership
{
    public function execute(Workspace $workspace, string $userId, ?string $reason = null): Workspace
    {
        return DB::transaction(function () use ($workspace, $userId, $reason) {
            $w = Workspace::whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            $target = User::findOrFail($userId);
            abort_unless($target->status === 'active' && $target->hasVerifiedEmail(), 422, 'owner_must_be_verified');
            $member = Membership::where('workspace_id', $w->id)->where('user_id', $target->id)->firstOrFail();
            if ($w->owner_user_id !== $target->id) {
                Membership::where('workspace_id', $w->id)->where('role', 'owner')->update(['role' => 'admin']);
                $member->update(['role' => 'owner']);
                $w->update(['owner_user_id' => $target->id]);
            }
            app(Audit::class)->record('workspace.ownership_transferred', $w, ['owner_user_id' => $target->id], $reason, $w->id);

            return $w;
        }, 3);
    }
}
