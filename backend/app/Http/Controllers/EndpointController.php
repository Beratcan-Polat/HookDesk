<?php

namespace App\Http\Controllers;

use App\Models\Endpoint;
use App\Models\EndpointSubscription;
use App\Models\Project;
use App\Models\SigningSecret;
use App\Services\Access;
use App\Services\Settings;
use App\Services\TargetGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EndpointController extends Controller
{
    public function index(Project $project)
    {
        app(Access::class)->project($project);

        return ['data' => $project->endpoints()->with('subscriptions')->latest()->get()];
    }

    public function store(Request $r, Project $project)
    {
        app(Access::class)->project($project, 'write');
        $data = $r->validate(['name' => 'required|string|max:100', 'kind' => 'required|in:https,sandbox', 'url' => 'required_if:kind,https|nullable|string|max:2048',
            'sandbox_behavior' => 'sometimes|in:success,fail_twice,always_fail,timeout', 'subscriptions' => 'required|array|min:1|max:30', 'subscriptions.*' => ['required', 'string', 'max:100', 'regex:/^(\\*|[a-zA-Z0-9_.-]+)$/']]);
        if ($data['kind'] === 'https') {
            try {
                app(TargetGuard::class)->validate($data['url']);
            } catch (\DomainException $e) {
                abort(422, $e->getMessage());
            }
        }
        $secret = 'whsec_'.Str::random(48);
        $endpoint = DB::transaction(function () use ($data, $project, $secret) {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            abort_if($project->endpoints()->count() >= app(Settings::class)->limit('endpoints', $project->workspace), 422, 'endpoint_limit_reached');
            $e = Endpoint::create(['project_id' => $project->id, 'name' => $data['name'], 'kind' => $data['kind'], 'url' => $data['kind'] === 'https' ? $data['url'] : null, 'sandbox_behavior' => $data['sandbox_behavior'] ?? 'success']);
            foreach (array_unique($data['subscriptions']) as $type) {
                EndpointSubscription::create(['endpoint_id' => $e->id, 'event_type' => $type]);
            }
            SigningSecret::create(['endpoint_id' => $e->id, 'version' => 1, 'secret' => $secret]);

            return $e;
        }, 3);

        return response()->json(['data' => $endpoint->load('subscriptions'), 'secret' => $secret], 201)->header('Cache-Control', 'no-store');
    }

    public function update(Request $r, Endpoint $endpoint)
    {
        app(Access::class)->project($endpoint->project, 'write');
        $data = $r->validate(['name' => 'sometimes|required|string|max:100', 'url' => 'sometimes|required|string|max:2048', 'paused' => 'sometimes|boolean',
            'sandbox_behavior' => 'sometimes|in:success,fail_twice,always_fail,timeout', 'subscriptions' => 'sometimes|required|array|min:1|max:30', 'subscriptions.*' => ['required', 'string', 'max:100', 'regex:/^(\\*|[a-zA-Z0-9_.-]+)$/']]);
        if (isset($data['url'])) {
            abort_unless($endpoint->kind === 'https', 422, 'sandbox_url_is_fixed');
            try {
                app(TargetGuard::class)->validate($data['url']);
            } catch (\DomainException $e) {
                abort(422, $e->getMessage());
            }
        }
        DB::transaction(function () use ($endpoint, $data) {
            Endpoint::whereKey($endpoint->id)->lockForUpdate()->firstOrFail();
            $endpoint->update(collect($data)->except('subscriptions')->all());
            if (isset($data['subscriptions'])) {
                $endpoint->subscriptions()->delete();
                foreach (array_unique($data['subscriptions']) as $type) {
                    EndpointSubscription::create(['endpoint_id' => $endpoint->id, 'event_type' => $type]);
                }
            }
        }, 3);

        return ['data' => $endpoint->fresh()->load('subscriptions')];
    }

    public function rotate(Endpoint $endpoint)
    {
        app(Access::class)->project($endpoint->project, 'write');
        $secret = 'whsec_'.Str::random(48);
        DB::transaction(function () use ($endpoint, $secret) {
            Endpoint::whereKey($endpoint->id)->lockForUpdate()->firstOrFail();
            SigningSecret::create(['endpoint_id' => $endpoint->id, 'version' => 1 + (int) $endpoint->secrets()->max('version'), 'secret' => $secret]);
        }, 3);

        return response()->json(['secret' => $secret])->header('Cache-Control', 'no-store');
    }
}
