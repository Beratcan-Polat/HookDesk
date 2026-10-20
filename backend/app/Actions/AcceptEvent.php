<?php

namespace App\Actions;

use App\Models\Event;
use App\Models\Project;
use App\Models\Workspace;
use App\Services\DispatchDue;
use App\Services\Quota;
use App\Services\Settings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AcceptEvent
{
    public function execute(Project $project, string $type, object $data, string $raw, ?string $key = null, string $producer = 'api', bool $forward = true): array
    {
        abort_if(app(Settings::class)->get('ingestion_paused', false), 503, 'ingestion_paused', ['Retry-After' => '60']);
        abort_if(strlen($raw) > config('hookdesk.max_body_bytes'), 413, 'payload_too_large');
        abort_if($key !== null && (strlen($key) > 200 || $key === ''), 422, 'invalid_idempotency_key');
        $result = DB::transaction(function () use ($project, $type, $data, $raw, $key, $producer, $forward) {
            $w = Workspace::whereKey($project->workspace_id)->lockForUpdate()->firstOrFail();
            $project->refresh();
            abort_if($project->blocked(), 403, 'project_blocked');
            if ($key !== null) {
                $old = Event::where('project_id', $project->id)->where('producer', $producer)->where('idempotency_key', $key)->first();
                if ($old && $old->idempotency_expires_at->isFuture()) {
                    abort_unless(hash_equals($old->body_hash, hash('sha256', $raw)), 409, 'idempotency_conflict');

                    return [$old, true];
                }
                if ($old) {
                    Event::whereKey($old->id)->update(['idempotency_key' => null, 'idempotency_expires_at' => null]);
                }
            }
            app(Quota::class)->increment($w, 'events');
            $endpoints = $forward ? $project->endpoints()->where('paused', false)->whereHas('subscriptions', fn ($q) => $q->whereIn('event_type', [$type, '*']))->get() : collect();
            $id = (string) Str::ulid();
            $body = json_encode(['version' => 1, 'id' => $id, 'type' => $type, 'created_at' => now()->toISOString(), 'data' => $data], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $event = Event::create(['id' => $id, 'project_id' => $project->id, 'type' => $type, 'producer' => $producer,
                'idempotency_key' => $key, 'body_hash' => hash('sha256', $raw), 'idempotency_expires_at' => $key !== null ? now()->addDay() : null,
                'data' => $data, 'body' => $body, 'routing_result' => ! $forward ? 'captured' : ($endpoints->isEmpty() ? 'no_matching_endpoints' : 'routed')]);
            foreach ($endpoints as $endpoint) {
                app(CreateDelivery::class)->execute($event, $endpoint);
            }

            return [$event, false];
        }, 3);
        // Delivery rows are durable even when Redis is down.
        app(DispatchDue::class)->dispatch();

        return $result;
    }
}
