<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\RedirectIfUserTwoFactorAuthenticatable;
use App\Actions\Fortify\ResetUserPassword;
use App\Actions\Fortify\UpdateUserPassword;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->app->bind(RedirectsIfTwoFactorAuthenticatable::class, RedirectIfUserTwoFactorAuthenticatable::class);
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);
        Fortify::authenticateUsing(function (Request $r) {
            $user = User::where('email', strtolower($r->input('email', '')))->first();

            return $user && $user->status === 'active' && Hash::check($r->input('password', ''), $user->password) ? $user : null;
        });
        RateLimiter::for('login', fn (Request $r) => Limit::perMinute(5)->by(strtolower($r->input('email', '')).'|'.$r->ip()));
        RateLimiter::for('two-factor', fn (Request $r) => Limit::perMinute(5)->by($r->session()->get('login.id').'|'.$r->ip()));
    }
}
