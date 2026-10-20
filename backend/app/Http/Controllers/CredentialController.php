<?php

namespace App\Http\Controllers;

use App\Models\Membership;
use App\Models\Project;
use App\Models\ProjectApiKey;
use App\Models\WebhookSource;
use App\Services\Access;
use App\Services\Context;
use App\Services\Settings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CredentialController extends Controller
{
    public function keys(Project $project)
    {
        app(Access::class)->project($project, 'write');

        return ['data' => ProjectApiKey::where('project_id', $project->id)->latest()->get()];
    }

    public function createKey(Request $r, Project $project)
    {
        app(Access::class)->project($project, 'write');
        $data = $r->validate(['name' => 'required|string|max:100', 'abilities' => 'required|array|min:1|max:2', 'abilities.*' => 'required|in:events:read,events:write']);
        $token = 'hdk_'.Str::random(64);
        $key = DB::transaction(function () use ($project, $data, $token) {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            abort_if(ProjectApiKey::where('project_id', $project->id)->whereNull('revoked_at')->where('expires_at', '>', now())->count() >= app(Settings::class)->limit('api_keys', $project->workspace), 422, 'api_key_limit_reached');

            return ProjectApiKey::create([...$data, 'project_id' => $project->id, 'created_by' => app(Context::class)->user()->id, 'prefix' => substr($token, 0, 12), 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDays(90)]);
        }, 3);

        return response()->json(['data' => $key, 'token' => $token], 201)->header('Cache-Control', 'no-store');
    }

    public function revokeKey(ProjectApiKey $key)
    {
        $p = app(Access::class)->project($key->project, 'write');
        $u = app(Context::class)->user();
        $role = Membership::where('workspace_id', $p->workspace_id)->where('user_id', $u->id)->value('role');
        abort_unless(in_array($role, ['owner', 'admin'], true) || $key->created_by === $u->id, 403, 'key_access_denied');
        $key->update(['revoked_at' => now()]);

        return response()->noContent();
    }

    public function sources(Project $project)
    {
        app(Access::class)->project($project);

        return ['data' => WebhookSource::where('project_id', $project->id)->latest()->get()];
    }

    public function createSource(Request $r, Project $project)
    {
        app(Access::class)->project($project, 'write');
        $data = $r->validate(['name' => 'required|string|max:100', 'event_type' => 'required|string|max:100|regex:/^[a-zA-Z0-9_.-]+$/', 'mode' => 'required|in:capture_only,capture_and_forward']);
        $token = Str::random(64);
        $s = DB::transaction(function () use ($project, $data, $token) {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            abort_if(WebhookSource::where('project_id', $project->id)->count() >= app(Settings::class)->limit('sources', $project->workspace), 422, 'source_limit_reached');

            return WebhookSource::create([...$data, 'project_id' => $project->id, 'token_hash' => hash('sha256', $token)]);
        }, 3);

        return response()->json(['data' => $s, 'url' => rtrim(config('app.url'), '/').'/ingest/'.$token], 201)->header('Cache-Control', 'no-store');
    }

    public function updateSource(Request $r, WebhookSource $source)
    {
        app(Access::class)->project($source->project, 'write');
        $source->update($r->validate(['name' => 'sometimes|required|string|max:100', 'event_type' => 'sometimes|required|string|max:100|regex:/^[a-zA-Z0-9_.-]+$/', 'mode' => 'sometimes|in:capture_only,capture_and_forward', 'enabled' => 'sometimes|boolean']));

        return ['data' => $source];
    }

    public function rotateSource(WebhookSource $source)
    {
        app(Access::class)->project($source->project, 'write');
        $token = Str::random(64);
        $source->update(['token_hash' => hash('sha256', $token)]);

        return response()->json(['url' => rtrim(config('app.url'), '/').'/ingest/'.$token])->header('Cache-Control', 'no-store');
    }
}
