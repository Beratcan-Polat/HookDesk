<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_sessions', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->change();
        });
        // Preserve already-ended sessions instead of reviving expired history.
        DB::table('support_sessions')->whereNull('revoked_at')->where('expires_at', '<=', now())->update(['revoked_at' => now()]);
        DB::table('support_sessions')->whereNull('revoked_at')->update(['expires_at' => null]);
    }

    public function down(): void
    {
        DB::table('support_sessions')->whereNull('expires_at')->update(['expires_at' => now()->addMinutes(30)]);
        Schema::table('support_sessions', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable(false)->change();
        });
    }
};
