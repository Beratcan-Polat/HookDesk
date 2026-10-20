<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Record
{
    protected function casts(): array
    {
        return ['data' => 'array', 'idempotency_expires_at' => 'datetime'];
    }

    protected $hidden = ['body', 'data', 'body_hash', 'idempotency_key'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class);
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Events are immutable.'));
    }
}
