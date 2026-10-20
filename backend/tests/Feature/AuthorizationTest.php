<?php

use App\Models\AuditLog;
use App\Models\SupportSession;
use App\Models\User;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    config(['sanctum.stateful' => ['localhost']]);
    Queue::fake();
    $this->withHeader('Origin', 'http://localhost');
});
it('rejects cross-workspace access without granting a super admin bypass', function () {
    [$u,$w,$p] = hookdeskFixture();
    $other = User::factory()->create();
    $this->actingAs($other)->getJson('/api/dashboard/v1/projects/'.$p->id.'/events')->assertForbidden();
    $this->actingAs(adminUser())->getJson('/api/dashboard/v1/projects/'.$p->id.'/events')->assertForbidden();
});
it('does not accept privileged fields during registration', function () {
    $this->postJson('/register', ['name' => 'Attacker', 'email' => 'a@example.com', 'password' => 'Password123456', 'password_confirmation' => 'Password123456', 'platform_role' => 'super_admin'])->assertUnprocessable();
    expect(User::count())->toBe(0);
});
it('requires confirmed 2fa for administration', function () {
    $u = User::factory()->create();
    $u->forceFill(['platform_role' => 'super_admin'])->save();
    $this->actingAs($u)->getJson('/api/admin/v1/users')->assertForbidden();
});
it('requires step-up and a reason for administrative changes', function () {
    $a = adminUser();
    $u = User::factory()->create();
    $this->actingAs($a)->patchJson('/api/admin/v1/users/'.$u->id, ['status' => 'suspended', 'reason' => 'Abuse investigation'])->assertStatus(423);
    $this->withSession(['admin_step_up_at' => now()->timestamp])->patchJson('/api/admin/v1/users/'.$u->id, ['status' => 'suspended'])->assertUnprocessable();
});
it('protects the last active super administrator', function () {
    $a = adminUser();
    $this->actingAs($a)->withSession(['admin_step_up_at' => now()->timestamp])->patchJson('/api/admin/v1/users/'.$a->id, ['status' => 'suspended', 'reason' => 'Testing protection'])->assertUnprocessable();
    expect($a->fresh()->status)->toBe('active');
});
it('enforces current effective role and records both identities during support', function () {
    [$u,$w,$p,$e] = hookdeskFixture();
    $a = adminUser();
    $s = SupportSession::create(['actor_id' => $a->id, 'user_id' => $u->id, 'workspace_id' => $w->id, 'reason' => 'Investigate delivery', 'expires_at' => now()->addMinutes(30)]);
    $this->actingAs($a)->patchJson('/api/support/v1/sessions/'.$s->id.'/endpoints/'.$e->id, ['paused' => true])->assertOk();
    $log = AuditLog::where('action', 'support.endpoint.update')->first();
    expect($log->actor_id)->toBe($a->id)->and($log->effective_user_id)->toBe($u->id)->and($e->fresh()->paused)->toBeTrue();
    $this->postJson('/api/support/v1/sessions/'.$s->id.'/projects/'.$p->id.'/sources', ['name' => 'Blocked', 'event_type' => 'test.created', 'mode' => 'capture_only'])->assertForbidden();
});
it('blocks support sessions outside the selected workspace and after expiry', function () {
    [$u,$w,$p] = hookdeskFixture();
    [$other,$w2,$p2] = hookdeskFixture();
    $a = adminUser();
    $s = SupportSession::create(['actor_id' => $a->id, 'user_id' => $u->id, 'workspace_id' => $w->id, 'reason' => 'Investigate delivery', 'expires_at' => now()->addMinutes(30)]);
    $this->actingAs($a)->getJson('/api/support/v1/sessions/'.$s->id.'/projects/'.$p2->id.'/events')->assertForbidden();
    $this->actingAs($other)->getJson('/api/support/v1/sessions/'.$s->id.'/workspaces')->assertForbidden();
    $this->travel(31)->minutes();
    $this->actingAs($a)->getJson('/api/support/v1/sessions/'.$s->id.'/workspaces')->assertForbidden();
});
it('requires a reason and records privileged payload reads', function () {
    [$u,$w,$p] = hookdeskFixture();
    $event = acceptedEvent($p);
    $a = adminUser();
    $this->actingAs($a)->withSession(['admin_step_up_at' => now()->timestamp])->postJson('/api/admin/v1/events/'.$event->id.'/payload', [])->assertUnprocessable();
    $this->postJson('/api/admin/v1/events/'.$event->id.'/payload', ['reason' => 'Investigate malformed event'])->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    expect(AuditLog::where('action', 'admin.payload_viewed')->count())->toBe(1);
});
