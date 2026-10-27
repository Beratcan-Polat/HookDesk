<?php

use App\Models\Delivery;
use App\Models\DeliveryAttempt;
use App\Models\Endpoint;
use App\Models\EndpointSubscription;
use App\Models\Event;
use App\Models\Membership;
use App\Models\Project;
use App\Models\ProjectApiKey;
use App\Models\SigningSecret;
use App\Models\UsageCounter;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceLimitOverride;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || getenv('HOOKDESK_LOAD_TEST') !== 'true' || config('database.connections.pgsql.database') !== 'hookdesk_load' || config('database.default') !== 'pgsql') {
    throw new RuntimeException('Use the isolated performance Compose project.');
}
$action = $argv[1] ?? '';
$scope = $argv[2] ?? '';
if ($action === 'seed') {
    if (! preg_match('/^[a-z0-9-]{1,100}$/D', $scope)) {
        throw new RuntimeException('Invalid run label.');
    }
    $user = User::create(['name' => 'Load test', 'email' => $scope.'@load.hookdesk.test', 'password' => Str::password(24)]);
    $workspace = Workspace::create(['name' => $scope, 'owner_user_id' => $user->id]);
    Membership::create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'role' => 'owner']);
    $project = Project::create(['workspace_id' => $workspace->id, 'name' => $scope]);
    $endpoint = Endpoint::create(['project_id' => $project->id, 'name' => 'Signed load receiver', 'kind' => 'sandbox', 'sandbox_behavior' => 'success']);
    EndpointSubscription::create(['endpoint_id' => $endpoint->id, 'event_type' => 'load.accepted']);
    SigningSecret::create(['endpoint_id' => $endpoint->id, 'version' => 1, 'secret' => 'whsec_'.Str::random(48)]);
    $token = 'hd_'.Str::random(64);
    ProjectApiKey::create(['project_id' => $project->id, 'created_by' => $user->id, 'name' => 'Load test', 'token_hash' => hash('sha256', $token), 'prefix' => substr($token, 0, 12), 'abilities' => ['events:write', 'events:read'], 'expires_at' => now()->addHour()]);
    $limits = config('hookdesk.limits');
    if (($argv[3] ?? '') === 'capacity') {
        foreach (['events_daily' => 100000, 'ingest_per_minute' => 60000, 'workspace_per_second' => 1000, 'endpoint_per_second' => 1000] as $key => $value) {
            WorkspaceLimitOverride::create(['workspace_id' => $workspace->id, 'key' => $key, 'value' => $value]);
            $limits[$key] = $value;
        }
    }
    echo json_encode(['project_id' => $project->id, 'workspace_id' => $workspace->id, 'token' => $token, 'limits' => $limits], JSON_THROW_ON_ERROR);
} elseif (in_array($action, ['snapshot', 'metrics'], true)) {
    $project = Project::whereKey($scope)->where('name', 'like', 'load-%')->firstOrFail();
    $events = Event::where('project_id', $project->id);
    $deliveries = Delivery::whereIn('event_id', (clone $events)->select('id'));
    $attempts = DeliveryAttempt::whereIn('delivery_id', (clone $deliveries)->select('id'));
    $receipt = DB::table('demo_receipts')->whereIn('endpoint_id', $project->endpoints()->select('id'));
    $body = ['events' => $events->count(), 'deliveries' => $deliveries->count(), 'statuses' => (clone $deliveries)->select('status', DB::raw('count(*) as total'))->groupBy('status')->pluck('total', 'status'), 'attempts' => $attempts->count(), 'receipts' => $receipt->count(), 'processed_receipts' => (clone $receipt)->where('processed', true)->count(), 'receiver_requests' => (int) $receipt->sum('requests'), 'usage' => (int) UsageCounter::where('workspace_id', $project->workspace_id)->sum('events')];
    if ($action === 'metrics') {
        $body['http_ms'] = (clone $attempts)->pluck('duration_ms');
        $body['queue_ms'] = DB::table('delivery_attempts as a')->join('deliveries as d', 'd.id', '=', 'a.delivery_id')->join('events as e', 'e.id', '=', 'd.event_id')->where('e.project_id', $project->id)->where('a.number', 1)->selectRaw('EXTRACT(EPOCH FROM (a.created_at - d.created_at))*1000 as value')->pluck('value');
        $body['delivery_ms'] = (clone $deliveries)->whereNotNull('completed_at')->selectRaw('EXTRACT(EPOCH FROM (completed_at - created_at))*1000 as value')->pluck('value');
    }
    echo json_encode($body, JSON_THROW_ON_ERROR);
} else {
    throw new RuntimeException('Unknown performance action.');
}
