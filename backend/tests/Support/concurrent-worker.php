<?php

use App\Actions\AcceptEvent;
use App\Models\Delivery;
use App\Models\Project;
use App\Services\DeliveryEngine;
use App\Services\WebhookTransport;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing')) {
    throw new RuntimeException('Only an isolated testing database may run concurrency fixtures.');
}
if ($argv[1] === 'accept') {
    $p = Project::findOrFail($argv[2]);
    [$e] = app(AcceptEvent::class)->execute($p, 'order.created', (object) ['id' => 1], '{"id":1}', 'concurrent-key');
    echo $e->id;
} else {
    app()->bind(WebhookTransport::class, fn () => new class implements WebhookTransport
    {
        public function send(Delivery $d, int $attempt): array
        {
            DB::table('demo_receipts')->insertOrIgnore(['event_id' => $d->event_id, 'endpoint_id' => $d->endpoint_id, 'requests' => 0, 'processed' => false, 'created_at' => now(), 'updated_at' => now()]);
            DB::table('demo_receipts')->where('event_id', $d->event_id)->where('endpoint_id', $d->endpoint_id)->increment('requests');
            usleep(250000);

            return ['status' => 200, 'body' => 'ok', 'truncated' => false, 'duration_ms' => 250, 'retry' => false, 'retry_after' => null, 'error' => null];
        }
    });
    app(DeliveryEngine::class)->handle($argv[2]);
    echo 'done';
}
