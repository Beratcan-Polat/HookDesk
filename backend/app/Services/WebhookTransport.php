<?php

namespace App\Services;

use App\Models\Delivery;

interface WebhookTransport
{
    public function send(Delivery $delivery, int $attempt): array;
}
