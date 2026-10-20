<?php

namespace App\Actions\Fortify;

use App\Models\User;
use App\Services\Settings;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    public function create(array $input): User
    {
        if (isset($input['email']) && is_string($input['email'])) {
            $input['email'] = strtolower(trim($input['email']));
        }
        $bucket = 'registration:'.request()->ip();
        abort_if(RateLimiter::tooManyAttempts($bucket, 5), 429, 'registration_rate_limited');
        RateLimiter::hit($bucket, 60);
        abort_unless(app(Settings::class)->get('registration_enabled', true), 403, 'registration_disabled');
        Validator::make($input, ['name' => 'required|string|max:100', 'email' => 'required|email|max:255|unique:users', 'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()], 'locale' => 'sometimes|in:tr,en', 'platform_role' => 'prohibited', 'status' => 'prohibited'])->validate();

        return User::create(['name' => $input['name'], 'email' => strtolower($input['email']), 'password' => $input['password'], 'locale' => $input['locale'] ?? 'en']);
    }
}
