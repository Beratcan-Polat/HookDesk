<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('hookdesk:dispatch')->everyFiveSeconds()->withoutOverlapping();
Schedule::command('hookdesk:prune')->dailyAt('03:00')->withoutOverlapping();
