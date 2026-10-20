<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\ReceiverController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['service' => 'HookDesk', 'version' => '1.0.0']));
Route::get('/pending-email/{user}/{hash}', [AccountController::class, 'confirmEmail'])->middleware(['auth', 'signed'])->name('pending-email.verify');
