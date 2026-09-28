<?php

namespace App\Data;

use App\Enums\RecognitionSource;

final readonly class RecognitionInput
{
    public function __construct(
        public RecognitionSource $source,
        public string $mimeType,
        public string $mediaContents,
        public string $locale,
    ) {}
}
