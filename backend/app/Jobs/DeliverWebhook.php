<?php

namespace App\Jobs;

use App\Services\DeliveryEngine;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DeliverWebhook implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 20;

    public function __construct(public string $deliveryId)
    {
        $this->onQueue('deliveries');
    }

    public function handle(DeliveryEngine $engine): void
    {
        $engine->handle($this->deliveryId);
    }
}
