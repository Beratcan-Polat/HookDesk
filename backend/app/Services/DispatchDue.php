<?php

namespace App\Services;

use App\Jobs\DeliverWebhook;
use App\Models\Delivery;
use App\Models\DeliveryAttempt;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DispatchDue
{
    public function dispatch(): int
    {
        $count = 0;
        foreach (Delivery::whereIn('status', ['pending', 'retrying'])->where('next_attempt_at', '<=', now())->where(fn ($q) => $q->whereNull('queued_until')->orWhere('queued_until', '<=', now()))->limit(100)->pluck('id') as $id) {
            $claimed = DB::transaction(function () use ($id) {
                $d = Delivery::whereKey($id)->lockForUpdate()->first();
                if (! $d || ! in_array($d->status, ['pending', 'retrying'], true) || ($d->queued_until && $d->queued_until->isFuture())) {
                    return false;
                }
                $d->update(['queued_until' => now()->addSeconds(60)]);

                return true;
            }, 3);
            if (! $claimed) {
                continue;
            }
            try {
                DeliverWebhook::dispatch($id);
                $count++;
            } catch (\Throwable) {
                Delivery::whereKey($id)->update(['queued_until' => null]);
                Log::warning('Queue unavailable; durable delivery will be recovered.', ['delivery_id' => $id]);
            }
        }

        return $count;
    }

    public function recover(): void
    {
        Cache::put('health:scheduler', now()->toISOString(), 120);
        foreach (Delivery::where('status', 'processing')->where('locked_until', '<=', now())->pluck('id') as $id) {
            DB::transaction(function () use ($id) {
                $d = Delivery::whereKey($id)->lockForUpdate()->first();
                if (! $d || $d->status !== 'processing' || $d->locked_until?->isFuture()) {
                    return;
                }
                DeliveryAttempt::where('delivery_id', $id)->where('number', $d->attempt_count)->where('outcome', 'started')->update(['outcome' => 'unknown', 'error_code' => 'worker_interrupted', 'finished_at' => now()]);
                $terminal = $d->attempt_count >= 6 || $d->expires_at->isPast();
                $d->update(['status' => $terminal ? 'failed' : 'retrying', 'last_error' => 'worker_interrupted', 'locked_until' => null, 'lease_token' => null, 'queued_until' => null,
                    'completed_at' => $terminal ? now() : null, 'next_attempt_at' => now()->addSeconds(app(RetryPolicy::class)->delay($d->attempt_count))]);
            }, 3);
        }
        Delivery::whereIn('status', ['pending', 'retrying'])->where('expires_at', '<=', now())->update(['status' => 'failed', 'last_error' => 'expired', 'completed_at' => now(), 'queued_until' => null]);
        $this->dispatch();
    }
}
