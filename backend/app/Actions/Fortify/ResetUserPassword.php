<?php

namespace App\Actions\Fortify;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

class ResetUserPassword implements ResetsUserPasswords
{
    public function reset($user, array $input): void
    {
        Validator::make($input, ['password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()]])->validate();
        $user->forceFill(['password' => $input['password']])->save();
        DB::table('sessions')->where('user_id', $user->id)->delete();
    }
}
