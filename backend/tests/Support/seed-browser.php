<?php

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (app()->environment('production')) {
    throw new RuntimeException('Browser fixtures are forbidden in production.');
}
$password = Str::password(24);
$secret = (new Google2FA)->generateSecretKey();
$admin = User::firstOrCreate(['email' => 'admin-browser@hookdesk.test'], ['name' => 'Platform Operator', 'password' => $password, 'locale' => 'en']);
$admin->forceFill(['password' => $password, 'platform_role' => 'super_admin', 'status' => 'active', 'email_verified_at' => now(), 'two_factor_secret' => encrypt($secret), 'two_factor_confirmed_at' => now()])->save();
$owner = User::where('email', 'developer@hookdesk.test')->firstOrFail();
$workspace = Workspace::where('owner_user_id', $owner->id)->firstOrFail();
echo json_encode(['email' => $admin->email, 'password' => $password, 'secret' => $secret, 'user_id' => $owner->id, 'workspace_id' => $workspace->id], JSON_THROW_ON_ERROR);
