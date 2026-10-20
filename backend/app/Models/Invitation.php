<?php

namespace App\Models;

class Invitation extends Record
{
    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'accepted_at' => 'datetime'];
    }

    protected $hidden = ['token_hash'];
}
