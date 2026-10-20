<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Membership extends Record
{
    protected function casts(): array
    {
        return [];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
