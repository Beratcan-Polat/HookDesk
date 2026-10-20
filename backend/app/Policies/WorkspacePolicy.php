<?php

namespace App\Policies;

use App\Models\Membership;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Context;

class WorkspacePolicy
{
    public function access(User $user, Workspace $workspace, string $ability = 'read'): bool
    {
        $support = app(Context::class)->support();
        if ($support && $support->workspace_id !== $workspace->id) {
            return false;
        }
        if ($user->status !== 'active') {
            return false;
        }
        $role = Membership::where('workspace_id', $workspace->id)->where('user_id', $user->id)->value('role');
        if (! $role) {
            return false;
        }
        if ($ability !== 'read' && $workspace->blocked()) {
            return false;
        }

        return match ($ability) {
            'read' => true, 'write' => in_array($role, ['owner', 'admin', 'developer'], true),
            'team' => in_array($role, ['owner', 'admin'], true), 'owner' => $role === 'owner', default => false,
        };
    }
}
