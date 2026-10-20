<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['service' => 'HookDesk', 'version' => '1.0.0']));
