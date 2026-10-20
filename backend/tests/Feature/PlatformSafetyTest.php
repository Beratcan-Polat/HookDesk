<?php

use App\Models\AuditLog;
use App\Models\ProjectApiKey;
use App\Models\User;
use App\Services\AdminUsers;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\HttpKernel\Exception\HttpException;

beforeEach(function () {
    config(['sanctum.stateful' => ['localhost']]);
    $this->withHeader('Origin', 'http://localhost');
    Cache::flush();
    Queue::fake();
});
it('does not abandon the only usable admin in favor of an unconfigured bootstrap account', function () {
    $a = adminUser();
    $pending = User::factory()->create();
    $pending->forceFill(['platform_role' => 'super_admin'])->save();
    expect(fn () => app(AdminUsers::class)->change($a, ['platform_role' => 'user'], 'Protection test'))->toThrow(HttpException::class);
});
it('attributes ordinary endpoint changes to the correct workspace audit', function () {
    [$u,$w,$p,$e] = hookdeskFixture();
    $this->actingAs($u)->patchJson('/api/dashboard/v1/endpoints/'.$e->id, ['paused' => true])->assertOk();
    $log = AuditLog::where('action', 'dashboard.endpoint.update')->first();
    expect($log->workspace_id)->toBe($w->id)->and($log->resource_id)->toBe($e->id)->and($log->actor_id)->toBe($u->id);
});
it('rejects unknown platform settings even after step-up', function () {
    $this->actingAs(adminUser())->withSession(['admin_step_up_at' => now()->timestamp])->putJson('/api/admin/v1/settings', ['key' => 'APP_KEY', 'value' => 'attack', 'reason' => 'Unsupported setting attempt'])->assertUnprocessable();
});
it('blocks owned workspace keys on suspension without deleting them', function () {
    [$u,$w,$p] = hookdeskFixture();
    $key = ProjectApiKey::create(['project_id' => $p->id, 'created_by' => $u->id, 'name' => 'test', 'prefix' => 'test', 'token_hash' => hash('sha256', 'stable-token'), 'abilities' => ['events:write'], 'expires_at' => now()->addDay()]);
    app(AdminUsers::class)->change($u, ['status' => 'suspended'], 'Abuse investigation');
    $this->withToken('stable-token')->postJson('/api/v1/events', ['type' => 'order.created', 'data' => (object) []])->assertForbidden();
    expect($key->fresh()->revoked_at)->toBeNull()->and($w->fresh()->blocked())->toBeTrue();
});
