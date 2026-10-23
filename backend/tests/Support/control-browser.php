<?php

use App\Models\SupportSession;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
require __DIR__.'/browser-database.php';
requireBrowserDatabase();
$path = getenv('E2E_LIFECYCLE_FILE');
if (! $path || ! is_file($path)) {
    throw new RuntimeException('Provide the private lifecycle fixture file.');
}
$fixtures = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
$fixture = $fixtures[$argv[2] ?? ''] ?? throw new RuntimeException('Unknown fixture locale.');
switch ($argv[1] ?? '') {
    case 'security-secret':
        $user = User::whereKey($fixture['security']['id'])->where('email', $fixture['security']['email'])->firstOrFail();
        echo json_encode(['secret' => decrypt($user->two_factor_secret)], JSON_THROW_ON_ERROR);
        break;
    case 'expire-support':
        $session = SupportSession::whereKey($argv[3] ?? '')->where('workspace_id', $fixture['workspace_id'])->where('user_id', $fixture['owner']['id'])->whereHas('actor', fn ($q) => $q->where('email', 'admin-browser@hookdesk.test'))->firstOrFail();
        $session->update(['expires_at' => now()->subSecond()]);
        break;
    default:
        throw new RuntimeException('Unknown browser control action.');
}
