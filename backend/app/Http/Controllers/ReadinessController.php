<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReadinessController extends Controller
{
    public function __invoke()
    {
        try {
            DB::select('SELECT 1');
            Cache::put('health:readiness', 'ok', 10);
            $ok = Cache::get('health:readiness') === 'ok';
        } catch (\Throwable) {
            $ok = false;
        }

        return response()->json(['status' => $ok ? 'ok' : 'degraded'], $ok ? 200 : 503)->header('Cache-Control', 'no-store');
    }
}
