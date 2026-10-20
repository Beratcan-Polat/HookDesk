<?php

namespace App\Models;

class DeliveryAttempt extends Record
{
    protected function casts(): array
    {
        return ['response_truncated' => 'boolean', 'finished_at' => 'datetime'];
    }

    protected $hidden = ['response_body'];
}
