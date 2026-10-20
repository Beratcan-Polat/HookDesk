<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

class Audit
{
    public function record(string $action, ?Model $resource = null, array $changes = [], ?string $reason = null, ?string $workspaceId = null): AuditLog
    {
        $context = app(Context::class);
        $actor = $context->actor();

        return AuditLog::create([
            'actor_id' => $actor?->id, 'effective_user_id' => $context->user()?->id, 'support_session_id' => $context->support()?->id,
            'workspace_id' => $workspaceId ?? $context->support()?->workspace_id, 'action' => $action,
            'resource_type' => $resource ? class_basename($resource) : null, 'resource_id' => $resource?->getKey(),
            'reason' => $reason ?? $context->support()?->reason, 'changes' => $changes ?: null,
            'request_id' => request()->attributes->get('request_id'), 'privileged' => ($actor?->isSuperAdmin() ?? false) || str_starts_with($action, 'cli.admin'),
        ]);
    }
}
