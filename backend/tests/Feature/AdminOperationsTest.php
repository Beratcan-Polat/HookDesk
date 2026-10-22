<?php

use App\Models\AuditLog;
use App\Models\Delivery;
use App\Models\Membership;
use App\Models\PlatformSetting;
use App\Models\User;
use App\Models\WorkspaceLimitOverride;
use App\Services\Settings;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function () {
    config(['sanctum.stateful' => ['localhost']]);
    $this->withHeader('Origin', 'http://localhost');
    Queue::fake();
});

it('reports each replay result and retains the original event identity', function () {
    [$u, $w, $p] = hookdeskFixture();
    $failed = acceptedEvent($p)->deliveries()->first();
    $failed->update(['status' => 'failed', 'completed_at' => now()]);
    $pending = acceptedEvent($p)->deliveries()->first();
    $missing = (string) Str::ulid();
    $admin = adminUser();
    $response = $this->actingAs($admin)->withSession(['admin_step_up_at' => now()->timestamp])
        ->postJson('/api/admin/v1/deliveries/replay', ['delivery_ids' => [$failed->id, $pending->id, $missing], 'reason' => 'Investigate failed destination'])
        ->assertAccepted()->assertJsonPath('data.0.ok', true)
        ->assertJsonPath('data.1.error', 'only_failed_deliveries')
        ->assertJsonPath('data.2.error', 'not_found');
    $replay = Delivery::findOrFail($response->json('data.0.replay_id'));
    expect($replay->event_id)->toBe($failed->event_id)
        ->and($replay->replay_of_delivery_id)->toBe($failed->id)
        ->and(AuditLog::where('action', 'delivery.replayed')->where('actor_id', $admin->id)->exists())->toBeTrue();
});

it('rejects oversized or duplicated replay selections before creating work', function () {
    [$u, $w, $p] = hookdeskFixture();
    $failed = acceptedEvent($p)->deliveries()->first();
    $failed->update(['status' => 'failed']);
    $this->actingAs(adminUser())->withSession(['admin_step_up_at' => now()->timestamp]);
    $this->postJson('/api/admin/v1/deliveries/replay', ['delivery_ids' => array_map(fn () => (string) Str::ulid(), range(1, 101)), 'reason' => 'Oversized replay attempt'])->assertUnprocessable();
    $this->postJson('/api/admin/v1/deliveries/replay', ['delivery_ids' => [$failed->id, $failed->id], 'reason' => 'Duplicate replay attempt'])->assertUnprocessable();
    expect(Delivery::count())->toBe(1);
});

it('shows effective limits and restores inheritance from the live platform default', function () {
    [$u, $w] = hookdeskFixture();
    PlatformSetting::create(['key' => 'limit.ingest_per_minute', 'value' => 40]);
    $admin = adminUser();
    $this->actingAs($admin)->withSession(['admin_step_up_at' => now()->timestamp]);
    $this->putJson('/api/admin/v1/workspaces/'.$w->id.'/limits', ['key' => 'ingest_per_minute', 'value' => 80, 'reason' => 'Temporary throughput increase'])->assertOk();
    $this->getJson('/api/admin/v1/workspaces/'.$w->id)->assertOk()
        ->assertJsonPath('default_limits.ingest_per_minute', 40)->assertJsonPath('effective_limits.ingest_per_minute', 80)
        ->assertJsonCount(count(app(Settings::class)->workspaceLimitKeys()), 'effective_limits');
    $this->deleteJson('/api/admin/v1/workspaces/'.$w->id.'/limits/ingest_per_minute', ['reason' => 'Return to platform defaults'])->assertNoContent();
    expect(WorkspaceLimitOverride::where('workspace_id', $w->id)->count())->toBe(0);
    PlatformSetting::find('limit.ingest_per_minute')->update(['value' => 60]);
    $this->getJson('/api/admin/v1/workspaces/'.$w->id)->assertOk()->assertJsonPath('effective_limits.ingest_per_minute', 60);
    $log = AuditLog::where('action', 'admin.limit_reset')->firstOrFail();
    expect($log->actor_id)->toBe($admin->id)->and($log->reason)->toBe('Return to platform defaults');
});

it('protects workspace limit reset with administrator authentication, step-up, reasons and typed keys', function () {
    [$u, $w] = hookdeskFixture();
    $path = '/api/admin/v1/workspaces/'.$w->id.'/limits/ingest_per_minute';
    $this->actingAs($u)->deleteJson($path, ['reason' => 'Unauthorized reset'])->assertForbidden();
    $this->actingAs(adminUser())->deleteJson($path, ['reason' => 'Missing verification'])->assertStatus(423);
    $this->withSession(['admin_step_up_at' => now()->timestamp])->deleteJson($path)->assertUnprocessable();
    $this->deleteJson('/api/admin/v1/workspaces/'.$w->id.'/limits/APP_KEY', ['reason' => 'Invalid key attempt'])->assertUnprocessable();
    $this->putJson('/api/admin/v1/workspaces/'.$w->id.'/limits', ['key' => 'owned_workspaces', 'value' => 8, 'reason' => 'Wrong scope attempt'])->assertUnprocessable();
    $this->putJson('/api/admin/v1/workspaces/'.$w->id.'/limits', ['key' => 'events_daily', 'value' => 0, 'reason' => 'Invalid value attempt'])->assertUnprocessable();
});

it('rechecks eligibility when a selected ownership candidate changes status', function () {
    [$owner, $workspace] = hookdeskFixture();
    $candidate = User::factory()->create();
    Membership::create(['workspace_id' => $workspace->id, 'user_id' => $candidate->id, 'role' => 'developer']);
    $candidate->forceFill(['status' => 'suspended'])->save();
    $this->actingAs(adminUser())->withSession(['admin_step_up_at' => now()->timestamp])
        ->postJson('/api/admin/v1/workspaces/'.$workspace->id.'/actions', ['action' => 'transfer', 'user_id' => $candidate->id, 'reason' => 'Ownership transfer attempt'])
        ->assertUnprocessable();
    expect($workspace->fresh()->owner_user_id)->toBe($owner->id);
});
