<?php

namespace App\Http\Controllers\Api\V1;

use App\Contracts\TransitMediaStore;
use App\Enums\RecognitionSource;
use App\Exceptions\TransitMediaException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\PresignUploadRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

final class PresignUploadController extends Controller
{
    public function __invoke(
        PresignUploadRequest $request,
        TransitMediaStore $mediaStore,
    ): JsonResponse {
        try {
            $upload = $mediaStore->presign(
                deviceId: $request->string('device_id')->toString(),
                source: RecognitionSource::from($request->string('source')->toString()),
                mimeType: $request->string('content_type')->toString(),
                contentLength: $request->integer('content_length'),
            );
        } catch (TransitMediaException $exception) {
            Log::error('Unable to create a presigned media upload.', [
                'device_id' => $request->string('device_id')->toString(),
                'source' => $request->string('source')->toString(),
                'exception' => $exception::class,
            ]);

            return response()->json([
                'message' => 'Media upload is temporarily unavailable.',
                'code' => 'upload_unavailable',
            ], 503);
        }

        return response()->json($upload->toArray());
    }
}
