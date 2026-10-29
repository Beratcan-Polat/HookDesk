<?php

namespace App\Actions\Fortify;

use App\Models\User;
use Laravel\Fortify\Actions\RedirectIfTwoFactorAuthenticatable;
use Laravel\Fortify\Fortify;

class RedirectIfUserTwoFactorAuthenticatable extends RedirectIfTwoFactorAuthenticatable
{
    public function handle($request, $next)
    {
        // Keep Fortify's credential validation, failed-login events and throttling.
        $user = $this->validateCredentials($request);
        if ($user instanceof User && $user->isSuperAdmin()) {
            return $next($request);
        }

        if ($user->two_factor_secret && (! Fortify::confirmsTwoFactorAuthentication() || $user->two_factor_confirmed_at)) {
            return $this->twoFactorChallengeResponse($request, $user);
        }

        return $next($request);
    }
}
