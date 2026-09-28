<?php

namespace Tests\Feature;

use App\Contracts\RecognitionProvider;
use App\Contracts\TransitMediaStore;
use App\Data\RecognitionInput;
use App\Data\RecognitionResult;
use App\Data\StoredMedia;
use App\Exceptions\RecognitionProviderException;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use Tests\Fakes\FakeTransitMediaStore;
use Tests\TestCase;

final class RecognizeTest extends TestCase
{
    use RefreshDatabase;

    private const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

    protected function setUp(): void
    {
        parent::setUp();

        config(['recognition.allow_multipart_uploads' => true]);

        $this->withHeaders([
            'Accept' => 'application/json',
            'X-Device-Id' => self::DEVICE_ID,
        ]);
    }

    public function test_photo_is_recognized_through_the_configured_provider(): void
    {
        $this->app->instance(RecognitionProvider::class, new class implements RecognitionProvider
        {
            public function recognize(RecognitionInput $input): RecognitionResult
            {
                return new RecognitionResult(
                    title: 'Car keys',
                    locationText: 'Kitchen drawer',
                    tags: ['keys', 'car'],
                    transcript: null,
                    confidence: 0.91,
                );
            }
        });

        $this->post('/api/v1/recognize', [
            'source' => 'photo',
            'locale' => 'en',
            'media' => $this->jpegUpload(),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('status', 'recognized')
            ->assertJsonPath('result.title', 'Car keys')
            ->assertJsonPath('result.location_text', 'Kitchen drawer')
            ->assertJsonPath('result.tags', ['keys', 'car'])
            ->assertJsonPath('result.transcript', null)
            ->assertJsonPath('result.confidence', 0.91)
            ->assertJsonPath('usage.used', 1)
            ->assertJsonPath('usage.limit', 20)
            ->assertJsonStructure(['request_id', 'status', 'result', 'usage' => ['used', 'limit', 'resets_at']]);
    }

    public function test_voice_recognition_returns_a_transcript(): void
    {
        $this->app->instance(RecognitionProvider::class, new class implements RecognitionProvider
        {
            public function recognize(RecognitionInput $input): RecognitionResult
            {
                return new RecognitionResult(
                    title: 'Passport',
                    locationText: 'Top desk drawer',
                    tags: ['document'],
                    transcript: 'My passport is in the top desk drawer.',
                    confidence: 0.95,
                );
            }
        });

        $this->post('/api/v1/recognize', [
            'source' => 'voice',
            'media' => $this->wavUpload(),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('status', 'recognized')
            ->assertJsonPath('result.transcript', 'My passport is in the top desk drawer.')
            ->assertJsonPath('usage.used', 0);
    }

    public function test_s3_media_is_recognized_and_deleted_immediately(): void
    {
        $key = 'recognition/'.self::DEVICE_ID.'/75292e00-3a40-4a05-a200-c84a57b98fd8.jpg';
        $store = new FakeTransitMediaStore;
        $store->storedMedia = new StoredMedia('image/jpeg', 'private-image-bytes');
        $this->app->instance(TransitMediaStore::class, $store);

        $provider = new class implements RecognitionProvider
        {
            public ?RecognitionInput $input = null;

            public function recognize(RecognitionInput $input): RecognitionResult
            {
                $this->input = $input;

                return new RecognitionResult(
                    title: 'Car keys',
                    locationText: 'Kitchen counter',
                    tags: ['Wallet'],
                    transcript: null,
                    confidence: 0.93,
                    description: 'Silver keys with a blue fob.',
                    additionalItems: ['Wallet'],
                );
            }
        };
        $this->app->instance(RecognitionProvider::class, $provider);

        $this->postJson('/api/v1/recognize', [
            'source' => 'photo',
            'locale' => 'en',
            's3_key' => $key,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'recognized')
            ->assertJsonPath('result.description', 'Silver keys with a blue fob.')
            ->assertJsonPath('result.additional_items.0.title', 'Wallet')
            ->assertJsonPath('result.tags', ['Wallet']);

        $this->assertSame('private-image-bytes', $provider->input?->mediaContents);
        $this->assertSame([$key], $store->deletedKeys);
    }

    public function test_s3_media_is_deleted_when_the_provider_fails(): void
    {
        $key = 'recognition/'.self::DEVICE_ID.'/75292e00-3a40-4a05-a200-c84a57b98fd8.jpg';
        $store = new FakeTransitMediaStore;
        $store->storedMedia = new StoredMedia('image/jpeg', 'private-image-bytes');
        $this->app->instance(TransitMediaStore::class, $store);
        $this->app->instance(RecognitionProvider::class, new class implements RecognitionProvider
        {
            public function recognize(RecognitionInput $input): RecognitionResult
            {
                throw new RecognitionProviderException('Provider timeout.');
            }
        });

        $this->postJson('/api/v1/recognize', [
            'source' => 'photo',
            's3_key' => $key,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'unrecognized');

        $this->assertSame([$key], $store->deletedKeys);
    }

    public function test_s3_key_must_belong_to_the_requesting_device(): void
    {
        $this->postJson('/api/v1/recognize', [
            'source' => 'photo',
            's3_key' => 'recognition/9bf02fd6-aa45-4eb7-8cc4-e48ced497d5c/item.jpg',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['s3_key']);
    }

    public function test_idempotent_replay_does_not_call_provider_or_consume_usage_twice(): void
    {
        $provider = new class implements RecognitionProvider
        {
            public int $calls = 0;

            public function recognize(RecognitionInput $input): RecognitionResult
            {
                $this->calls++;

                return new RecognitionResult('Keys', 'Drawer', [], null, 0.9);
            }
        };
        $this->app->instance(RecognitionProvider::class, $provider);
        $this->withHeader('Idempotency-Key', '75292e00-3a40-4a05-a200-c84a57b98fd8');

        $first = $this->photoRequest()->assertOk();
        $second = $this->photoRequest()
            ->assertOk()
            ->assertHeader('X-Idempotent-Replay', 'true');

        $this->assertSame($first->json('request_id'), $second->json('request_id'));
        $this->assertSame(1, $provider->calls);
        $this->assertDatabaseHas('monthly_usages', [
            'device_id' => self::DEVICE_ID,
            'photo_recognitions' => 1,
        ]);
    }

    public function test_provider_failure_returns_a_non_blocking_fallback(): void
    {
        $this->app->instance(RecognitionProvider::class, new class implements RecognitionProvider
        {
            public function recognize(RecognitionInput $input): RecognitionResult
            {
                throw new RecognitionProviderException('Provider timeout.');
            }
        });

        $this->post('/api/v1/recognize', [
            'source' => 'photo',
            'media' => $this->jpegUpload(),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJson([
                'status' => 'unrecognized',
                'result' => [
                    'title' => '',
                    'location_text' => '',
                    'tags' => [],
                    'transcript' => null,
                    'confidence' => 0,
                ],
            ])
            ->assertJsonPath('usage.used', 1);
    }

    public function test_request_requires_a_supported_source_and_media(): void
    {
        $this->post('/api/v1/recognize', [
            'source' => 'text',
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['source', 'media']);
    }

    public function test_direct_multipart_upload_is_disabled_by_default_for_the_v1_3_flow(): void
    {
        config(['recognition.allow_multipart_uploads' => false]);

        $this->photoRequest()
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['media']);
    }

    public function test_media_content_type_is_verified_on_the_server(): void
    {
        $this->post('/api/v1/recognize', [
            'source' => 'photo',
            'media' => UploadedFile::fake()->create('photo.jpg', 1, 'text/plain'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['media']);
    }

    public function test_photo_size_limit_returns_one_source_specific_error(): void
    {
        $this->post('/api/v1/recognize', [
            'source' => 'photo',
            'media' => UploadedFile::fake()->create('photo.jpg', 5121, 'image/jpeg'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonCount(1, 'errors.media')
            ->assertJsonPath(
                'errors.media.0',
                'The media field must not be greater than 5120 kilobytes.',
            );
    }

    public function test_request_requires_a_valid_anonymous_device_id(): void
    {
        $this->withHeaders(['X-Device-Id' => 'not-a-uuid'])
            ->post('/api/v1/recognize', [
                'source' => 'photo',
                'media' => $this->jpegUpload(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['device_id']);
    }

    public function test_request_requires_an_anonymous_device_id_header(): void
    {
        $this->withHeaders(['X-Device-Id' => ''])
            ->post('/api/v1/recognize', [
                'source' => 'photo',
                'media' => $this->jpegUpload(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['device_id']);
    }

    public function test_twenty_first_photo_is_rejected_without_calling_the_provider(): void
    {
        config(['usage.free_photo_recognitions_per_month' => 2]);

        $provider = new class implements RecognitionProvider
        {
            public int $calls = 0;

            public function recognize(RecognitionInput $input): RecognitionResult
            {
                $this->calls++;

                return RecognitionResult::unrecognized();
            }
        };
        $this->app->instance(RecognitionProvider::class, $provider);

        $this->photoRequest()
            ->assertOk()
            ->assertJsonPath('usage.used', 1)
            ->assertJsonPath('usage.limit', 2);

        $this->photoRequest()
            ->assertOk()
            ->assertJsonPath('usage.used', 2);

        $this->photoRequest()
            ->assertStatus(429)
            ->assertJsonPath('code', 'monthly_limit_reached')
            ->assertJsonPath('message', 'Monthly free recognition limit reached.')
            ->assertJsonPath('usage.used', 2)
            ->assertJsonPath('usage.limit', 2)
            ->assertJsonStructure(['usage' => ['used', 'limit', 'resets_at']]);

        $this->assertSame(2, $provider->calls);
    }

    public function test_voice_does_not_consume_or_get_blocked_by_the_photo_limit(): void
    {
        config(['usage.free_photo_recognitions_per_month' => 1]);
        $this->app->instance(RecognitionProvider::class, $this->unrecognizedProvider());

        $this->photoRequest()->assertOk()->assertJsonPath('usage.used', 1);
        $this->post('/api/v1/recognize', [
            'source' => 'voice',
            'media' => $this->wavUpload(),
        ])
            ->assertOk()
            ->assertJsonPath('usage.used', 1)
            ->assertJsonPath('usage.limit', 1);

        $this->assertDatabaseHas('monthly_usages', [
            'device_id' => self::DEVICE_ID,
            'photo_recognitions' => 1,
        ]);
    }

    public function test_photo_quota_is_isolated_per_device(): void
    {
        config(['usage.free_photo_recognitions_per_month' => 1]);
        $this->app->instance(RecognitionProvider::class, $this->unrecognizedProvider());

        $this->photoRequest()->assertOk()->assertJsonPath('usage.used', 1);

        $this->withHeaders(['X-Device-Id' => '9bf02fd6-aa45-4eb7-8cc4-e48ced497d5c']);
        $this->photoRequest()->assertOk()->assertJsonPath('usage.used', 1);

        $this->assertDatabaseCount('anonymous_devices', 2);
        $this->assertDatabaseCount('monthly_usages', 2);
    }

    public function test_photo_quota_resets_at_the_start_of_a_new_utc_month(): void
    {
        config(['usage.free_photo_recognitions_per_month' => 1]);
        $this->app->instance(RecognitionProvider::class, $this->unrecognizedProvider());

        try {
            CarbonImmutable::setTestNow('2026-09-30 23:59:00 UTC');
            $this->photoRequest()
                ->assertOk()
                ->assertJsonPath('usage.used', 1)
                ->assertJsonPath('usage.resets_at', '2026-10-01T00:00:00Z');

            CarbonImmutable::setTestNow('2026-10-01 00:01:00 UTC');
            $this->photoRequest()
                ->assertOk()
                ->assertJsonPath('usage.used', 1)
                ->assertJsonPath('usage.resets_at', '2026-11-01T00:00:00Z');
        } finally {
            CarbonImmutable::setTestNow();
        }

        $this->assertDatabaseCount('monthly_usages', 2);
    }

    public function test_invalid_requests_do_not_consume_usage(): void
    {
        $this->post('/api/v1/recognize', [
            'source' => 'photo',
            'media' => UploadedFile::fake()->create('photo.jpg', 1, 'text/plain'),
        ])->assertUnprocessable();

        $this->assertDatabaseCount('monthly_usages', 0);
    }

    private function photoRequest(): TestResponse
    {
        return $this->post('/api/v1/recognize', [
            'source' => 'photo',
            'media' => $this->jpegUpload(),
        ]);
    }

    private function unrecognizedProvider(): RecognitionProvider
    {
        return new class implements RecognitionProvider
        {
            public function recognize(RecognitionInput $input): RecognitionResult
            {
                return RecognitionResult::unrecognized();
            }
        };
    }

    private function jpegUpload(): UploadedFile
    {
        $jpeg = base64_decode(
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////'.
            '2wBDAf//////////////////////////////////////////////////////////////////////////////////////'.
            'wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/'.
            '9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAA'.
            'AAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAA'.
            'AAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABCf/8QA'.
            'FBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QA'.
            'FBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=',
            true,
        );

        return UploadedFile::fake()->createWithContent('item.jpg', $jpeg);
    }

    private function wavUpload(): UploadedFile
    {
        $wav = 'RIFF'.pack('V', 36).'WAVEfmt '.pack('VvvVVvv', 16, 1, 1, 8000, 16000, 2, 16).'data'.pack('V', 0);

        return UploadedFile::fake()->createWithContent('voice.wav', $wav);
    }
}
