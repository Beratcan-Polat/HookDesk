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
