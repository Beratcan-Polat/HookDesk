<?php

use App\Actions\AcceptEvent;
use App\Actions\ReplayDelivery;
use App\Models\Delivery;
use App\Models\DeliveryAttempt;
use App\Models\Event;
use App\Models\SigningSecret;
use App\Models\UsageCounter;
use App\Models\WorkspaceLimitOverride;
use App\Services\DeliveryEngine;
use App\Services\DispatchDue;
use App\Services\WebhookTransport;
use Illuminate\Contracts\Queue\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\HttpKernel\Exception\HttpException;

beforeEach(function () {
    Queue::fake();
    Cache::flush();
});
function transportResult(int $status): array
{
    return ['status' => $status, 'body' => 'ok', 'truncated' => false, 'duration_ms' => 15, 'retry' => $status >= 500, 'retry_after' => null, 'error' => $status >= 300 ? 'http_'.$status : null];
}
it('persists immutable signed envelopes and routes events', function () {
    [$u,$w,$p,$e] = hookdeskFixture();
    $event = acceptedEvent($p);
    $d = $event->deliveries()->first();
    expect($d->endpoint_id)->toBe($e->id)->and(json_decode($event->body)->id)->toBe($event->id);
    expect(UsageCounter::first()->events)->toBe(1);
    $this->mock(WebhookTransport::class)->shouldReceive('send')->once()->andReturn(transportResult(200));
    app(DeliveryEngine::class)->handle($d->id);
    app(DeliveryEngine::class)->handle($d->id);
    expect($d->fresh()->status)->toBe('succeeded')->and(DeliveryAttempt::count())->toBe(1);
});
it('deduplicates an idempotent request and rejects changed bytes', function () {
    [$u,$w,$p] = hookdeskFixture();
    $a = acceptedEvent($p, 'request-1');
    $b = acceptedEvent($p, 'request-1');
    expect($a->id)->toBe($b->id)->and(Event::count())->toBe(1)->and(Delivery::count())->toBe(1)->and(UsageCounter::first()->events)->toBe(1);
    expect(fn () => app(AcceptEvent::class)->execute($p, 'order.created', (object) ['order_id' => 43], '{"order_id":43}', 'request-1'))->toThrow(HttpException::class);
});
it('schedules retries and stops on permanent failures', function () {
    [$u,$w,$p] = hookdeskFixture();
    $d = acceptedEvent($p)->deliveries()->first();
    $this->mock(WebhookTransport::class)->shouldReceive('send')->once()->andReturn(transportResult(500));
    app(DeliveryEngine::class)->handle($d->id);
    expect($d->fresh()->status)->toBe('retrying')->and($d->fresh()->next_attempt_at->isFuture())->toBeTrue();
    $this->travel(20)->seconds();
    $this->mock(WebhookTransport::class)->shouldReceive('send')->once()->andReturn(transportResult(400));
    app(DeliveryEngine::class)->handle($d->id);
    expect($d->fresh()->status)->toBe('failed');
});
it('recovers interrupted attempts without allowing stale completion', function () {
    [$u,$w,$p] = hookdeskFixture();
    $d = acceptedEvent($p)->deliveries()->first();
    $d->update(['status' => 'processing', 'attempt_count' => 1, 'lease_token' => 'old', 'locked_until' => now()->subSecond()]);
    DeliveryAttempt::create(['delivery_id' => $d->id, 'number' => 1]);
    app(DispatchDue::class)->recover();
    expect($d->fresh()->status)->toBe('retrying')->and($d->fresh()->lease_token)->toBeNull()->and(DeliveryAttempt::first()->outcome)->toBe('unknown');
});
it('preserves pending work when queue dispatch fails', function () {
    [$u,$w,$p] = hookdeskFixture();
    Queue::swap(Mockery::mock(Factory::class)->shouldReceive('connection')->andThrow(new RuntimeException('offline'))->getMock());
    $event = acceptedEvent($p);
    expect($event->deliveries()->count())->toBe(1)->and($event->deliveries()->first()->queued_until)->toBeNull();
});
it('holds delivery while workspace is suspended and expires old work', function () {
    [$u,$w,$p] = hookdeskFixture();
    $d = acceptedEvent($p)->deliveries()->first();
    $w->update(['suspended' => true]);
    app(DeliveryEngine::class)->handle($d->id);
    expect($d->fresh()->attempt_count)->toBe(0);
    $this->travel(25)->hours();
    app(DispatchDue::class)->recover();
    expect($d->fresh()->status)->toBe('failed')->and($d->fresh()->last_error)->toBe('expired');
});
it('snapshots destination and secret version and links replays', function () {
    [$u,$w,$p,$e] = hookdeskFixture();
    $d = acceptedEvent($p)->deliveries()->first();
    $e->update(['url' => 'https://changed.example.com']);
    $d->update(['status' => 'failed', 'completed_at' => now()]);
    SigningSecret::create(['endpoint_id' => $e->id, 'version' => 2, 'secret' => 'new-secret']);
    $new = app(ReplayDelivery::class)->execute($d);
    expect($new->event_id)->toBe($d->event_id)->and($new->replay_of_delivery_id)->toBe($d->id)->and($new->signing_secret_id)->not->toBe($d->signing_secret_id);
});
it('stores capture-only events without deliveries', function () {
    [$u,$w,$p] = hookdeskFixture();
    [$event] = app(AcceptEvent::class)->execute($p, 'webhook.received', (object) ['a' => 1], '{"a":1}', producer: 'source', forward: false);
    expect($event->routing_result)->toBe('captured')->and($event->deliveries()->count())->toBe(0);
});
it('enforces per-workspace quotas transactionally', function () {
    [$u,$w,$p] = hookdeskFixture();
    WorkspaceLimitOverride::create(['workspace_id' => $w->id, 'key' => 'events_daily', 'value' => 1]);
    acceptedEvent($p);
    expect(fn () => acceptedEvent($p))->toThrow(HttpException::class);
    expect(Event::count())->toBe(1);
});
