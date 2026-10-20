<?php

use App\Services\CurlTransport;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\Process\Process;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(DatabaseMigrations::class);
it('delivers actual signed HTTP requests and bounds response capture', function () {
    if (DB::getDriverName() !== 'pgsql') {
        $this->markTestSkipped('Real HTTP receiver requires PostgreSQL.');
    }
    Queue::fake();
    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $port = substr($address, strrpos($address, ':') + 1);
    config(['hookdesk.receiver_url' => 'http://127.0.0.1:'.$port]);
    [$u,$w,$p,$endpoint] = hookdeskFixture();
    $endpoint->update(['sandbox_behavior' => 'fail_twice']);
    $delivery = acceptedEvent($p)->deliveries()->first();
    $env = ['APP_ENV' => 'testing', 'APP_ROLE' => 'receiver', 'DB_CONNECTION' => 'pgsql', 'DB_HOST' => config('database.connections.pgsql.host'), 'DB_PORT' => (string) config('database.connections.pgsql.port'),
        'DB_DATABASE' => config('database.connections.pgsql.database'), 'DB_USERNAME' => config('database.connections.pgsql.username'), 'DB_PASSWORD' => config('database.connections.pgsql.password') ?? '', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array'];
    $args = [PHP_BINARY];
    if (PHP_OS_FAMILY === 'Windows') {
        array_push($args, '-d', 'extension=pdo_pgsql');
    }array_push($args, '-S', '127.0.0.1:'.$port, '-t', 'public');
    $server = new Process($args, base_path(), $env);
    $server->start();
    try {
        $server->waitUntil(fn ($type, $output) => str_contains($output, 'Development Server'));
        $transport = app(CurlTransport::class);
        $a = $transport->send($delivery, 1);
        $b = $transport->send($delivery, 2);
        $c = $transport->send($delivery, 3);
        $duplicate = $transport->send($delivery, 4);
        expect($a['status'])->toBe(500)->and($b['retry'])->toBeTrue()->and($c['status'])->toBe(200)->and($c['error'])->toBeNull();
        expect(json_decode($duplicate['body'], true)['duplicate'])->toBeTrue();
        config(['hookdesk.max_response_bytes' => 8]);
        $limited = $transport->send($delivery, 5);
        expect(strlen($limited['body']))->toBe(8)->and($limited['truncated'])->toBeTrue()->and($limited['error'])->toBeNull();
    } finally {
        $server->stop();
    }
});
