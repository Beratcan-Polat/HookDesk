<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Record
{
    protected function casts(): array
    {
        return ['suspended' => 'boolean', 'archived_at' => 'datetime'];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function endpoints(): HasMany
    {
        return $this->hasMany(Endpoint::class);
    }

    public function blocked(): bool
    {
        return $this->suspended || $this->archived_at !== null || $this->workspace->blocked();
    }
}
