<?php

namespace App\Data;

use Carbon\CarbonImmutable;

final readonly class PresignedUpload
{
    /**
     * @param  array<string, list<string>|string>  $headers
     */
    public function __construct(
        public string $key,
        public string $url,
        public array $headers,
        public CarbonImmutable $expiresAt,
    ) {}

    /**
     * @return array{s3_key: string, upload_url: string, headers: array<string, list<string>|string>, expires_at: string}
     */
    public function toArray(): array
    {
        return [
            's3_key' => $this->key,
            'upload_url' => $this->url,
            'headers' => $this->headers,
            'expires_at' => $this->expiresAt->toIso8601ZuluString(),
        ];
    }
}
