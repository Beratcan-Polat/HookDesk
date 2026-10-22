<?php

use App\Actions\AcceptEvent;
use App\Models\Endpoint;
use App\Models\EndpointSubscription;
use App\Models\Membership;
use App\Models\Project;
use App\Models\SigningSecret;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function seedBrowserOperations(User $owner): array
{
    if (app()->environment('production')) {
        throw new RuntimeException('Browser fixtures are forbidden in production.');
    }
    Queue::fake();
    $fixtures = [];
    foreach (['en', 'tr'] as $locale) {
        $workspace = Workspace::create(['name' => 'Browser '.strtoupper($locale).' '.Str::random(8), 'owner_user_id' => $owner->id]);
        Membership::create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => 'owner']);
        $candidate = User::create(['name' => 'Verified '.$locale.' member', 'email' => Str::ulid().'@hookdesk.test', 'password' => Str::password(24), 'locale' => $locale]);
        $candidate->forceFill(['email_verified_at' => now()])->save();
        Membership::create(['workspace_id' => $workspace->id, 'user_id' => $candidate->id, 'role' => 'viewer']);
        $unverified = User::create(['name' => 'Unverified '.$locale.' member', 'email' => Str::ulid().'@hookdesk.test', 'password' => Str::password(24)]);
        Membership::create(['workspace_id' => $workspace->id, 'user_id' => $unverified->id, 'role' => 'developer']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Panel operations']);
        $endpoint = Endpoint::create(['project_id' => $project->id, 'name' => 'Panel receiver', 'kind' => 'sandbox', 'sandbox_behavior' => 'success']);
        EndpointSubscription::create(['endpoint_id' => $endpoint->id, 'event_type' => '*']);
        SigningSecret::create(['endpoint_id' => $endpoint->id, 'version' => 1, 'secret' => 'whsec_'.Str::random(48)]);
        $ids = [];
        foreach (['failed', 'failed', 'succeeded'] as $status) {
            $raw = json_encode(['type' => 'panel.test', 'data' => (object) ['locale' => $locale]], JSON_THROW_ON_ERROR);
            [$event] = app(AcceptEvent::class)->execute($project, 'panel.test', (object) ['locale' => $locale], $raw);
            $delivery = $event->deliveries()->firstOrFail();
            $delivery->update(['status' => $status, 'attempt_count' => $status === 'failed' ? 6 : 1, 'queued_until' => null, 'completed_at' => now(), 'last_error' => $status === 'failed' ? 'http_500' : null]);
            $ids[$status][] = $delivery->id;
        }
        $fixtures[$locale] = ['workspace_id' => $workspace->id, 'workspace_name' => $workspace->name, 'owner_id' => $owner->id, 'target_id' => $candidate->id, 'target_name' => $candidate->name, 'unverified_name' => $unverified->name, 'failed_ids' => $ids['failed'], 'succeeded_id' => $ids['succeeded'][0]];
    }

    return $fixtures;
}
