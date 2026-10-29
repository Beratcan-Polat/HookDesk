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
it('allows a verified administrator without 2fa and rejects ordinary or unverified accounts', function () {
    $u = User::factory()->create();
    $u->forceFill(['platform_role' => 'super_admin'])->save();
    $this->actingAs($u)->getJson('/api/admin/v1/users')->assertOk();
    $u->forceFill(['email_verified_at' => null])->save();
    $this->getJson('/api/admin/v1/users')->assertForbidden();
    $this->actingAs(User::factory()->create())->getJson('/api/admin/v1/users')->assertForbidden();
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
it('keeps support active without a time limit and blocks it after explicit termination', function () {
    [$u,$w,$p] = hookdeskFixture();
    [$other,$w2,$p2] = hookdeskFixture();
    $a = adminUser();
    $s = SupportSession::create(['actor_id' => $a->id, 'user_id' => $u->id, 'workspace_id' => $w->id, 'reason' => 'Investigate delivery']);
    $this->actingAs($a)->getJson('/api/support/v1/sessions/'.$s->id.'/projects/'.$p2->id.'/events')->assertForbidden();
    $this->actingAs($other)->getJson('/api/support/v1/sessions/'.$s->id.'/workspaces')->assertForbidden();
    $this->travel(2)->days();
    $this->actingAs($a)->getJson('/api/support/v1/sessions/'.$s->id.'/workspaces')->assertOk();
    $s->update(['revoked_at' => now()]);
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

it('creates support with no expiry and revokes the previous active session', function () {
    [$user, $workspace] = hookdeskFixture();
    $admin = adminUser();
    $this->actingAs($admin)->withSession(['admin_step_up_at' => now()->timestamp]);
    $data = ['user_id' => $user->id, 'workspace_id' => $workspace->id, 'reason' => 'Help with project setup'];
    $first = $this->postJson('/api/admin/v1/support-sessions', $data)->assertCreated()->assertJsonPath('data.expires_at', null)->json('data.id');
    $second = $this->postJson('/api/admin/v1/support-sessions', $data)->assertCreated()->assertJsonPath('data.expires_at', null)->json('data.id');
    expect(SupportSession::findOrFail($first)->revoked_at)->not->toBeNull()
        ->and(SupportSession::findOrFail($second)->revoked_at)->toBeNull();
});

it('migrates active support to unlimited without reopening previously expired sessions', function () {
    [$user, $workspace] = hookdeskFixture();
    $active = SupportSession::create(['actor_id' => adminUser()->id, 'user_id' => $user->id, 'workspace_id' => $workspace->id, 'reason' => 'Active legacy support', 'expires_at' => now()->addMinutes(10)]);
    $expired = SupportSession::create(['actor_id' => adminUser()->id, 'user_id' => $user->id, 'workspace_id' => $workspace->id, 'reason' => 'Expired legacy support', 'expires_at' => now()->subMinute()]);
    $migration = require database_path('migrations/2026_10_29_100000_make_support_sessions_unlimited.php');
    $migration->up();
    expect($active->fresh()->expires_at)->toBeNull()->and($active->fresh()->revoked_at)->toBeNull()
        ->and($expired->fresh()->revoked_at)->not->toBeNull();
});
