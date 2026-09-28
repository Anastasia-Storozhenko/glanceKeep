<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class MonthlyUsage extends Model
{
    protected $fillable = [
        'device_id',
        'period_start',
        'photo_recognitions',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'photo_recognitions' => 'integer',
        ];
    }
}
