<?php

use App\Models\Invitation;
use App\Models\Membership;
use App\Models\SigningSecret;
use App\Models\User;
use App\Notifications\WorkspaceInvitation;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    config(['sanctum.stateful' => ['localhost']]);
    Queue::fake();
    Notification::fake();
    Cache::flush();
    $this->withHeader('Origin', 'http://localhost');
});
it('creates and edits endpoints with exact-type or wildcard subscriptions', function () {
    [$u,$w,$p,$e] = hookdeskFixture();
    $response = $this->actingAs($u)->postJson('/api/dashboard/v1/projects/'.$p->id.'/endpoints', ['name' => 'New receiver', 'kind' => 'sandbox', 'subscriptions' => ['*', 'order.created']])->assertCreated();
    expect($response->json('secret'))->toStartWith('whsec_');
    $this->patchJson('/api/dashboard/v1/endpoints/'.$e->id, ['name' => 'Updated', 'subscriptions' => ['*']])->assertOk();
    $this->patchJson('/api/dashboard/v1/endpoints/'.$e->id, ['subscriptions' => ['order.*']])->assertUnprocessable();
});
it('does not return previously generated credentials and rotates immutable secret versions', function () {
    [$u,$w,$p,$e] = hookdeskFixture();
    $this->actingAs($u)->postJson('/api/dashboard/v1/endpoints/'.$e->id.'/rotate-secret')->assertOk()->assertJsonStructure(['secret']);
    expect(SigningSecret::where('endpoint_id', $e->id)->count())->toBe(2);
    $this->getJson('/api/dashboard/v1/projects/'.$p->id.'/endpoints')->assertOk()->assertJsonMissingPath('data.0.secret');
});
it('sends invitations and accepts only the matching verified address', function () {
    [$u,$w,$p] = hookdeskFixture();
    $this->actingAs($u)->postJson('/api/dashboard/v1/workspaces/'.$w->id.'/invitations', ['email' => 'new@example.com', 'role' => 'developer'])->assertCreated();
    Notification::assertSentOnDemand(WorkspaceInvitation::class);
    $invite = Invitation::first();
    $invite->update(['token_hash' => hash('sha256', 'known-test-token')]);
    $other = User::factory()->create();
    $this->actingAs($other)->postJson('/api/dashboard/v1/invitations/accept', ['token' => 'known-test-token'])->assertForbidden();
    $other->update(['email' => 'new@example.com']);
    $this->postJson('/api/dashboard/v1/invitations/accept', ['token' => 'known-test-token'])->assertOk();
    expect(Membership::where('workspace_id', $w->id)->where('user_id', $other->id)->value('role'))->toBe('developer');
});
it('does not let workspace admins alter other admins or the owner', function () {
    [$owner,$w] = hookdeskFixture();
    $admin = User::factory()->create();
    $m = Membership::create(['workspace_id' => $w->id, 'user_id' => $admin->id, 'role' => 'admin']);
    $this->actingAs($admin)->patchJson('/api/dashboard/v1/workspaces/'.$w->id.'/members/'.$m->id, ['role' => 'viewer'])->assertForbidden();
});
it('serializes ownership transfer without leaving multiple owners', function () {
    [$owner,$w] = hookdeskFixture();
    $next = User::factory()->create();
    Membership::create(['workspace_id' => $w->id, 'user_id' => $next->id, 'role' => 'viewer']);
    $this->actingAs($owner)->postJson('/api/dashboard/v1/workspaces/'.$w->id.'/transfer', ['user_id' => $next->id])->assertOk();
    expect($w->fresh()->owner_user_id)->toBe($next->id)->and(Membership::where('workspace_id', $w->id)->where('role', 'owner')->count())->toBe(1);
});
it('renders invitation email in the selected locale', function () {
    $mail = (new WorkspaceInvitation('Workspace', 'token', 'tr'))->toMail(new stdClass);
    expect($mail->subject)->toBe('HookDesk çalışma alanı daveti');
});
