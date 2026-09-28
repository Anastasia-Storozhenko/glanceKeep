<?php

namespace App\Data;

use Carbon\CarbonImmutable;

final readonly class UsageSnapshot
{
    public function __construct(
        public int $used,
        public int $limit,
        public CarbonImmutable $resetsAt,
    ) {}

    /**
     * @return array{used: int, limit: int, resets_at: string}
     */
    public function toArray(): array
    {
        return [
            'used' => $this->used,
            'limit' => $this->limit,
            'resets_at' => $this->resetsAt->toIso8601ZuluString(),
        ];
    }
}
