<?php

namespace App\Http\Middleware;

use App\Models\Delivery;
use App\Models\Endpoint;
use App\Models\Event;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Project;
use App\Models\ProjectApiKey;
use App\Models\WebhookSource;
use App\Models\Workspace;
use App\Services\Audit;
use App\Services\Context;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditMutation
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        if (! $request->isMethodSafe() && $response->getStatusCode() < 400) {
            $workspaceId = app(Context::class)->support()?->workspace_id;
            $resource = null;
            foreach (array_reverse($request->route()->parameters()) as $parameter) {
                if (! $parameter instanceof Model) {
                    continue;
                }
                $resource ??= $parameter;
                $workspaceId ??= match (true) {
                    $parameter instanceof Workspace => $parameter->id,
                    $parameter instanceof Project => $parameter->workspace_id,
                    $parameter instanceof Endpoint,
                    $parameter instanceof WebhookSource,
                    $parameter instanceof ProjectApiKey,
                    $parameter instanceof Event => $parameter->project->workspace_id,
                    $parameter instanceof Delivery => $parameter->event->project->workspace_id,
                    $parameter instanceof Membership,
                    $parameter instanceof Invitation => $parameter->workspace_id,
                    default => null,
                };
            }
            app(Audit::class)->record($request->route()->getName() ?? 'dashboard.mutation', $resource, reason: $request->input('reason'), workspaceId: $workspaceId);
        }

        return $response;
    }
}
