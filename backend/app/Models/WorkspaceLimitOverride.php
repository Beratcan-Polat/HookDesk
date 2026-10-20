<?php

namespace App\Models;

class WorkspaceLimitOverride extends Record
{
    protected function casts(): array
    {
        return ['value' => 'integer'];
    }
}
