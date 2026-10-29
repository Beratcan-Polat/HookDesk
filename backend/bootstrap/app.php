<?php

use App\Http\Middleware\AdminMutation;
use App\Http\Middleware\AuditMutation;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\ProjectKey;
use App\Http\Middleware\RequestContext;
use App\Http\Middleware\SupportContext;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->web(append: [RequestContext::class]);
        $middleware->api(append: [RequestContext::class]);
        $middleware->validateCsrfTokens(except: ['ingest/*', 'receive/*']);
        $middleware->alias([
            'super_admin' => EnsureSuperAdmin::class,
            'admin_mutation' => AdminMutation::class,
            'support_context' => SupportContext::class,
            'audit_mutation' => AuditMutation::class,
            'project_key' => ProjectKey::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->report(function (QueryException $exception) {
            Log::error('Database operation failed.', [
                'sqlstate' => $exception->errorInfo[0] ?? 'unknown',
                'request_id' => request()->attributes->get('request_id'),
            ]);

            return false;
        });
        $exceptions->shouldRenderJsonWhen(fn ($request, $exception) => $request->is('api/*', 'ingest/*', 'receive/*') || $request->expectsJson());
    })->create();
