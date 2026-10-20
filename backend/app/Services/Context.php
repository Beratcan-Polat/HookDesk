<?php

namespace App\Services;

use App\Models\SupportSession;
use App\Models\User;

class Context
{
    public function actor(): ?User
    {
        return request()->user();
    }

    public function user(): ?User
    {
        return request()->attributes->get('effective_user') ?? $this->actor();
    }

    public function support(): ?SupportSession
    {
        return request()->attributes->get('support_session');
    }
}
