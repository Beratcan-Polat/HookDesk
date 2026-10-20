<?php

use App\Models\Delivery;
use App\Models\DeliveryAttempt;
use App\Models\Event;
use App\Models\UsageCounter;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\Process\Process;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(DatabaseMigrations::class);
beforeEach(function () {
    if (DB::getDriverName() !== 'pgsql') {
        $this->markTestSkipped('Requires PostgreSQL.');
    }Queue::fake();
});
function concurrentProcesses(string $mode, string $id): array
{
    $env = ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_HOST' => config('database.connections.pgsql.host'), 'DB_PORT' => (string) config('database.connections.pgsql.port'),
        'DB_DATABASE' => config('database.connections.pgsql.database'), 'DB_USERNAME' => config('database.connections.pgsql.username'), 'DB_PASSWORD' => config('database.connections.pgsql.password') ?? '',
        'QUEUE_CONNECTION' => 'database', 'CACHE_STORE' => 'array', 'MAIL_MAILER' => 'array', 'SESSION_DRIVER' => 'array'];
    $args = [PHP_BINARY];
    if (PHP_OS_FAMILY === 'Windows') {
        array_push($args, '-d', 'extension=pdo_pgsql');
    }
    array_push($args, base_path('tests/Support/concurrent-worker.php'), $mode, $id);
    $processes = array_map(fn () => new Process($args, base_path(), $env, null, 30), range(1, 4));
    foreach ($processes as $process) {
        $process->start();
    }
    foreach ($processes as $process) {
        $process->wait();
        expect($process->isSuccessful(), $process->getErrorOutput())->toBeTrue();
    }

    return array_map(fn ($p) => trim($p->getOutput()), $processes);
}
it('serializes simultaneous event submissions into a single durable event', function () {
    [$u,$w,$p] = hookdeskFixture();
    $ids = concurrentProcesses('accept', $p->id);
    expect(array_unique($ids))->toHaveCount(1)->and(Event::count())->toBe(1)->and(Delivery::count())->toBe(1)->and(UsageCounter::first()->events)->toBe(1);
});
it('allows one worker to claim a delivery across separate connections', function () {
    [$u,$w,$p] = hookdeskFixture();
    $d = acceptedEvent($p)->deliveries()->first();
    concurrentProcesses('deliver', $d->id);
    expect($d->fresh()->status)->toBe('succeeded')->and(DeliveryAttempt::count())->toBe(1)->and(DB::table('demo_receipts')->value('requests'))->toBe(1);
});
