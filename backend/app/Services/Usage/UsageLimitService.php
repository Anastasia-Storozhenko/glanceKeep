<?php

namespace App\Services\Usage;

use App\Data\UsageSnapshot;
use App\Enums\RecognitionSource;
use App\Exceptions\MonthlyLimitReachedException;
use App\Models\AnonymousDevice;
use App\Models\MonthlyUsage;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class UsageLimitService
{
    public function consume(string $deviceId, RecognitionSource $source): UsageSnapshot
    {
        if ($source === RecognitionSource::Voice) {
            return $this->snapshot($deviceId);
        }

        $periodStart = $this->periodStart();
        $limit = $this->limit();

        return DB::transaction(function () use ($deviceId, $periodStart, $limit): UsageSnapshot {
            $now = now();

            AnonymousDevice::query()->insertOrIgnore([
                'id' => $deviceId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            MonthlyUsage::query()->insertOrIgnore([
                'device_id' => $deviceId,
                'period_start' => $periodStart->toDateString(),
                'photo_recognitions' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $updated = MonthlyUsage::query()
                ->where('device_id', $deviceId)
                ->whereDate('period_start', $periodStart->toDateString())
                ->where('photo_recognitions', '<', $limit)
                ->increment('photo_recognitions', 1, ['updated_at' => $now]);

            $used = $this->used($deviceId, $periodStart);
            $snapshot = $this->makeSnapshot($used, $periodStart);

            if ($updated === 0) {
                throw new MonthlyLimitReachedException($snapshot);
            }

            return $snapshot;
        });
    }

    public function snapshot(string $deviceId): UsageSnapshot
    {
        $periodStart = $this->periodStart();

        return $this->makeSnapshot($this->used($deviceId, $periodStart), $periodStart);
    }

    private function used(string $deviceId, CarbonImmutable $periodStart): int
    {
        return (int) MonthlyUsage::query()
            ->where('device_id', $deviceId)
            ->whereDate('period_start', $periodStart->toDateString())
            ->value('photo_recognitions');
    }

    private function makeSnapshot(int $used, CarbonImmutable $periodStart): UsageSnapshot
    {
        return new UsageSnapshot(
            used: $used,
            limit: $this->limit(),
            resetsAt: $periodStart->addMonth(),
        );
    }

    private function periodStart(): CarbonImmutable
    {
        return CarbonImmutable::now('UTC')->startOfMonth();
    }

    private function limit(): int
    {
        return max(0, (int) config('usage.free_photo_recognitions_per_month', 20));
    }
}
