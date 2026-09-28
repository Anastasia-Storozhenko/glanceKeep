<?php

namespace App\Http\Controllers\Api\V1;

use App\Contracts\RecognitionProvider;
use App\Contracts\TransitMediaStore;
use App\Data\RecognitionInput;
use App\Data\RecognitionResult;
use App\Data\StoredMedia;
use App\Data\UsageSnapshot;
use App\Enums\RecognitionSource;
use App\Exceptions\MonthlyLimitReachedException;
use App\Exceptions\RecognitionProviderException;
use App\Exceptions\TransitMediaException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\RecognizeRequest;
use App\Services\Usage\UsageLimitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

final class RecognizeController extends Controller
{
    public function __invoke(
        RecognizeRequest $request,
        RecognitionProvider $provider,
        TransitMediaStore $mediaStore,
        UsageLimitService $usageLimit,
    ): JsonResponse {
        $idempotencyKey = $request->string('idempotency_key')->toString();

        if ($idempotencyKey === '') {
            return $this->recognize($request, $provider, $mediaStore, $usageLimit);
        }

        $cacheKey = 'recognition:idempotency:'.hash(
            'sha256',
            $request->string('device_id')->toString().':'.$idempotencyKey,
        );

        if (is_array($cached = Cache::get($cacheKey))) {
            return $this->cachedResponse($cached);
        }

        $lock = Cache::lock(
            $cacheKey.':lock',
            max(1, (int) config('recognition.idempotency_lock_seconds', 30)),
        );

        if (! $lock->get()) {
            return response()->json([
                'message' => 'A recognition request with this idempotency key is already processing.',
                'code' => 'request_in_progress',
            ], 409);
        }

        try {
            if (is_array($cached = Cache::get($cacheKey))) {
                return $this->cachedResponse($cached);
            }

            $response = $this->recognize($request, $provider, $mediaStore, $usageLimit);
            Cache::put($cacheKey, [
                'body' => $response->getData(true),
                'status' => $response->getStatusCode(),
            ], now()->addSeconds(max(1, (int) config('recognition.idempotency_ttl_seconds', 86400))));

            return $response;
        } finally {
            $lock->release();
        }
    }

    private function recognize(
        RecognizeRequest $request,
        RecognitionProvider $provider,
        TransitMediaStore $mediaStore,
        UsageLimitService $usageLimit,
    ): JsonResponse {
        $requestId = (string) Str::uuid();
        $source = RecognitionSource::from($request->string('source')->toString());
        $deviceId = $request->string('device_id')->toString();
        $s3Key = $request->filled('s3_key') ? $request->string('s3_key')->toString() : null;

        try {
            try {
                $media = $s3Key !== null
                    ? $mediaStore->read($deviceId, $source, $s3Key)
                    : $this->multipartMedia($request);
            } catch (TransitMediaException $exception) {
                Log::warning('Unable to read recognition media.', [
                    'request_id' => $requestId,
                    'source' => $source->value,
                    'exception' => $exception::class,
                ]);

                return $this->response(
                    $requestId,
                    RecognitionResult::unrecognized(),
                    $usageLimit->snapshot($deviceId),
                );
            }

            try {
                $usage = $usageLimit->consume($deviceId, $source);
            } catch (MonthlyLimitReachedException $exception) {
                return response()->json([
                    'message' => $exception->getMessage(),
                    'code' => 'monthly_limit_reached',
                    'usage' => $exception->usage->toArray(),
                ], 429);
            }

            try {
                $result = $provider->recognize(new RecognitionInput(
                    source: $source,
                    mimeType: $media->mimeType,
                    mediaContents: $media->contents,
                    locale: $request->string('locale', config('app.locale'))->toString(),
                ));
            } catch (RecognitionProviderException $exception) {
                Log::warning('Recognition provider request failed.', [
                    'request_id' => $requestId,
                    'source' => $source->value,
                    'exception' => $exception::class,
                ]);

                $result = RecognitionResult::unrecognized();
            }

            return $this->response($requestId, $result, $usage);
        } finally {
            if ($s3Key !== null) {
                try {
                    $mediaStore->delete($s3Key);
                } catch (TransitMediaException $exception) {
                    Log::error('Unable to delete recognition media.', [
                        'request_id' => $requestId,
                        's3_key' => $s3Key,
                        'exception' => $exception::class,
                    ]);
                }
            }
        }
    }

    /**
     * @param  array{body: array<string, mixed>, status: int}  $cached
     */
    private function cachedResponse(array $cached): JsonResponse
    {
        return response()
            ->json($cached['body'], $cached['status'])
            ->header('X-Idempotent-Replay', 'true');
    }

    private function multipartMedia(RecognizeRequest $request): StoredMedia
    {
        $media = $request->file('media');
        $contents = $media !== null ? file_get_contents($media->getRealPath()) : false;
        $mimeType = $media?->getMimeType();

        if ($contents === false || ! is_string($mimeType)) {
            throw new TransitMediaException('Unable to read the uploaded media.');
        }

        return new StoredMedia($mimeType, $contents);
    }

    private function response(
        string $requestId,
        RecognitionResult $result,
        UsageSnapshot $usage,
    ): JsonResponse {
        return response()->json([
            'request_id' => $requestId,
            'status' => $result->isRecognized() ? 'recognized' : 'unrecognized',
            'result' => $result->toArray(),
            'usage' => $usage->toArray(),
        ]);
    }
}
