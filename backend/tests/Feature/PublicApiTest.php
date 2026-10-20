<?php

use App\Models\ProjectApiKey;
use App\Models\WebhookSource;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Queue::fake();
});
it('accepts project-scoped requests and rejects revoked credentials', function () {
    [$u,$w,$p] = hookdeskFixture();
    $token = 'test-key';
    $key = ProjectApiKey::create(['project_id' => $p->id, 'created_by' => $u->id, 'name' => 'Test', 'prefix' => 'test', 'token_hash' => hash('sha256', $token), 'abilities' => ['events:write'], 'expires_at' => now()->addDay()]);
    $this->withToken($token)->postJson('/api/v1/events', ['type' => 'order.created', 'data' => (object) ['order_id' => 1]])->assertAccepted()->assertJsonPath('data.delivery_count', 1);
    $key->update(['revoked_at' => now()]);
    $this->postJson('/api/v1/events', ['type' => 'order.created', 'data' => (object) []])->assertUnauthorized();
});
