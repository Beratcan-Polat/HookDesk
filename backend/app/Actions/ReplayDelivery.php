<?php

namespace App\Actions;

use App\Enums\DeliveryStatus;
use App\Models\Delivery;
use App\Models\Event;
use App\Models\Workspace;
use App\Services\Audit;
use App\Services\DispatchDue;
use App\Services\Quota;
use Illuminate\Support\Facades\DB;

class ReplayDelivery
{
    public function execute(Delivery $delivery): Delivery
    {
        $new = DB::transaction(function () use ($delivery) {
            $w = Workspace::whereKey($delivery->event->project->workspace_id)->lockForUpdate()->firstOrFail();
            Event::whereKey($delivery->event_id)->lockForUpdate()->firstOrFail();
            $delivery->refresh();
            abort_if(in_array($delivery->status, DeliveryStatus::active(), true), 409, 'delivery_still_active');
            abort_if($delivery->event->project->blocked() || $delivery->endpoint->paused, 403, 'target_blocked');
            abort_if(Delivery::where('event_id', $delivery->event_id)->where('endpoint_id', $delivery->endpoint_id)->whereIn('status', DeliveryStatus::active())->exists(), 409, 'delivery_still_active');
            app(Quota::class)->increment($w, 'replays');

            return app(CreateDelivery::class)->execute($delivery->event, $delivery->endpoint, $delivery->id);
        }, 3);
        app(Audit::class)->record('delivery.replayed', $new, workspaceId: $delivery->event->project->workspace_id);
        app(DispatchDue::class)->dispatch();

        return $new;
    }
}
