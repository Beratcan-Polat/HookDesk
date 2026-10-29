<?php

use Illuminate\Console\Scheduling\CacheEventMutex;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Cache\Factory;

it('allows delivery recovery to resume after a scheduler dies while holding its lock', function () {
    $event = collect(app(Schedule::class)->events())->first(fn ($event) => str_contains($event->command ?? '', 'hookdesk:dispatch'));
    expect($event)->not->toBeNull();
    $mutex = new CacheEventMutex(app(Factory::class));
    $mutex->useStore('array');

    try {
        expect($mutex->create($event))->toBeTrue();
        expect($mutex->create($event))->toBeFalse();

        // Simulate a process exit without releasing the lock, then let its lease expire.
        $this->travel(61)->seconds();
        expect($mutex->create($event))->toBeTrue();
    } finally {
        $mutex->forget($event);
        $this->travelBack();
    }
});
