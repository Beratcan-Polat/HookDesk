<?php

namespace App\Http\Controllers;

use App\Actions\ReplayDelivery;
use App\Actions\TransferOwnership;
use App\Http\Resources\EventResource;
use App\Models\AuditLog;
use App\Models\Delivery;
use App\Models\DeliveryAttempt;
use App\Models\Endpoint;
use App\Models\Event;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\PlatformSetting;
use App\Models\Project;
use App\Models\ProjectApiKey;
use App\Models\User;
use App\Models\WebhookSource;
use App\Models\Workspace;
use App\Models\WorkspaceLimitOverride;
use App\Notifications\PendingEmail;
use App\Services\AdminUsers;
use App\Services\Audit;
use App\Services\Settings;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AdminController extends Controller
{
    public function stepUp(Request $r)
    {
        $r->validate(['password' => 'required|string', 'code' => 'required|string']);
        abort_unless(Hash::check($r->input('password'), $r->user()->password), 422, 'invalid_credentials');
        abort_unless(app(TwoFactorAuthenticationProvider::class)->verify(decrypt($r->user()->two_factor_secret), $r->input('code')), 422, 'invalid_two_factor_code');
        $r->session()->put('admin_step_up_at', now()->timestamp);

        return response()->noContent();
    }

    public function overview()
    {
        $statuses = Delivery::selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        $done = ($statuses['succeeded'] ?? 0) + ($statuses['failed'] ?? 0);

        return ['data' => ['users' => User::count(), 'workspaces' => Workspace::count(), 'projects' => Project::count(), 'events' => Event::count(),
            'statuses' => $statuses, 'success_rate' => $done ? round(($statuses['succeeded'] ?? 0) * 100 / $done, 1) : null,
            'oldest_pending_at' => Delivery::whereIn('status', ['pending', 'retrying'])->min('created_at'), 'worker' => Cache::get('health:worker'), 'scheduler' => Cache::get('health:scheduler')]];
    }

    public function users(Request $r)
    {
        $q = User::query();
        if ($search = $r->string('search')->toString()) {
            $q->where(fn ($q) => $q->where('name', 'like', '%'.$search.'%')->orWhere('email', 'like', '%'.$search.'%'));
        }
        if ($r->filled('status')) {
            $q->where('status', $r->input('status'));
        }

        return $q->latest()->paginate($this->size($r));
    }

    public function user(User $user)
    {
        return ['data' => $user, 'memberships' => $user->memberships()->with('workspace')->get()];
    }

    public function updateUser(Request $r, User $user)
    {
        $data = $r->validate(['name' => 'sometimes|required|string|max:100', 'status' => 'sometimes|in:active,suspended', 'platform_role' => 'sometimes|in:user,super_admin']);

        return ['data' => app(AdminUsers::class)->change($user, $data, $r->input('reason'))];
    }

    public function userAction(Request $r, User $user)
    {
        $data = $r->validate(['action' => 'required|in:end_sessions,send_verification,send_reset,change_email', 'email' => 'required_if:action,change_email|email|max:255|unique:users,email']);
        match ($data['action']) {
            'end_sessions' => DB::table('sessions')->where('user_id', $user->id)->delete(),
            'send_verification' => $user->sendEmailVerificationNotification(),
            'send_reset' => Password::sendResetLink(['email' => $user->email]),
            'change_email' => $this->pendingEmail($user, $data['email']),
        };
        app(Audit::class)->record('admin.user.'.$data['action'], $user, reason: $r->input('reason'));

        return response()->noContent();
    }

    private function pendingEmail(User $user, string $email): void
    {
        $user->forceFill(['pending_email' => $email])->save();
        $url = URL::temporarySignedRoute('pending-email.verify', now()->addHour(), ['user' => $user->id, 'hash' => hash('sha256', $email)]);
        Notification::route('mail', $email)->notify(new PendingEmail($url, $user->locale));
    }

    public function workspaces(Request $r)
    {
        $q = Workspace::with('owner:id,name,email')->withCount(['members', 'projects']);
        if ($r->filled('search')) {
            $q->where('name', 'like', '%'.$r->input('search').'%');
        }

        return $q->latest()->paginate($this->size($r));
    }

    public function workspace(Workspace $workspace)
    {
        return ['data' => $workspace->load(['members.user', 'projects', 'owner']), 'limits' => WorkspaceLimitOverride::where('workspace_id', $workspace->id)->get(), 'invitations' => Invitation::where('workspace_id', $workspace->id)->whereNull('accepted_at')->get()];
    }

    public function workspaceAction(Request $r, Workspace $workspace)
    {
        $data = $r->validate(['action' => 'required|in:suspend,activate,archive,transfer', 'user_id' => 'required_if:action,transfer|exists:users,id']);
        if ($data['action'] === 'transfer') {
            app(TransferOwnership::class)->execute($workspace, $data['user_id'], $r->input('reason'));
        } elseif ($data['action'] === 'archive') {
            $workspace->update(['archived_at' => now()]);
            Delivery::whereHas('event.project', fn ($q) => $q->where('workspace_id', $workspace->id))->whereIn('status', ['pending', 'retrying'])->update(['status' => 'cancelled', 'completed_at' => now(), 'last_error' => 'workspace_archived']);
        } else {
            $workspace->update(['suspended' => $data['action'] === 'suspend']);
        }
        app(Audit::class)->record('admin.workspace.'.$data['action'], $workspace, reason: $r->input('reason'), workspaceId: $workspace->id);

        return ['data' => $workspace];
    }

    public function limit(Request $r, Workspace $workspace)
    {
        $data = $r->validate(['key' => 'required|in:'.implode(',', array_keys(config('hookdesk.limits'))), 'value' => 'required|integer|min:1|max:1000000']);
        $entry = WorkspaceLimitOverride::updateOrCreate(['workspace_id' => $workspace->id, 'key' => $data['key']], ['value' => $data['value']]);
        app(Audit::class)->record('admin.limit_updated', $workspace, $data, $r->input('reason'), $workspace->id);

        return ['data' => $entry];
    }

    public function projects(Request $r)
    {
        return Project::with('workspace:id,name')->latest()->paginate($this->size($r));
    }

    public function project(Project $project)
    {
        return ['data' => $project->load(['workspace', 'endpoints.subscriptions']),
            'keys' => ProjectApiKey::where('project_id', $project->id)->get(),
            'sources' => WebhookSource::where('project_id', $project->id)->get()];
    }

    public function member(Request $r, Workspace $workspace, Membership $membership)
    {
        abort_unless($membership->workspace_id === $workspace->id, 404);
        abort_if($membership->role === 'owner', 422, 'transfer_ownership_first');
        $data = $r->validate(['role' => 'required|in:admin,developer,viewer']);
        $membership->update($data);
        app(Audit::class)->record('admin.member_updated', $membership, $data, $r->input('reason'), $workspace->id);

        return ['data' => $membership];
    }

    public function removeMember(Request $r, Workspace $workspace, Membership $membership)
    {
        abort_unless($membership->workspace_id === $workspace->id, 404);
        abort_if($membership->role === 'owner', 422, 'transfer_ownership_first');
        app(Audit::class)->record('admin.member_removed', $membership, reason: $r->input('reason'), workspaceId: $workspace->id);
        $membership->delete();

        return response()->noContent();
    }

    public function revokeInvitation(Request $r, Workspace $workspace, Invitation $invitation)
    {
        abort_unless($invitation->workspace_id === $workspace->id, 404);
        app(Audit::class)->record('admin.invitation_revoked', $invitation, reason: $r->input('reason'), workspaceId: $workspace->id);
        $invitation->delete();

        return response()->noContent();
    }

    public function projectAction(Request $r, Project $project)
    {
        $data = $r->validate(['action' => 'required|in:suspend,activate,archive']);
        $project->update($data['action'] === 'archive' ? ['archived_at' => now()] : ['suspended' => $data['action'] === 'suspend']);
        if ($data['action'] === 'archive') {
            ProjectApiKey::where('project_id', $project->id)->update(['revoked_at' => now()]);
            WebhookSource::where('project_id', $project->id)->update(['enabled' => false]);
            Delivery::whereHas('event', fn ($q) => $q->where('project_id', $project->id))->whereIn('status', ['pending', 'retrying'])->update(['status' => 'cancelled', 'completed_at' => now(), 'last_error' => 'project_archived']);
        }
        app(Audit::class)->record('admin.project.'.$data['action'], $project, reason: $r->input('reason'), workspaceId: $project->workspace_id);

        return ['data' => $project];
    }

    public function revokeKey(Request $r, ProjectApiKey $key)
    {
        $key->update(['revoked_at' => now()]);
        app(Audit::class)->record('admin.key_revoked', $key, reason: $r->input('reason'), workspaceId: $key->project->workspace_id);

        return response()->noContent();
    }

    public function sourceAction(Request $r, WebhookSource $source)
    {
        $data = $r->validate(['action' => 'required|in:disable,rotate']);
        $token = Str::random(64);
        $source->update($data['action'] === 'disable' ? ['enabled' => false] : ['token_hash' => hash('sha256', $token)]);
        app(Audit::class)->record('admin.source.'.$data['action'], $source, reason: $r->input('reason'), workspaceId: $source->project->workspace_id);

        return response()->json(['data' => $source, 'url' => $data['action'] === 'rotate' ? rtrim(config('app.url'), '/').'/ingest/'.$token : null])->header('Cache-Control', 'no-store');
    }

    public function endpointAction(Request $r, Endpoint $endpoint)
    {
        $data = $r->validate(['paused' => 'required|boolean']);
        $endpoint->update($data);
        app(Audit::class)->record('admin.endpoint_paused', $endpoint, $data, $r->input('reason'), $endpoint->project->workspace_id);

        return ['data' => $endpoint];
    }

    public function events(Request $r)
    {
        $q = app(EventController::class)->filters($r, Event::query());
        if ($r->filled('workspace_id')) {
            $q->whereHas('project', fn ($q) => $q->where('workspace_id', $r->input('workspace_id')));
        }
        if ($r->filled('project_id')) {
            $q->where('project_id', $r->input('project_id'));
        }

        return EventResource::collection($q->withCount('deliveries')->latest()->paginate($this->size($r)));
    }

    public function payload(Request $r, Event $event)
    {
        app(Audit::class)->record('admin.payload_viewed', $event, reason: $r->input('reason'), workspaceId: $event->project->workspace_id);

        return response()->json(['data' => json_decode($event->body)])->header('Cache-Control', 'no-store');
    }

    public function attemptPayload(Request $r, DeliveryAttempt $attempt)
    {
        $d = Delivery::findOrFail($attempt->delivery_id);
        app(Audit::class)->record('admin.response_viewed', $attempt, reason: $r->input('reason'), workspaceId: $d->event->project->workspace_id);

        return response()->json(['body' => $attempt->response_body, 'truncated' => $attempt->response_truncated])->header('Cache-Control', 'no-store');
    }

    public function deliveries(Request $r)
    {
        $q = Delivery::with(['endpoint:id,name', 'event:id,type,project_id']);
        if ($r->filled('status')) {
            $q->where('status', $r->input('status'));
        }
        if ($r->filled('event_id')) {
            $q->where('event_id', $r->input('event_id'));
        }
        if ($r->filled('workspace_id')) {
            $q->whereHas('event.project', fn ($q) => $q->where('workspace_id', $r->input('workspace_id')));
        }

        return $q->latest()->paginate($this->size($r));
    }

    public function delivery(Delivery $delivery)
    {
        return ['data' => $delivery->load(['attempts', 'endpoint', 'event'])];
    }

    public function replay(Request $r)
    {
        $data = $r->validate(['delivery_ids' => 'required|array|min:1|max:100', 'delivery_ids.*' => 'required|ulid|distinct']);
        $results = [];
        foreach ($data['delivery_ids'] as $id) {
            try {
                $d = Delivery::findOrFail($id);
                abort_unless($d->status === 'failed', 409, 'only_failed_deliveries');
                $new = app(ReplayDelivery::class)->execute($d);
                $results[] = ['id' => $id, 'replay_id' => $new->id, 'ok' => true];
            } catch (HttpException $e) {
                $results[] = ['id' => $id, 'ok' => false, 'error' => $e->getMessage()];
            } catch (ModelNotFoundException) {
                $results[] = ['id' => $id, 'ok' => false, 'error' => 'not_found'];
            }
        }

        return response()->json(['data' => $results], 202);
    }

    public function settings()
    {
        return ['data' => ['registration_enabled' => app(Settings::class)->get('registration_enabled', true), 'ingestion_paused' => app(Settings::class)->get('ingestion_paused', false),
            'delivery_paused' => app(Settings::class)->get('delivery_paused', false), 'limits' => collect(config('hookdesk.limits'))->mapWithKeys(fn ($v, $k) => [$k => app(Settings::class)->limit($k)])]];
    }

    public function updateSettings(Request $r)
    {
        $data = $r->validate(['key' => 'required|string', 'value' => 'required']);
        $key = $data['key'];
        if (in_array($key, ['registration_enabled', 'ingestion_paused', 'delivery_paused'], true)) {
            $r->validate(['value' => 'boolean']);
            $data['value'] = $r->boolean('value');
        } elseif (str_starts_with($key, 'limit.') && array_key_exists(substr($key, 6), config('hookdesk.limits'))) {
            $r->validate(['value' => 'integer|min:1|max:1000000']);
            $data['value'] = (int) $data['value'];
        } else {
            abort(422, 'unknown_setting');
        }
        PlatformSetting::updateOrCreate(['key' => $key], ['value' => $data['value']]);
        app(Audit::class)->record('admin.setting_updated', changes: $data, reason: $r->input('reason'));

        return $this->settings();
    }

    public function audit(Request $r)
    {
        $q = AuditLog::with([]);
        if ($r->filled('actor_id')) {
            $q->where('actor_id', $r->input('actor_id'));
        }
        if ($r->filled('action')) {
            $q->where('action', $r->input('action'));
        }
        if ($r->filled('workspace_id')) {
            $q->where('workspace_id', $r->input('workspace_id'));
        }

        return $q->latest()->paginate($this->size($r));
    }

    public function health()
    {
        $db = false;
        $cache = false;
        $worker = null;
        $scheduler = null;
        try {
            DB::select('SELECT 1');
            $db = true;
        } catch (\Throwable) {
        }
        try {
            Cache::put('health:probe', 'ok', 10);
            $cache = Cache::get('health:probe') === 'ok';
            $worker = Cache::get('health:worker');
            $scheduler = Cache::get('health:scheduler');
        } catch (\Throwable) {
        }

        return ['data' => ['database' => $db, 'cache' => $cache, 'worker' => $worker, 'scheduler' => $scheduler,
            'failed_jobs' => DB::table('failed_jobs')->count(), 'pending' => Delivery::whereIn('status', ['pending', 'retrying'])->count(), 'oldest_pending_at' => Delivery::whereIn('status', ['pending', 'retrying'])->min('created_at')]];
    }

    private function size(Request $r): int
    {
        return min(100, max(1, (int) $r->input('per_page', 25)));
    }
}
