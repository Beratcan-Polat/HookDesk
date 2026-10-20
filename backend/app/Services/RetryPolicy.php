<?php

namespace App\Services;

class RetryPolicy
{
    public function delay(int $attempt, mixed $retryAfter = null): int
    {
        $base = config('hookdesk.retry_delays')[min(max($attempt - 1, 0), 4)];
        $delay = $base + random_int(0, (int) floor($base * .2));
        if (is_string($retryAfter) && $retryAfter !== '') {
            $requested = ctype_digit($retryAfter) ? (int) $retryAfter : max(0, (strtotime($retryAfter) ?: now()->timestamp) - now()->timestamp);
            $delay = max($delay, min(3600, $requested));
        }

        return min(4320, $delay);
    }
}
