<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\Project;
use App\Models\ProjectApiKey;
use App\Models\WebhookSource;
use App\Models\Workspace;
use App\Services\Access;
use App\Services\Settings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public function store(Request $r, Workspace $workspace)
    {
        app(Access::class)->workspace($workspace, 'write');
        $data = $r->validate(['name' => 'required|string|max:100', 'description' => 'nullable|string|max:1000']);
        $p = DB::transaction(function () use ($workspace, $data) {
            Workspace::whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            abort_if($workspace->projects()->whereNull('archived_at')->count() >= app(Settings::class)->limit('projects', $workspace), 422, 'project_limit_reached');

            return Project::create([...$data, 'workspace_id' => $workspace->id]);
        }, 3);

        return response()->json(['data' => $p], 201);
    }

    public function update(Request $r, Project $project)
    {
        app(Access::class)->project($project, 'write');
        $project->update($r->validate(['name' => 'required|string|max:100', 'description' => 'nullable|string|max:1000']));

        return ['data' => $project];
    }

    public function archive(Project $project)
    {
        app(Access::class)->workspace($project->workspace, 'team');
        $project->update(['archived_at' => now()]);
        ProjectApiKey::where('project_id', $project->id)->update(['revoked_at' => now()]);
        WebhookSource::where('project_id', $project->id)->update(['enabled' => false]);
        Delivery::whereHas('event', fn ($q) => $q->where('project_id', $project->id))->whereIn('status', ['pending', 'retrying'])->update(['status' => 'cancelled', 'completed_at' => now(), 'last_error' => 'project_archived']);

        return response()->noContent();
    }
}
