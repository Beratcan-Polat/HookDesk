<?php

use App\Services\RetryPolicy;
use App\Services\Signature;
use App\Services\TargetGuard;

it('validates signatures and rejects modified or stale requests', function () {
    $s = new Signature;
    $t = now()->timestamp;
    $sig = $s->sign('secret', $t, '{"a":1}');
    expect($s->verify('secret', (string) $t, '{"a":1}', $sig))->toBeTrue()
        ->and($s->verify('secret', (string) $t, '{"a":2}', $sig))->toBeFalse()
        ->and($s->verify('secret', (string) ($t - 301), '{"a":1}', $sig))->toBeFalse();
});
it('rejects private, mapped and special addresses', function (string $ip) {
    expect((new TargetGuard)->publicIp($ip))->toBeFalse();
})
    ->with(['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.0.1', '192.0.2.1', '::1', '::ffff:127.0.0.1', 'fe80::1', '2001:db8::1']);
it('allows routable addresses', function () {
    expect((new TargetGuard)->publicIp('8.8.8.8'))->toBeTrue();
});
it('rejects URL credentials, redirects ports and http', function (string $url) {
    expect(fn () => (new TargetGuard)->validate($url))->toThrow(DomainException::class);
})->with(['http://example.com', 'https://user:pass@example.com', 'https://example.com:444', 'https://example.com/#fragment']);
it('rechecks all DNS addresses', function () {
    $guard = new class extends TargetGuard
    {
        public function resolve(string $host): array
        {
            return ['8.8.8.8', '127.0.0.1'];
        }
    };
    expect(fn () => $guard->validate('https://example.com'))->toThrow(DomainException::class);
});
it('honors bounded retry-after without an immediate retry storm', function () {
    $p = new RetryPolicy;
    expect($p->delay(1, '3600'))->toBe(3600)->and($p->delay(1, '999999'))->toBe(3600)->and($p->delay(1))->toBeBetween(10,12);
});
