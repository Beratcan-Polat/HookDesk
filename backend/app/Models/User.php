<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasFactory, HasUlids, Notifiable, TwoFactorAuthenticatable;

    protected $fillable = ['name', 'email', 'password', 'locale'];

    protected $attributes = ['platform_role' => 'user', 'status' => 'active', 'locale' => 'en'];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes', 'pending_email'];

    protected function casts(): array
    {
        return ['email_verified_at' => 'datetime', 'two_factor_confirmed_at' => 'datetime', 'deletion_requested_at' => 'datetime', 'password' => 'hashed'];
    }

    public function preferredLocale(): string
    {
        return $this->locale;
    }

    public function isSuperAdmin(): bool
    {
        return $this->platform_role === 'super_admin' && $this->status === 'active';
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }
}
