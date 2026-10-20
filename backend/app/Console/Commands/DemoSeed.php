<?php

namespace App\Console\Commands;

use App\Models\Endpoint;
use App\Models\EndpointSubscription;
use App\Models\Membership;
use App\Models\Project;
use App\Models\SigningSecret;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class DemoSeed extends Command
{
    protected $signature = 'hookdesk:demo {--email=developer@hookdesk.test}';

    protected $description = 'Create an isolated local demonstration workspace; prints a generated password once';

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('Demo seeding is disabled in production.');

            return self::FAILURE;
        }
        if (User::where('email', $this->option('email'))->exists()) {
            $this->error('Demo account already exists.');

            return self::FAILURE;
        }
        $password = Str::password(20);
        $u = User::create(['name' => 'Beratcan Polat', 'email' => $this->option('email'), 'password' => $password, 'locale' => 'tr']);
        $u->forceFill(['email_verified_at' => now()])->save();
        $w = Workspace::create(['name' => 'HookDesk Lab', 'owner_user_id' => $u->id]);
        Membership::create(['workspace_id' => $w->id, 'user_id' => $u->id, 'role' => 'owner']);
        $p = Project::create(['name' => 'Rental Platform', 'description' => 'End-to-end webhook delivery laboratory', 'workspace_id' => $w->id]);
        $e = Endpoint::create(['project_id' => $p->id, 'name' => 'Demo receiver', 'kind' => 'sandbox', 'sandbox_behavior' => 'fail_twice']);
        EndpointSubscription::create(['endpoint_id' => $e->id, 'event_type' => '*']);
        SigningSecret::create(['endpoint_id' => $e->id, 'version' => 1, 'secret' => 'whsec_'.Str::random(48)]);
        $this->info('Email: '.$u->email);
        $this->info('Generated local password: '.$password);

        return self::SUCCESS;
    }
}
