<?php

namespace App\Actions\Fortify;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Contracts\UpdatesUserPasswords;

class UpdateUserPassword implements UpdatesUserPasswords
{
    public function update($user, array $input): void
    {
        Validator::make($input, ['current_password' => 'required|current_password:web', 'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()]])->validateWithBag('updatePassword');
        $user->forceFill(['password' => $input['password']])->save();
    }
}
