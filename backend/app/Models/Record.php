<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

abstract class Record extends Model
{
    use HasUlids;

    protected $guarded = [];
}
