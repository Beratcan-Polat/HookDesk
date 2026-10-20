<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhookSource extends Record
{
    protected function casts(): array
    {
        return ['enabled' => 'boolean'];
    }

    protected $hidden = ['token_hash'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
