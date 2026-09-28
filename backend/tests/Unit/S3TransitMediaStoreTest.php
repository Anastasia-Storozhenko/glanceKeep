<?php

namespace Tests\Unit;

use App\Enums\RecognitionSource;
use App\Exceptions\TransitMediaException;
use App\Services\Media\S3TransitMediaStore;
use Carbon\CarbonImmutable;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Filesystem\FilesystemManager;
use Mockery;
use Tests\TestCase;

final class S3TransitMediaStoreTest extends TestCase
{
    private const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'recognition.transit.disk' => 'recognition_uploads',
            'recognition.transit.key_prefix' => 'recognition',
            'recognition.transit.presign_ttl_seconds' => 300,
        ]);
    }

    public function test_it_presigns_an_exact_device_scoped_put_request(): void
    {
        CarbonImmutable::setTestNow('2026-09-08T12:00:00Z');
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('temporaryUploadUrl')
            ->once()
            ->withArgs(function (string $key, $expiresAt, array $options): bool {
                $this->assertStringStartsWith('recognition/'.self::DEVICE_ID.'/', $key);
                $this->assertStringEndsWith('.jpg', $key);
                $this->assertSame('2026-09-08T12:05:00+00:00', $expiresAt->toIso8601String());
                $this->assertSame('image/jpeg', $options['ContentType']);
                $this->assertSame(204800, $options['ContentLength']);
                $this->assertSame(self::DEVICE_ID, $options['Metadata']['device-id']);
                $this->assertSame('photo', $options['Metadata']['source']);

                return true;
            })
            ->andReturn([
                'url' => 'https://private-bucket.test/upload',
                'headers' => [
                    'Host' => ['private-bucket.test'],
                    'x-amz-meta-device-id' => [self::DEVICE_ID],
                ],
            ]);

        $upload = $this->service($disk)->presign(
            self::DEVICE_ID,
            RecognitionSource::Photo,
            'image/jpeg',
            204800,
        );

        $this->assertSame('https://private-bucket.test/upload', $upload->url);
        $this->assertSame(['image/jpeg'], $upload->headers['Content-Type']);
        $this->assertSame('2026-09-08T12:05:00Z', $upload->expiresAt->toIso8601ZuluString());

        CarbonImmutable::setTestNow();
    }

    public function test_it_reads_valid_private_media_and_deletes_it(): void
    {
        $key = 'recognition/'.self::DEVICE_ID.'/75292e00-3a40-4a05-a200-c84a57b98fd8.jpg';
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('exists')->once()->with($key)->andReturnTrue();
        $disk->shouldReceive('size')->once()->with($key)->andReturn(11);
        $disk->shouldReceive('mimeType')->once()->with($key)->andReturn('image/jpeg');
        $disk->shouldReceive('get')->once()->with($key)->andReturn('image-bytes');
        $disk->shouldReceive('delete')->once()->with($key)->andReturnTrue();
        $service = $this->service($disk);

        $media = $service->read(self::DEVICE_ID, RecognitionSource::Photo, $key);
        $service->delete($key);

        $this->assertSame('image/jpeg', $media->mimeType);
        $this->assertSame('image-bytes', $media->contents);
    }

    public function test_it_rejects_a_key_owned_by_another_device_before_reading_s3(): void
    {
        $this->expectException(TransitMediaException::class);

        $this->service(Mockery::mock(FilesystemAdapter::class))->read(
            self::DEVICE_ID,
            RecognitionSource::Photo,
            'recognition/9bf02fd6-aa45-4eb7-8cc4-e48ced497d5c/75292e00-3a40-4a05-a200-c84a57b98fd8.jpg',
        );
    }

    private function service(FilesystemAdapter $disk): S3TransitMediaStore
    {
        $filesystems = Mockery::mock(FilesystemManager::class);
        $filesystems->shouldReceive('disk')
            ->with('recognition_uploads')
            ->andReturn($disk);

        return new S3TransitMediaStore($filesystems);
    }
}
