<?php

namespace App\Http\Controllers;

use App\Actions\TransferOwnership;
use App\Models\AuditLog;
use App\Models\Delivery;
use App\Models\Event;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\UsageCounter;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WorkspaceInvitation;
use App\Services\Access;
use App\Services\Audit;
use App\Services\Context;
use App\Services\Settings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class WorkspaceController extends Controller
{
    public function index()
    {
        $user = app(Context::class)->user();
        $query = Workspace::whereHas('members', fn ($q) => $q->where('user_id', $user->id))->with('projects');
        if ($s = app(Context::class)->support()) {
            $query->whereKey($s->workspace_id);
        }

        return response()->json(['data' => $query->get()->map(fn ($w) => [...$w->toArray(), 'role' => Membership::where('workspace_id', $w->id)->where('user_id', $user->id)->value('role'), 'blocked' => $w->blocked()])]);
    }

    public function store(Request $r)
    {
        $data = $r->validate(['name' => 'required|string|max:100']);
        $user = app(Context::class)->user();
        $w = DB::transaction(function () use ($data, $user) {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            abort_if(Workspace::where('owner_user_id', $user->id)->count() >= app(Settings::class)->limit('owned_workspaces'), 422, 'workspace_limit_reached');
            $w = Workspace::create([...$data, 'owner_user_id' => $user->id]);
            Membership::create(['workspace_id' => $w->id, 'user_id' => $user->id, 'role' => 'owner']);

            return $w;
        }, 3);
        app(Audit::class)->record('workspace.created', $w, workspaceId: $w->id);

        return response()->json(['data' => $w], 201);
    }

    public function update(Request $r, Workspace $workspace)
    {
        app(Access::class)->workspace($workspace, 'owner');
        $workspace->update($r->validate(['name' => 'required|string|max:100']));

        return ['data' => $workspace];
    }

    public function summary(Request $r, Workspace $workspace)
    {
        app(Access::class)->workspace($workspace);
        $data = $r->validate(['days' => 'sometimes|integer|in:1,7,30']);
        $days = (int) ($data['days'] ?? 7);
        $since = now()->subDays($days);
        $events = Event::whereIn('project_id', $workspace->projects()->select('id'))->where('created_at', '>=', $since);
        $deliveries = Delivery::whereHas('event.project', fn ($q) => $q->where('workspace_id', $workspace->id))->where('created_at', '>=', $since);
        $counts = (clone $deliveries)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        $finished = ($counts['succeeded'] ?? 0) + ($counts['failed'] ?? 0);

        return ['data' => ['events' => $events->count(), 'deliveries' => $deliveries->count(), 'statuses' => $counts, 'success_rate' => $finished ? round(($counts['succeeded'] ?? 0) * 100 / $finished, 1) : null,
            'usage' => UsageCounter::where('workspace_id', $workspace->id)->whereDate('date', today('UTC'))->first(),
            'limits' => collect(config('hookdesk.limits'))->mapWithKeys(fn ($v, $key) => [$key => app(Settings::class)->limit($key, $workspace)]),
            'timeline' => (clone $deliveries)->selectRaw('CAST(created_at AS DATE) as day, COUNT(*) as total')->groupByRaw('CAST(created_at AS DATE)')->orderBy('day')->get()]];
    }

    public function archive(Workspace $workspace)
    {
        app(Access::class)->workspace($workspace, 'owner');
        $workspace->update(['archived_at' => now()]);
        Delivery::whereHas('event.project', fn ($q) => $q->where('workspace_id', $workspace->id))->whereIn('status', ['pending', 'retrying'])->update(['status' => 'cancelled', 'completed_at' => now(), 'last_error' => 'workspace_archived']);

        return response()->noContent();
    }

    public function audit(Workspace $workspace)
    {
        app(Access::class)->workspace($workspace, 'team');

        return AuditLog::where('workspace_id', $workspace->id)->latest()->paginate(min(100, max(1, (int) request('per_page', 25))));
    }
}
