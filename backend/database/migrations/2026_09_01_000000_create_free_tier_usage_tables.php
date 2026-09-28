<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('anonymous_devices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->timestamps();
        });

        Schema::create('monthly_usages', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('device_id')->constrained('anonymous_devices')->cascadeOnDelete();
            $table->date('period_start');
            $table->unsignedInteger('photo_recognitions')->default(0);
            $table->timestamps();

            $table->unique(['device_id', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_usages');
        Schema::dropIfExists('anonymous_devices');
    }
};
