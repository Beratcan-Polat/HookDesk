<?php

namespace App\Models;

class AuditLog extends Record
{
    protected function casts(): array
    {
        return ['changes' => 'array', 'privileged' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Append-only audit.'));
        static::deleting(fn () => throw new \LogicException('Append-only audit.'));
    }
}
