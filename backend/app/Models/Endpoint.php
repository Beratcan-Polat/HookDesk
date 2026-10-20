<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Endpoint extends Record
{
    protected function casts(): array
    {
        return ['paused' => 'boolean'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(EndpointSubscription::class);
    }

    public function secrets(): HasMany
    {
        return $this->hasMany(SigningSecret::class);
    }
}
