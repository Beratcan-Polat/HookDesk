<?php

use App\Actions\AcceptEvent;
use App\Models\Endpoint;
use App\Models\EndpointSubscription;
use App\Models\Event;
use App\Models\Membership;
use App\Models\Project;
use App\Models\SigningSecret;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');
pest()->extend(TestCase::class)->in('Unit');
function hookdeskFixture(string $role = 'owner'): array
{
    $u = User::factory()->create();
    $w = Workspace::create(['name' => 'Test workspace', 'owner_user_id' => $u->id]);
    Membership::create(['workspace_id' => $w->id, 'user_id' => $u->id, 'role' => $role]);
    $p = Project::create(['workspace_id' => $w->id, 'name' => 'Test project']);
    $e = Endpoint::create(['project_id' => $p->id, 'name' => 'Receiver', 'kind' => 'sandbox']);
    EndpointSubscription::create(['endpoint_id' => $e->id, 'event_type' => '*']);
    SigningSecret::create(['endpoint_id' => $e->id, 'version' => 1, 'secret' => 'test-signing-secret']);

    return [$u, $w, $p, $e];
}
function adminUser(): User
{
    $u = User::factory()->create();
    $u->forceFill(['platform_role' => 'super_admin', 'two_factor_secret' => encrypt('JBSWY3DPEHPK3PXP'), 'two_factor_confirmed_at' => now()])->save();

    return $u;
}
function acceptedEvent(Project $p, ?string $key = null): Event
{
    return app(AcceptEvent::class)->execute($p, 'order.created', (object) ['order_id' => 42], '{"order_id":42}', $key)[0];
}
