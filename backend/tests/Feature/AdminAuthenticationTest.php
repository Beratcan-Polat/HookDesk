<?php

use App\Models\User;
use App\Services\AdminUsers;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    Cache::flush();
});

it('signs in an administrator with an existing authenticator using only the correct password', function () {
    $admin = adminUser();
    $admin->forceFill(['password' => Hash::make('TestPassword123456')])->save();
    $this->postJson('/login', ['email' => $admin->email, 'password' => 'wrong-password'])->assertUnprocessable();
    $this->assertGuest();
    $this->postJson('/login', ['email' => $admin->email, 'password' => 'TestPassword123456'])->assertOk()->assertJsonPath('two_factor', false);
    $this->assertAuthenticatedAs($admin);
    $this->getJson('/api/me')->assertOk()->assertJsonPath('two_factor_enabled', false);
});

it('retains optional authenticator challenges for ordinary accounts', function () {
    $user = adminUser();
    $user->forceFill(['platform_role' => 'user', 'password' => Hash::make('TestPassword123456')])->save();
    $this->postJson('/login', ['email' => $user->email, 'password' => 'TestPassword123456'])->assertOk()->assertJsonPath('two_factor', true);
    $this->assertGuest();
});

it('confirms administrative changes with a password and expires that confirmation after five minutes', function () {
    $admin = adminUser();
    $admin->forceFill(['two_factor_secret' => null, 'two_factor_confirmed_at' => null, 'password' => Hash::make('TestPassword123456')])->save();
    config(['sanctum.stateful' => ['localhost']]);
    $this->withHeader('Origin', 'http://localhost')->actingAs($admin);
    $this->postJson('/api/admin/v1/step-up', ['password' => 'wrong-password'])->assertUnprocessable();
    $this->postJson('/api/admin/v1/step-up', ['password' => 'TestPassword123456'])->assertNoContent();
    $this->putJson('/api/admin/v1/settings', ['key' => 'registration_enabled', 'value' => true, 'reason' => 'Password-only verification'])->assertOk();
    $this->travel(6)->minutes();
    $this->putJson('/api/admin/v1/settings', ['key' => 'registration_enabled', 'value' => false, 'reason' => 'Expired password verification'])->assertStatus(423);
});

it('promotes verified active accounts without requiring an authenticator', function () {
    $user = User::factory()->create();
    $updated = app(AdminUsers::class)->change($user, ['platform_role' => 'super_admin'], 'Verified administrator assignment');
    expect($updated->isSuperAdmin())->toBeTrue()->and($updated->two_factor_confirmed_at)->toBeNull();
});
