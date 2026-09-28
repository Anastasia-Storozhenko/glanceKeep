<?php

namespace App\Exceptions;

use App\Data\UsageSnapshot;
use RuntimeException;

final class MonthlyLimitReachedException extends RuntimeException
{
    public function __construct(public readonly UsageSnapshot $usage)
    {
        parent::__construct('Monthly free recognition limit reached.');
    }
}
