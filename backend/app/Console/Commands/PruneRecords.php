<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Event;
use App\Models\SupportSession;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PruneRecords extends Command
{
    protected $signature = 'hookdesk:prune';

    protected $description = 'Apply retention and anonymize matured account-deletion requests';

    public function handle(): int
    {
        Event::where('created_at', '<', now()->subDays(30))->whereDoesntHave('deliveries', fn ($q) => $q->whereIn('status', ['pending', 'processing', 'retrying']))->delete();
        AuditLog::where('privileged', false)->where('created_at', '<', now()->subDays(90))->delete();
        AuditLog::where('privileged', true)->where('created_at', '<', now()->subDays(365))->delete();
        Event::where('idempotency_expires_at', '<=', now())->update(['idempotency_key' => null, 'idempotency_expires_at' => null]);
        SupportSession::whereNull('revoked_at')->where('expires_at', '<=', now())->update(['revoked_at' => now()]);
        foreach (User::where('status', 'deletion_pending')->where('deletion_requested_at', '<=', now()->subDays(30))->get() as $u) {
            DB::transaction(function () use ($u) {
                DB::table('memberships')->where('user_id', $u->id)->where('role', '!=', 'owner')->delete();
                $u->forceFill(['name' => 'Deleted account', 'email' => $u->id.'@deleted.invalid', 'password' => Hash::make(Str::random(64)),
                    'pending_email' => null, 'two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null,
                    'remember_token' => null, 'platform_role' => 'user', 'status' => 'deleted'])->save();
            });
        }
        $this->info('Retention applied.');

        return self::SUCCESS;
    }
}
