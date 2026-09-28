<?php

namespace Tests\Unit;

use App\Data\RecognitionInput;
use App\Enums\RecognitionSource;
use App\Exceptions\RecognitionProviderException;
use App\Services\Recognition\GeminiRecognitionProvider;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class GeminiRecognitionProviderTest extends TestCase
{
    public function test_it_sends_inline_media_and_normalizes_structured_output(): void
    {
        config([
            'services.gemini.api_key' => 'server-secret',
            'services.gemini.model' => 'test-model',
            'services.gemini.base_url' => 'https://gemini.test/v1beta',
        ]);

        Http::fake([
            '*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [[
                            'text' => json_encode([
                                'title' => '  Keys  ',
                                'description' => '  Silver keys with a blue fob. ',
                                'location_text' => '  Hall drawer ',
                                'additional_items' => [
                                    ['title' => ' wallet '],
                                    ['title' => 'phone'],
                                ],
                                'transcript' => 'ignored for photos',
                                'confidence' => 1.4,
                            ]),
                        ]],
                    ],
                ]],
            ]),
        ]);

        $result = app(GeminiRecognitionProvider::class)->recognize(new RecognitionInput(
            source: RecognitionSource::Photo,
            mimeType: 'image/jpeg',
            mediaContents: 'image-bytes',
            locale: 'en',
        ));

        $this->assertSame('Keys', $result->title);
        $this->assertSame('Silver keys with a blue fob.', $result->description);
        $this->assertSame('Hall drawer', $result->locationText);
        $this->assertSame(['wallet', 'phone'], $result->additionalItems);
        $this->assertSame(['wallet', 'phone'], $result->tags);
        $this->assertNull($result->transcript);
        $this->assertSame(1.0, $result->confidence);

        Http::assertSent(function (Request $request): bool {
            return $request->url() === 'https://gemini.test/v1beta/models/test-model:generateContent'
                && $request->hasHeader('x-goog-api-key', 'server-secret')
                && $request['contents'][0]['parts'][1]['inlineData']['mimeType'] === 'image/jpeg'
                && $request['contents'][0]['parts'][1]['inlineData']['data'] === base64_encode('image-bytes')
                && $request['generationConfig']['responseMimeType'] === 'application/json'
                && in_array('description', $request['generationConfig']['responseJsonSchema']['required'], true)
                && in_array('additional_items', $request['generationConfig']['responseJsonSchema']['required'], true);
        });
    }

    public function test_it_uses_a_low_confidence_generic_title_when_gemini_returns_no_title(): void
    {
        config([
            'services.gemini.api_key' => 'server-secret',
            'services.gemini.model' => 'test-model',
            'services.gemini.base_url' => 'https://gemini.test/v1beta',
        ]);

        Http::fake([
            '*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [[
                            'text' => json_encode([
                                'title' => '',
                                'description' => '',
                                'location_text' => '',
                                'additional_items' => [],
                                'transcript' => 'Welcome to samplelead.com.',
                                'confidence' => 0.95,
                            ]),
                        ]],
                    ],
                ]],
            ]),
        ]);

        $result = app(GeminiRecognitionProvider::class)->recognize(new RecognitionInput(
            source: RecognitionSource::Voice,
            mimeType: 'audio/mpeg',
            mediaContents: 'audio-bytes',
            locale: 'uk',
        ));

        $this->assertSame('Unknown item', $result->title);
        $this->assertSame('', $result->locationText);
        $this->assertSame([], $result->tags);
        $this->assertSame('Welcome to samplelead.com.', $result->transcript);
        $this->assertSame(0.29, $result->confidence);
    }

    public function test_it_rejects_a_missing_api_key_before_sending_a_request(): void
    {
        config(['services.gemini.api_key' => null]);
        Http::fake();

        $this->expectException(RecognitionProviderException::class);

        app(GeminiRecognitionProvider::class)->recognize(new RecognitionInput(
            source: RecognitionSource::Voice,
            mimeType: 'audio/wav',
            mediaContents: 'audio-bytes',
            locale: 'en',
        ));

        Http::assertNothingSent();
    }
}
