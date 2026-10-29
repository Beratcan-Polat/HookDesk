<?php

namespace App\Services;

use App\Models\SupportSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AdminUsers
{
    public function change(User $target, array $changes, string $reason): User
    {
        return DB::transaction(function () use ($target, $changes, $reason) {
            $admins = User::where('platform_role', 'super_admin')->where('status', 'active')->orderBy('id')->lockForUpdate()->get();
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            abort_if($target->status === 'deleted', 422, 'deleted_account_is_read_only');
            $removes = $target->isSuperAdmin() && (($changes['platform_role'] ?? $target->platform_role) !== 'super_admin' || ($changes['status'] ?? $target->status) !== 'active');
            abort_if($removes && $admins->count() <= 1, 422, 'last_super_admin_protected');
            $usable = $admins->filter(fn ($admin) => $admin->hasVerifiedEmail());
            abort_if($removes && $target->hasVerifiedEmail() && $usable->count() <= 1, 422, 'last_super_admin_protected');
            if (($changes['platform_role'] ?? '') === 'super_admin') {
                abort_unless($target->hasVerifiedEmail() && ($changes['status'] ?? $target->status) === 'active', 422, 'admin_requires_verified_account');
            }
            $safe = collect($changes)->only(['name', 'status', 'platform_role'])->all();
            $before = collect($target->getAttributes())->only(array_keys($safe))->all();
            $target->forceFill($safe)->save();
            if (isset($changes['status']) && $changes['status'] === 'active') {
                $target->forceFill(['deletion_requested_at' => null])->save();
            }
            if (isset($changes['status']) || isset($changes['platform_role'])) {
                DB::table('sessions')->where('user_id', $target->id)->delete();
                SupportSession::where(fn ($q) => $q->where('actor_id', $target->id)->orWhere('user_id', $target->id))->whereNull('revoked_at')->update(['revoked_at' => now()]);
            }
            app(Audit::class)->record('admin.user_updated', $target, ['before' => $before, 'after' => $safe], $reason);

            return $target;
        }, 3);
    }
}
