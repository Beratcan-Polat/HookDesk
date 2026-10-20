<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectApiKey extends Record
{
    protected function casts(): array
    {
        return ['abilities' => 'array', 'expires_at' => 'datetime', 'revoked_at' => 'datetime', 'last_used_at' => 'datetime'];
    }

    protected $hidden = ['token_hash'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
