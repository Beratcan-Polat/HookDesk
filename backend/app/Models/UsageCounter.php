<?php

namespace App\Models;

class UsageCounter extends Record
{
    protected function casts(): array
    {
        return ['date' => 'string'];
    }
}
