<?php

namespace App\Services\Media;

use App\Contracts\TransitMediaStore;
use App\Data\PresignedUpload;
use App\Data\StoredMedia;
use App\Enums\RecognitionSource;
use App\Exceptions\TransitMediaException;
use Carbon\CarbonImmutable;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Support\Str;
use Throwable;

final class S3TransitMediaStore implements TransitMediaStore
{
    public function __construct(private readonly FilesystemManager $filesystems) {}

    public function presign(
        string $deviceId,
        RecognitionSource $source,
        string $mimeType,
        int $contentLength,
    ): PresignedUpload {
        $expiresAt = CarbonImmutable::now('UTC')->addSeconds(
            max(1, (int) config('recognition.transit.presign_ttl_seconds', 300)),
        );
        $key = sprintf(
            '%s/%s/%s.%s',
            trim((string) config('recognition.transit.key_prefix', 'recognition'), '/'),
            $deviceId,
            Str::uuid(),
            $this->extensionFor($mimeType),
        );

        try {
            $upload = $this->disk()->temporaryUploadUrl($key, $expiresAt, [
                'ContentType' => $mimeType,
                'ContentLength' => $contentLength,
                'Metadata' => [
                    'device-id' => $deviceId,
                    'source' => $source->value,
                ],
            ]);
        } catch (Throwable $exception) {
            throw new TransitMediaException('Unable to create a media upload URL.', previous: $exception);
        }

        $headers = $upload['headers'];
        $headers['Content-Type'] = [$mimeType];

        return new PresignedUpload(
            key: $key,
            url: $upload['url'],
            headers: $headers,
            expiresAt: $expiresAt,
        );
    }

    public function read(
        string $deviceId,
        RecognitionSource $source,
        string $key,
    ): StoredMedia {
        $this->assertOwnedKey($deviceId, $key);

        try {
            $disk = $this->disk();

            if (! $disk->exists($key)) {
                throw new TransitMediaException('The uploaded media was not found or has expired.');
            }

            $size = $disk->size($key);
            $maximumBytes = (int) config("recognition.max_size_kilobytes.{$source->value}") * 1024;

            if ($size < 1 || $size > $maximumBytes) {
                throw new TransitMediaException('The uploaded media size is invalid.');
            }

            $mimeType = $disk->mimeType($key);
            $allowedMimeTypes = config("recognition.allowed_mime_types.{$source->value}", []);

            if (! is_string($mimeType) || ! in_array($mimeType, $allowedMimeTypes, true)) {
                throw new TransitMediaException('The uploaded media type is not supported.');
            }

            $contents = $disk->get($key);

            if ($contents === '') {
                throw new TransitMediaException('The uploaded media is empty.');
            }

            return new StoredMedia($mimeType, $contents);
        } catch (TransitMediaException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            throw new TransitMediaException('Unable to read the uploaded media.', previous: $exception);
        }
    }

    public function delete(string $key): void
    {
        try {
            $this->disk()->delete($key);
        } catch (Throwable $exception) {
            throw new TransitMediaException('Unable to delete the uploaded media.', previous: $exception);
        }
    }

    private function disk(): FilesystemAdapter
    {
        return $this->filesystems->disk((string) config('recognition.transit.disk'));
    }

    private function assertOwnedKey(string $deviceId, string $key): void
    {
        $prefix = trim((string) config('recognition.transit.key_prefix', 'recognition'), '/');
        $ownedKeyPattern = sprintf(
            '#^%s/%s/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$#i',
            preg_quote($prefix, '#'),
            preg_quote($deviceId, '#'),
        );

        if (preg_match($ownedKeyPattern, $key) !== 1) {
            throw new TransitMediaException('The uploaded media does not belong to this device.');
        }
    }

    private function extensionFor(string $mimeType): string
    {
        return match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/heic' => 'heic',
            'image/heif' => 'heif',
            'audio/aac' => 'aac',
            'audio/flac' => 'flac',
            'audio/m4a', 'audio/mp4', 'audio/x-m4a', 'video/mp4' => 'm4a',
            'audio/mpeg' => 'mp3',
            'audio/ogg' => 'ogg',
            'audio/wav', 'audio/x-wav' => 'wav',
            default => 'bin',
        };
    }
}
