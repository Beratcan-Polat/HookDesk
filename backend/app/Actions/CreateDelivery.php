<?php

namespace App\Actions;

use App\Models\Delivery;
use App\Models\Endpoint;
use App\Models\Event;

class CreateDelivery
{
    public function execute(Event $event, Endpoint $endpoint, ?string $replayOf = null): Delivery
    {
        $secret = $endpoint->secrets()->orderByDesc('version')->firstOrFail();

        return Delivery::create(['event_id' => $event->id, 'endpoint_id' => $endpoint->id, 'signing_secret_id' => $secret->id,
            'target_url' => $endpoint->kind === 'sandbox' ? rtrim(config('hookdesk.receiver_url'), '/').'/receive/'.$endpoint->id : $endpoint->url,
            'status' => 'pending', 'next_attempt_at' => now(), 'expires_at' => now()->addDay(), 'replay_of_delivery_id' => $replayOf]);
    }
}
