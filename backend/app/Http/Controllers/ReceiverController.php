<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\Endpoint;
use App\Services\Signature;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReceiverController extends Controller
{
    public function receive(Request $r, Endpoint $endpoint)
    {
        abort_unless(config('hookdesk.app_role') === 'receiver' && $endpoint->kind === 'sandbox', 404);
        $delivery = Delivery::whereKey($r->header('X-HookDesk-Delivery-Id'))->where('endpoint_id', $endpoint->id)->firstOrFail();
        abort_unless($r->header('X-HookDesk-Event-Id') === $delivery->event_id && $r->getContent() === $delivery->event->body && app(Signature::class)->verify($delivery->signingSecret->secret, $r->header('X-HookDesk-Timestamp', ''), $r->getContent(), $r->header('X-HookDesk-Signature', '')), 401, 'invalid_signature');
        $receipt = DB::transaction(function () use ($endpoint, $delivery) {
            DB::table('demo_receipts')->insertOrIgnore(['event_id' => $delivery->event_id, 'endpoint_id' => $endpoint->id, 'requests' => 0, 'processed' => false, 'created_at' => now(), 'updated_at' => now()]);
            $q = DB::table('demo_receipts')->where('event_id', $delivery->event_id)->where('endpoint_id', $endpoint->id);
            $row = (clone $q)->lockForUpdate()->first();
            $q->update(['requests' => $row->requests + 1, 'updated_at' => now()]);

            return ['requests' => $row->requests + 1, 'duplicate' => (bool) $row->processed];
        }, 3);
        if ($endpoint->sandbox_behavior === 'timeout') {
            sleep(12);
        }
        $fail = $endpoint->sandbox_behavior === 'always_fail' || ($endpoint->sandbox_behavior === 'fail_twice' && $receipt['requests'] <= 2);
        if ($fail) {
            return response()->json(['received' => true, 'processed' => false], 500);
        }
        DB::table('demo_receipts')->where('event_id', $delivery->event_id)->where('endpoint_id', $endpoint->id)->update(['processed' => true]);

        return response()->json(['received' => true, 'duplicate' => $receipt['duplicate'], 'event_id' => $delivery->event_id]);
    }
}
