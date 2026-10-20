<?php

use Laravel\Fortify\Features;

return [
    'guard' => 'web', 'middleware' => ['web'], 'auth_middleware' => 'auth', 'passwords' => 'users', 'username' => 'email', 'email' => 'email',
    'views' => false, 'home' => env('FRONTEND_URL', 'http://localhost:5173').'/app', 'prefix' => '', 'domain' => null, 'lowercase_usernames' => true,
    'limiters' => ['login' => 'login', 'two-factor' => 'two-factor'],
    'features' => [Features::registration(), Features::resetPasswords(), Features::emailVerification(), Features::updatePasswords(), Features::twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true])],
];
