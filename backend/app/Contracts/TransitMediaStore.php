<?php

namespace App\Contracts;

use App\Data\PresignedUpload;
use App\Data\StoredMedia;
use App\Enums\RecognitionSource;
use App\Exceptions\TransitMediaException;

interface TransitMediaStore
{
    /**
     * @throws TransitMediaException
     */
    public function presign(
        string $deviceId,
        RecognitionSource $source,
        string $mimeType,
        int $contentLength,
    ): PresignedUpload;

    /**
     * @throws TransitMediaException
     */
    public function read(
        string $deviceId,
        RecognitionSource $source,
        string $key,
    ): StoredMedia;

    /**
     * @throws TransitMediaException
     */
    public function delete(string $key): void;
}
