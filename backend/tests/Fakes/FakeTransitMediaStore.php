<?php

namespace Tests\Fakes;

use App\Contracts\TransitMediaStore;
use App\Data\PresignedUpload;
use App\Data\StoredMedia;
use App\Enums\RecognitionSource;
use App\Exceptions\TransitMediaException;

final class FakeTransitMediaStore implements TransitMediaStore
{
    public ?PresignedUpload $presignedUpload = null;

    public ?StoredMedia $storedMedia = null;

    /** @var list<array{device_id: string, source: RecognitionSource, mime_type: string, content_length: int}> */
    public array $presignCalls = [];

    /** @var list<array{device_id: string, source: RecognitionSource, key: string}> */
    public array $readCalls = [];

    /** @var list<string> */
    public array $deletedKeys = [];

    public function presign(
        string $deviceId,
        RecognitionSource $source,
        string $mimeType,
        int $contentLength,
    ): PresignedUpload {
        $this->presignCalls[] = [
            'device_id' => $deviceId,
            'source' => $source,
            'mime_type' => $mimeType,
            'content_length' => $contentLength,
        ];

        return $this->presignedUpload
            ?? throw new TransitMediaException('No fake presigned upload configured.');
    }

    public function read(
        string $deviceId,
        RecognitionSource $source,
        string $key,
    ): StoredMedia {
        $this->readCalls[] = [
            'device_id' => $deviceId,
            'source' => $source,
            'key' => $key,
        ];

        return $this->storedMedia
            ?? throw new TransitMediaException('No fake stored media configured.');
    }

    public function delete(string $key): void
    {
        $this->deletedKeys[] = $key;
    }
}
