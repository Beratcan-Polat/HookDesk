<?php

namespace App\Console\Commands;

use App\Models\SupportSession;
use App\Models\User;
use App\Services\AdminUsers;
use App\Services\Audit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PromoteAdmin extends Command
{
    protected $signature = 'hookdesk:admin {email} {--revoke : Remove platform administrator access}';

    protected $description = 'Bootstrap or recover a verified platform administrator';

    public function handle(): int
    {
        $u = User::where('email', $this->argument('email'))->first();
        if (! $u || ! $u->hasVerifiedEmail() || $u->status !== 'active') {
            $this->error('An active, verified account is required.');

            return self::FAILURE;
        }
        if ($this->option('revoke')) {
            try {
                $u = app(AdminUsers::class)->change($u, ['platform_role' => 'user'], 'Operator CLI command');
            } catch (HttpException $e) {
                $this->error($e->getMessage());

                return self::FAILURE;
            }
        } else {
            $u->forceFill(['platform_role' => 'super_admin'])->save();
        }
        DB::table('sessions')->where('user_id', $u->id)->delete();
        SupportSession::where('actor_id', $u->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
        app(Audit::class)->record('cli.admin_role_changed', $u, ['platform_role' => $u->platform_role], 'Operator CLI command');
        $this->info('Role updated. Confirm TOTP in account settings before accessing the admin panel.');

        return self::SUCCESS;
    }
}
