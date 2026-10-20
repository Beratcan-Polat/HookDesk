<?php

namespace App\Http\Controllers;

use App\Models\SupportSession;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountController extends Controller
{
    public function me(Request $r)
    {
        return ['data' => $r->user(), 'two_factor_enabled' => (bool) $r->user()->two_factor_confirmed_at, 'admin_step_up_until' => ($r->hasSession() ? (int) $r->session()->get('admin_step_up_at', 0) : 0) + 300];
    }

    public function profile(Request $r)
    {
        $data = $r->validate(['name' => 'sometimes|required|string|max:100', 'locale' => 'sometimes|in:tr,en', 'platform_role' => 'prohibited', 'status' => 'prohibited', 'email' => 'prohibited']);
        $r->user()->update($data);

        return ['data' => $r->user()];
    }

    public function delete(Request $r)
    {
        $r->validate(['password' => 'required|current_password:web']);
        abort_if(Workspace::where('owner_user_id', $r->user()->id)->whereNull('archived_at')->exists(), 422, 'transfer_or_archive_workspaces_first');
        DB::transaction(function () use ($r) {
            $admins = User::where('platform_role', 'super_admin')->where('status', 'active')->orderBy('id')->lockForUpdate()->get();
            abort_if($r->user()->isSuperAdmin() && $admins->count() <= 1, 422, 'last_super_admin_protected');
            $usable = $admins->filter(fn ($admin) => $admin->hasVerifiedEmail() && $admin->two_factor_confirmed_at);
            abort_if($r->user()->isSuperAdmin() && $r->user()->two_factor_confirmed_at && $usable->count() <= 1, 422, 'last_super_admin_protected');
            $r->user()->forceFill(['status' => 'deletion_pending', 'deletion_requested_at' => now()])->save();
            SupportSession::where(fn ($q) => $q->where('actor_id', $r->user()->id)->orWhere('user_id', $r->user()->id))->whereNull('revoked_at')->update(['revoked_at' => now()]);
            DB::table('sessions')->where('user_id', $r->user()->id)->delete();
            app(Audit::class)->record('account.deletion_requested', $r->user());
        }, 3);
        auth()->guard('web')->logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return response()->noContent();
    }

    public function confirmEmail(Request $r, User $user, string $hash)
    {
        abort_unless($r->user()->id === $user->id && $user->pending_email && hash_equals(hash('sha256', $user->pending_email), $hash), 403);
        abort_if(User::where('email', $user->pending_email)->whereKeyNot($user->id)->exists(), 422, 'email_already_used');
        $user->forceFill(['email' => $user->pending_email, 'pending_email' => null, 'email_verified_at' => now()])->save();
        app(Audit::class)->record('account.email_changed', $user);

        return redirect(config('hookdesk.frontend_url').'/app/settings');
    }
}
