<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('owner_user_id')->constrained('users');
            $t->string('name');
            $t->boolean('suspended')->default(false);
            $t->timestamp('archived_at')->nullable();
            $t->timestamps();
        });
        Schema::create('memberships', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $t->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $t->string('role');
            $t->timestamps();
            $t->unique(['workspace_id', 'user_id']);
        });
        DB::statement("CREATE UNIQUE INDEX workspace_single_owner ON memberships (workspace_id) WHERE role = 'owner'");
        Schema::create('invitations', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $t->string('email');
            $t->string('role');
            $t->string('token_hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamp('accepted_at')->nullable();
            $t->timestamps();
        });
        Schema::create('projects', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->text('description')->nullable();
            $t->boolean('suspended')->default(false);
            $t->timestamp('archived_at')->nullable();
            $t->timestamps();
        });
        Schema::create('project_api_keys', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('project_id')->constrained()->cascadeOnDelete();
            $t->foreignUlid('created_by')->constrained('users');
            $t->string('name');
            $t->string('prefix', 20);
            $t->string('token_hash', 64)->unique();
            $t->jsonb('abilities');
            $t->timestamp('expires_at');
            $t->timestamp('last_used_at')->nullable();
            $t->timestamp('revoked_at')->nullable();
            $t->timestamps();
        });
        Schema::create('endpoints', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('project_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->text('url')->nullable();
            $t->string('kind')->default('https');
            $t->boolean('paused')->default(false);
            $t->string('sandbox_behavior')->default('success');
            $t->timestamps();
        });
        Schema::create('endpoint_subscriptions', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('endpoint_id')->constrained()->cascadeOnDelete();
            $t->string('event_type', 100);
            $t->timestamps();
            $t->unique(['endpoint_id', 'event_type']);
        });
        Schema::create('signing_secrets', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('endpoint_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('version');
            $t->text('secret');
            $t->timestamps();
            $t->unique(['endpoint_id', 'version']);
        });
        Schema::create('webhook_sources', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('project_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->string('event_type', 100);
            $t->string('mode');
            $t->string('token_hash', 64)->unique();
            $t->boolean('enabled')->default(true);
            $t->timestamps();
        });
        Schema::create('events', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('project_id')->constrained()->cascadeOnDelete();
            $t->string('type', 100);
            $t->string('producer');
            $t->string('idempotency_key', 200)->nullable();
            $t->string('body_hash', 64);
            $t->timestamp('idempotency_expires_at')->nullable();
            $t->jsonb('data');
            $t->longText('body');
            $t->string('routing_result');
            $t->timestamps();
            $t->unique(['project_id', 'producer', 'idempotency_key']);
            $t->index(['project_id', 'created_at']);
        });
        Schema::create('deliveries', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('event_id')->constrained()->cascadeOnDelete();
            $t->foreignUlid('endpoint_id')->constrained();
            $t->foreignUlid('signing_secret_id')->constrained();
            $t->text('target_url');
            $t->string('status')->default('pending');
            $t->unsignedSmallInteger('attempt_count')->default(0);
            $t->timestamp('next_attempt_at');
            $t->timestamp('queued_until')->nullable();
            $t->timestamp('locked_until')->nullable();
            $t->string('lease_token', 64)->nullable();
            $t->timestamp('expires_at');
            $t->timestamp('completed_at')->nullable();
            $t->string('last_error')->nullable();
            $t->ulid('replay_of_delivery_id')->nullable();
            $t->timestamps();
            $t->index(['status', 'next_attempt_at']);
        });
        DB::statement("CREATE UNIQUE INDEX one_active_delivery ON deliveries (event_id,endpoint_id) WHERE status IN ('pending','processing','retrying')");
        Schema::create('delivery_attempts', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('delivery_id')->constrained()->cascadeOnDelete();
            $t->unsignedSmallInteger('number');
            $t->string('outcome')->default('started');
            $t->unsignedSmallInteger('http_status')->nullable();
            $t->unsignedInteger('duration_ms')->nullable();
            $t->text('response_body')->nullable();
            $t->boolean('response_truncated')->default(false);
            $t->string('error_code')->nullable();
            $t->timestamp('finished_at')->nullable();
            $t->timestamps();
            $t->unique(['delivery_id', 'number']);
        });
        Schema::create('usage_counters', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $t->date('date');
            $t->unsignedInteger('events')->default(0);
            $t->unsignedInteger('replays')->default(0);
            $t->timestamps();
            $t->unique(['workspace_id', 'date']);
        });
        Schema::create('workspace_limit_overrides', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $t->string('key');
            $t->unsignedInteger('value');
            $t->timestamps();
            $t->unique(['workspace_id', 'key']);
        });
        Schema::create('platform_settings', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->jsonb('value');
            $t->timestamps();
        });
        Schema::create('support_sessions', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->foreignUlid('actor_id')->constrained('users');
            $t->foreignUlid('user_id')->constrained();
            $t->foreignUlid('workspace_id')->constrained();
            $t->text('reason');
            $t->timestamp('expires_at');
            $t->timestamp('revoked_at')->nullable();
            $t->timestamps();
        });
        DB::statement('CREATE UNIQUE INDEX one_support_session ON support_sessions (actor_id) WHERE revoked_at IS NULL');
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->ulid('id')->primary();
            $t->ulid('actor_id')->nullable()->index();
            $t->ulid('effective_user_id')->nullable();
            $t->ulid('workspace_id')->nullable()->index();
            $t->ulid('support_session_id')->nullable();
            $t->string('action')->index();
            $t->string('resource_type')->nullable();
            $t->string('resource_id')->nullable();
            $t->text('reason')->nullable();
            $t->jsonb('changes')->nullable();
            $t->string('request_id')->nullable();
            $t->boolean('privileged')->default(false);
            $t->timestamps();
        });
        Schema::create('demo_receipts', function (Blueprint $t) {
            $t->ulid('event_id');
            $t->ulid('endpoint_id');
            $t->unsignedInteger('requests')->default(0);
            $t->boolean('processed')->default(false);
            $t->timestamps();
            $t->primary(['event_id', 'endpoint_id']);
        });
    }

    public function down(): void
    {
        foreach (['demo_receipts', 'audit_logs', 'support_sessions', 'platform_settings', 'workspace_limit_overrides', 'usage_counters', 'delivery_attempts', 'deliveries', 'events', 'webhook_sources', 'signing_secrets', 'endpoint_subscriptions', 'endpoints', 'project_api_keys', 'projects', 'invitations', 'memberships', 'workspaces'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
