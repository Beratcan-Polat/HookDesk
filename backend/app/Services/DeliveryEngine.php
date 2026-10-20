<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\DeliveryAttempt;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeliveryEngine
{
    public function handle(string $id): void
    {
        Cache::put('health:worker', now()->toISOString(), 120);
        $claim = DB::transaction(function () use ($id) {
            $d = Delivery::whereKey($id)->lockForUpdate()->first();
            if (! $d || ! in_array($d->status, ['pending', 'retrying'], true) || $d->next_attempt_at->isFuture()) {
                return null;
            }
            if ($d->expires_at->isPast()) {
                $d->update(['status' => 'failed', 'last_error' => 'expired', 'completed_at' => now()]);

                return null;
            }
            if (app(Settings::class)->get('delivery_paused', false) || $d->endpoint->paused || $d->event->project->blocked()) {
                $d->update(['queued_until' => null, 'next_attempt_at' => now()->addSeconds(5)]);

                return null;
            }
            $w = $d->event->project->workspace;
            $s = app(Settings::class);
            foreach (['endpoint:'.$d->endpoint_id => $s->limit('endpoint_per_second', $w), 'workspace:'.$w->id => $s->limit('workspace_per_second', $w)] as $key => $max) {
                $bucket = 'egress:'.$key.':'.now()->timestamp;
                Cache::add($bucket, 0, 3);
                if (Cache::increment($bucket) > $max) {
                    $d->update(['queued_until' => null, 'next_attempt_at' => now()->addSecond()]);

                    return null;
                }
            }
            $token = Str::random(48);
            $number = $d->attempt_count + 1;
            $d->update(['status' => 'processing', 'attempt_count' => $number, 'queued_until' => null, 'lease_token' => $token, 'locked_until' => now()->addSeconds(45)]);
            $attempt = DeliveryAttempt::create(['delivery_id' => $d->id, 'number' => $number]);

            return [$d, $attempt, $token];
        }, 3);
        if (! $claim) {
            return;
        }
        [$delivery,$attempt,$token] = $claim;
        $result = app(WebhookTransport::class)->send($delivery, $attempt->number);
        DB::transaction(function () use ($delivery, $attempt, $token, $result) {
            $d = Delivery::whereKey($delivery->id)->lockForUpdate()->firstOrFail();
            if ($d->lease_token !== $token || $d->status !== 'processing') {
                return;
            }
            $success = $result['error'] === null && $result['status'] >= 200 && $result['status'] < 300;
            $retry = ! $success && $result['retry'] && $d->attempt_count < 6 && $d->expires_at->isFuture();
            $attempt->update(['outcome' => $success ? 'succeeded' : 'failed', 'http_status' => $result['status'], 'duration_ms' => $result['duration_ms'],
                'response_body' => $result['body'], 'response_truncated' => $result['truncated'], 'error_code' => $result['error'], 'finished_at' => now()]);
            $d->update(['status' => $success ? 'succeeded' : ($retry ? 'retrying' : 'failed'), 'locked_until' => null, 'lease_token' => null,
                'last_error' => $result['error'], 'completed_at' => $retry ? null : now(),
                'next_attempt_at' => $retry ? now()->addSeconds(app(RetryPolicy::class)->delay($d->attempt_count, $result['retry_after'])) : now()]);
        }, 3);
    }
}
