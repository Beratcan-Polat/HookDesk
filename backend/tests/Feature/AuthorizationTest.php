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
it('does not accept privileged fields during registration', function () {
    $this->postJson('/register', ['name' => 'Attacker', 'email' => 'a@example.com', 'password' => 'Password123456', 'password_confirmation' => 'Password123456', 'platform_role' => 'super_admin'])->assertUnprocessable();
    expect(User::count())->toBe(0);
});
