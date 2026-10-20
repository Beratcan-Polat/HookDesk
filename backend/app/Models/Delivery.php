<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Delivery extends Record
{
    protected function casts(): array
    {
        return ['next_attempt_at' => 'datetime', 'queued_until' => 'datetime', 'locked_until' => 'datetime', 'expires_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function endpoint(): BelongsTo
    {
        return $this->belongsTo(Endpoint::class);
    }

    public function signingSecret(): BelongsTo
    {
        return $this->belongsTo(SigningSecret::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(DeliveryAttempt::class)->orderBy('number');
    }
}
