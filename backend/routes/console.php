<?php

use Illuminate\Support\Facades\Schedule;

// A killed scheduler must not leave delivery recovery locked for the default 24 hours.
Schedule::command('hookdesk:dispatch')->everyFiveSeconds()->withoutOverlapping(1);
Schedule::command('hookdesk:prune')->dailyAt('03:00')->withoutOverlapping();
