<?php

namespace App\Http\Resources;

use App\Models\Event;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Event */
class EventResource extends JsonResource
{
    public function toArray($request): array
    {
        return ['id' => $this->id, 'type' => $this->type, 'project_id' => $this->project_id, 'producer' => $this->producer, 'routing_result' => $this->routing_result, 'created_at' => $this->created_at, 'deliveries_count' => $this->whenCounted('deliveries')];
    }
}
