<?php

namespace App\Data;

final readonly class StoredMedia
{
    public function __construct(
        public string $mimeType,
        public string $contents,
    ) {}
}
