<?php

namespace App\Providers;

use App\Contracts\RecognitionProvider;
use App\Contracts\TransitMediaStore;
use App\Services\Media\S3TransitMediaStore;
use App\Services\Recognition\GeminiRecognitionProvider;
use Illuminate\Support\ServiceProvider;
use LogicException;

final class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(TransitMediaStore::class, S3TransitMediaStore::class);

        $this->app->bind(RecognitionProvider::class, function ($app): RecognitionProvider {
            return match (config('recognition.provider')) {
                'gemini' => $app->make(GeminiRecognitionProvider::class),
                default => throw new LogicException('Unsupported recognition provider configured.'),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
