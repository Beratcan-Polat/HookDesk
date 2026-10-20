<?php

namespace App\Models;

class SigningSecret extends Record
{
    protected function casts(): array
    {
        return ['secret' => 'encrypted'];
    }

    protected $hidden = ['secret'];
}
