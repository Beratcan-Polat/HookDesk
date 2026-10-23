<?php

use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Str;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
require __DIR__.'/browser-database.php';
requireBrowserDatabase();
$fixtures = [];
foreach (['en', 'tr'] as $locale) {
    $accounts = [];
    foreach (['owner', 'invitee', 'security'] as $kind) {
        $password = Str::password(24);
        $user = User::create(['name' => 'Browser '.$locale.' '.$kind, 'email' => 'browser-'.strtolower(Str::ulid()).'@hookdesk.test', 'password' => $password, 'locale' => $locale]);
        $user->forceFill(['email_verified_at' => now()])->save();
        $accounts[$kind] = ['id' => $user->id, 'email' => $user->email, 'password' => $password];
    }
    $workspace = Workspace::create(['name' => 'Lifecycle '.strtoupper($locale).' '.Str::random(8), 'owner_user_id' => $accounts['owner']['id']]);
    Membership::create(['workspace_id' => $workspace->id, 'user_id' => $accounts['owner']['id'], 'role' => 'owner']);
    $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Lifecycle project']);
    $securityWorkspace = Workspace::create(['name' => 'Security '.$locale, 'owner_user_id' => $accounts['security']['id']]);
    Membership::create(['workspace_id' => $securityWorkspace->id, 'user_id' => $accounts['security']['id'], 'role' => 'owner']);
    $expiredWorkspace = Workspace::create(['name' => 'Expired invitation '.$locale, 'owner_user_id' => $accounts['owner']['id']]);
    Membership::create(['workspace_id' => $expiredWorkspace->id, 'user_id' => $accounts['owner']['id'], 'role' => 'owner']);
    $expiredToken = Str::random(64);
    Invitation::create(['workspace_id' => $expiredWorkspace->id, 'email' => $accounts['invitee']['email'], 'role' => 'viewer', 'token_hash' => hash('sha256', $expiredToken), 'expires_at' => now()->subMinute()]);
    $fixtures[$locale] = [...$accounts, 'workspace_id' => $workspace->id, 'workspace_name' => $workspace->name, 'project_id' => $project->id, 'expired_token' => $expiredToken];
}
echo json_encode($fixtures, JSON_THROW_ON_ERROR);
