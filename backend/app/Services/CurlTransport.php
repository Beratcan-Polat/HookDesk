<?php

namespace App\Services;

use App\Models\Delivery;

class CurlTransport implements WebhookTransport
{
    public function send(Delivery $delivery, int $attempt): array
    {
        $started = hrtime(true);
        $captured = '';
        $truncated = false;
        $retryAfter = null;
        try {
            $target = $delivery->target_url;
            $resolved = null;
            if ($delivery->endpoint->kind === 'sandbox') {
                if ($target !== rtrim(config('hookdesk.receiver_url'), '/').'/receive/'.$delivery->endpoint_id) {
                    throw new \DomainException('unsafe_target');
                }
            } else {
                $resolved = app(TargetGuard::class)->validate($target);
            }
            $timestamp = now()->timestamp;
            $body = $delivery->event->body;
            $limit = config('hookdesk.max_response_bytes');
            $handle = curl_init($target);
            $headersSize = 0;
            $options = [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'X-HookDesk-Event-Id: '.$delivery->event_id,
                    'X-HookDesk-Delivery-Id: '.$delivery->id,
                    'X-HookDesk-Attempt: '.$attempt,
                    'X-HookDesk-Timestamp: '.$timestamp,
                    'X-HookDesk-Signature: '.app(Signature::class)->sign($delivery->signingSecret->secret, $timestamp, $body),
                ],
                CURLOPT_PROXY => '',
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_CONNECTTIMEOUT_MS => 3000,
                CURLOPT_TIMEOUT_MS => 10000,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_FRESH_CONNECT => true,
                CURLOPT_FORBID_REUSE => true,
                CURLOPT_PROTOCOLS => $resolved ? CURLPROTO_HTTPS : CURLPROTO_HTTP,
                CURLOPT_HEADERFUNCTION => function ($curl, string $line) use (&$retryAfter, &$headersSize): int {
                    $headersSize += strlen($line);
                    if ($headersSize > 65536) {
                        return 0;
                    }
                    if (str_starts_with(strtolower($line), 'retry-after:')) {
                        $retryAfter = substr(trim(substr($line, 12)), 0, 256);
                    }

                    return strlen($line);
                },
                CURLOPT_WRITEFUNCTION => function ($curl, string $chunk) use (&$captured, &$truncated, $limit): int {
                    $remaining = max(0, $limit - strlen($captured));
                    $captured .= substr($chunk, 0, $remaining);
                    if (strlen($chunk) > $remaining) {
                        $truncated = true;

                        return 0;
                    }

                    return strlen($chunk);
                },
            ];
            // IP literals are already pinned by the URL; CURLOPT_RESOLVE expects a hostname.
            if ($resolved && ! filter_var($resolved['host'], FILTER_VALIDATE_IP)) {
                $ip = $resolved['ip'];
                $options[CURLOPT_RESOLVE] = [$resolved['host'].':443:'.(str_contains($ip, ':') ? '['.$ip.']' : $ip)];
            }
            curl_setopt_array($handle, $options);
            curl_exec($handle);
            $errno = curl_errno($handle);
            $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            curl_close($handle);
            $transportFailed = $errno !== 0 && ! ($errno === CURLE_WRITE_ERROR && $truncated);
            // TLS handshake, certificate, cipher, engine and pinned-key errors are permanent.
            $tlsFailed = in_array($errno, [35, 51, 53, 54, 58, 59, 60, 64, 66, 77, 80, 82, 83, 90, 91], true);
            $error = $transportFailed ? ($tlsFailed ? 'invalid_tls' : 'network_error') : (($status >= 200 && $status < 300) ? null : 'http_'.$status);

            return [
                'status' => $status ?: null, 'body' => mb_convert_encoding($captured, 'UTF-8', 'UTF-8'),
                'truncated' => $truncated, 'duration_ms' => (int) ((hrtime(true) - $started) / 1e6),
                'retry' => $transportFailed ? ! $tlsFailed : (in_array($status, [408, 425, 429], true) || $status >= 500),
                'retry_after' => $retryAfter, 'error' => $error,
            ];
        } catch (\DomainException $e) {
            return ['status' => null, 'body' => '', 'truncated' => false, 'duration_ms' => (int) ((hrtime(true) - $started) / 1e6),
                'retry' => $e->getMessage() === 'dns_resolution_failed', 'retry_after' => null, 'error' => $e->getMessage()];
        }
    }
}
