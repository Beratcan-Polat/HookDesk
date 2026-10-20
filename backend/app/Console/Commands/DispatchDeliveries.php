<?php

namespace App\Console\Commands;

use App\Services\DispatchDue;
use Illuminate\Console\Command;

class DispatchDeliveries extends Command
{
    protected $signature = 'hookdesk:dispatch';

    protected $description = 'Recover interrupted webhook attempts and enqueue due durable deliveries';

    public function handle(DispatchDue $dispatcher): int
    {
        $dispatcher->recover();
        $this->info('Delivery recovery complete.');

        return self::SUCCESS;
    }
}
