<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;

class Access
{
    public function workspace(Workspace|string $workspace, string $ability = 'read'): Workspace
    {
        $w = is_string($workspace) ? Workspace::findOrFail($workspace) : $workspace;
        $user = app(Context::class)->user();
        abort_unless($user && app(WorkspacePolicy::class)->access($user, $w, $ability), 403, 'workspace_access_denied');

        return $w;
    }

    public function project(Project|string $project, string $ability = 'read'): Project
    {
        $p = is_string($project) ? Project::findOrFail($project) : $project;
        $this->workspace($p->workspace, $ability);
        if ($ability !== 'read') {
            abort_if($p->blocked(), 403, 'project_blocked');
        }

        return $p;
    }
}
