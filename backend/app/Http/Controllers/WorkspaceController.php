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

    public function team(Workspace $workspace)
    {
        app(Access::class)->workspace($workspace);

        return ['data' => ['members' => $workspace->members()->with('user')->get(), 'invitations' => Invitation::where('workspace_id', $workspace->id)->whereNull('accepted_at')->where('expires_at', '>', now())->get()]];
    }

    public function invite(Request $r, Workspace $workspace)
    {
        app(Access::class)->workspace($workspace, 'team');
        $data = $r->validate(['email' => 'required|email|max:255', 'role' => 'required|in:admin,developer,viewer']);
        $data['email'] = strtolower($data['email']);
        if ($data['role'] === 'admin') {
            app(Access::class)->workspace($workspace, 'owner');
        }
        $token = Str::random(64);
        $invitation = DB::transaction(function () use ($workspace, $data, $token) {
            Workspace::whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            abort_if(Membership::where('workspace_id', $workspace->id)->whereHas('user', fn ($q) => $q->where('email', $data['email']))->exists(), 422, 'already_a_member');
            $previous = Invitation::where('workspace_id', $workspace->id)->where('email', $data['email'])->whereNull('accepted_at')->first();
            if ($previous?->role === 'admin') {
                app(Access::class)->workspace($workspace, 'owner');
            }
            Invitation::where('workspace_id', $workspace->id)->where('email', $data['email'])->whereNull('accepted_at')->delete();
            $reserved = $workspace->members()->count() + Invitation::where('workspace_id', $workspace->id)->whereNull('accepted_at')->where('expires_at', '>', now())->count();
            abort_if($reserved >= app(Settings::class)->limit('members', $workspace), 422, 'member_limit_reached');

            return Invitation::create([...$data, 'workspace_id' => $workspace->id, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addHours(72)]);
        }, 3);
        Notification::route('mail', $data['email'])->notify(new WorkspaceInvitation($workspace->name, $token, app(Context::class)->user()->locale));

        return response()->json(['data' => $invitation], 201);
    }

    public function revokeInvite(Workspace $workspace, Invitation $invitation)
    {
        app(Access::class)->workspace($workspace, 'team');
        abort_unless($invitation->workspace_id === $workspace->id, 404);
        if ($invitation->role === 'admin') {
            app(Access::class)->workspace($workspace, 'owner');
        }
        $invitation->delete();

        return response()->noContent();
    }

    public function acceptInvite(Request $r)
    {
        $r->validate(['token' => 'required|string|max:100']);
        $user = app(Context::class)->user();
        $i = Invitation::where('token_hash', hash('sha256', $r->input('token')))->firstOrFail();
        $w = DB::transaction(function () use ($i, $user) {
            $w = Workspace::whereKey($i->workspace_id)->lockForUpdate()->firstOrFail();
            $i->refresh();
            abort_if($i->accepted_at || $i->expires_at->isPast() || $w->blocked(), 410, 'invitation_expired');
            abort_unless(strcasecmp($i->email, $user->email) === 0, 403, 'invitation_email_mismatch');
            abort_if($w->members()->count() >= app(Settings::class)->limit('members', $w), 422, 'member_limit_reached');
            Membership::firstOrCreate(['workspace_id' => $w->id, 'user_id' => $user->id], ['role' => $i->role]);
            $i->update(['accepted_at' => now()]);

            return $w;
        }, 3);
        app(Audit::class)->record('invitation.accepted', $i, workspaceId: $w->id);

        return ['data' => $w];
    }

    public function member(Request $r, Workspace $workspace, Membership $membership)
    {
        app(Access::class)->workspace($workspace, 'team');
        abort_unless($membership->workspace_id === $workspace->id, 404);
        $data = $r->validate(['role' => 'required|in:admin,developer,viewer']);
        abort_if($membership->role === 'owner', 422, 'transfer_ownership_first');
        if ($membership->role === 'admin' || $data['role'] === 'admin') {
            app(Access::class)->workspace($workspace, 'owner');
        }
        $membership->update($data);

        return ['data' => $membership];
    }

    public function removeMember(Workspace $workspace, Membership $membership)
    {
        app(Access::class)->workspace($workspace, 'team');
        abort_unless($membership->workspace_id === $workspace->id, 404);
        abort_if($membership->role === 'owner', 422, 'transfer_ownership_first');
        if ($membership->role === 'admin') {
            app(Access::class)->workspace($workspace, 'owner');
        }
        $membership->delete();

        return response()->noContent();
    }

    public function leave(Workspace $workspace)
    {
        app(Access::class)->workspace($workspace);
        $u = app(Context::class)->user();
        abort_if($workspace->owner_user_id === $u->id, 422, 'transfer_ownership_first');
        Membership::where('workspace_id', $workspace->id)->where('user_id', $u->id)->delete();

        return response()->noContent();
    }

    public function transfer(Request $r, Workspace $workspace)
    {
        app(Access::class)->workspace($workspace, 'owner');
        $data = $r->validate(['user_id' => 'required|exists:users,id']);

        return ['data' => app(TransferOwnership::class)->execute($workspace, $data['user_id'])];
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
