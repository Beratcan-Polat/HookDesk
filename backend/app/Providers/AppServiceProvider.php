<?php

namespace App\Providers;

use App\Services\CurlTransport;
use App\Services\WebhookTransport;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(WebhookTransport::class, CurlTransport::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Queue::looping(function () {
            Cache::put('health:worker', now()->toISOString(), 120);
        });
        ResetPassword::createUrlUsing(fn ($user, $token) => config('hookdesk.frontend_url').'/reset-password?token='.$token.'&email='.urlencode($user->email));
    }
}
