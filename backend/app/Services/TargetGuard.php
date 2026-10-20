<?php

namespace App\Services;

use Symfony\Component\HttpFoundation\IpUtils;

class TargetGuard
{
    public function resolve(string $host): array
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return [$host];
        }
        $records = dns_get_record($host, DNS_A | DNS_AAAA);

        return array_values(array_unique(array_filter(array_map(fn ($r) => $r['ip'] ?? $r['ipv6'] ?? null, $records ?: []))));
    }

    public function validate(string $url): array
    {
        $parts = parse_url($url);
        if (! $parts || ($parts['scheme'] ?? '') !== 'https' || ! isset($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment']) || ($parts['port'] ?? 443) !== 443) {
            throw new \DomainException('unsafe_target');
        }
        $host = trim($parts['host'], '[]');
        if (! preg_match('/^[a-zA-Z0-9.:-]+$/D', $host)) {
            throw new \DomainException('unsafe_target');
        }
        $ips = $this->resolve($host);
        if (! $ips) {
            throw new \DomainException('dns_resolution_failed');
        }
        foreach ($ips as $ip) {
            if (! $this->publicIp($ip)) {
                throw new \DomainException('unsafe_target');
            }
        }

        return ['host' => $host, 'ip' => $ips[0]];
    }

    public function publicIp(string $ip): bool
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }

        return ! IpUtils::checkIp($ip, ['0.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4', '::/96', '::ffff:0:0/96', '64:ff9b::/96', '64:ff9b:1::/48', '100::/64', '2001::/23', '2001:db8::/32', '2002::/16', 'fc00::/7', 'fe80::/10', 'ff00::/8']);
    }
}
