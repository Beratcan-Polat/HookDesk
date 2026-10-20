<?php

namespace App\Services;

class Signature
{
    public function sign(string $secret, int $timestamp, string $body): string
    {
        return 'v1='.hash_hmac('sha256', $timestamp.'.'.$body, $secret);
    }

    public function verify(string $secret, string $timestamp, string $body, string $signature): bool
    {
        return ctype_digit($timestamp) && abs(now()->timestamp - (int) $timestamp) <= 300 && hash_equals($this->sign($secret, (int) $timestamp, $body), $signature);
    }
}
