<?php

use App\Http\Controllers\Api\V1\HealthCheckController;
use App\Http\Controllers\Api\V1\PresignUploadController;
use App\Http\Controllers\Api\V1\RecognizeController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthCheckController::class)->name('health');
Route::post('/uploads/presign', PresignUploadController::class)->name('uploads.presign');
Route::post('/recognize', RecognizeController::class)->name('recognize');
