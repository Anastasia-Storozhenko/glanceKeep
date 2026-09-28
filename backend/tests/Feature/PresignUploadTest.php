<?php

namespace Tests\Feature;

use App\Contracts\TransitMediaStore;
use App\Data\PresignedUpload;
use Carbon\CarbonImmutable;
use Tests\Fakes\FakeTransitMediaStore;
use Tests\TestCase;

final class PresignUploadTest extends TestCase
{
    private const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

    public function test_it_returns_a_private_direct_upload_contract(): void
    {
        $store = new FakeTransitMediaStore;
        $store->presignedUpload = new PresignedUpload(
            key: 'recognition/'.self::DEVICE_ID.'/photo.jpg',
            url: 'https://private-bucket.test/upload',
            headers: ['Content-Type' => ['image/jpeg']],
            expiresAt: CarbonImmutable::parse('2026-09-08T12:05:00Z'),
        );
        $this->app->instance(TransitMediaStore::class, $store);

        $this->withHeader('X-Device-Id', self::DEVICE_ID)
            ->postJson('/api/v1/uploads/presign', [
                'source' => 'photo',
                'content_type' => 'image/jpeg',
                'content_length' => 204800,
            ])
            ->assertOk()
            ->assertJson([
                's3_key' => 'recognition/'.self::DEVICE_ID.'/photo.jpg',
                'upload_url' => 'https://private-bucket.test/upload',
                'headers' => ['Content-Type' => ['image/jpeg']],
                'expires_at' => '2026-09-08T12:05:00Z',
            ]);

        $this->assertCount(1, $store->presignCalls);
        $this->assertSame(204800, $store->presignCalls[0]['content_length']);
    }

    public function test_it_rejects_an_unsupported_content_type(): void
    {
        $this->withHeader('X-Device-Id', self::DEVICE_ID)
            ->postJson('/api/v1/uploads/presign', [
                'source' => 'photo',
                'content_type' => 'application/pdf',
                'content_length' => 1024,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['content_type']);
    }

    public function test_it_rejects_media_larger_than_the_source_limit(): void
    {
        config(['recognition.max_size_kilobytes.photo' => 100]);

        $this->withHeader('X-Device-Id', self::DEVICE_ID)
            ->postJson('/api/v1/uploads/presign', [
                'source' => 'photo',
                'content_type' => 'image/jpeg',
                'content_length' => 102401,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['content_length']);
    }
}
