<?php

use App\Services\WebhookTransport;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(DatabaseMigrations::class);
it('round trips a real Redis delivery job and retains PostgreSQL ownership', function () {
    if (! filter_var(env('RUN_REDIS_TESTS', false), FILTER_VALIDATE_BOOLEAN)) {
        $this->markTestSkipped('Enable RUN_REDIS_TESTS with an isolated Redis service.');
    }
    config(['queue.default' => 'redis']);
    $redis = app('redis')->connection();
    $redis->ping();
    [$u,$w,$p] = hookdeskFixture();
    $transport = Mockery::mock(WebhookTransport::class);
    $transport->shouldReceive('send')->once()->andReturn(['status' => 200, 'body' => 'ok', 'truncated' => false, 'duration_ms' => 1, 'retry' => false, 'retry_after' => null, 'error' => null]);
    app()->instance(WebhookTransport::class, $transport);
    $event = acceptedEvent($p);
    $job = Queue::connection('redis')->pop('deliveries');
    expect($job)->not->toBeNull();
    $job->fire();
    $job->delete();
    expect($event->deliveries()->first()->status)->toBe('succeeded');
});
