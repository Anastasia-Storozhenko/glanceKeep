<?php

namespace App\Services\Recognition;

use App\Contracts\RecognitionProvider;
use App\Data\RecognitionInput;
use App\Data\RecognitionResult;
use App\Enums\RecognitionSource;
use App\Exceptions\RecognitionProviderException;
use Illuminate\Http\Client\Factory as HttpFactory;
use JsonException;
use Throwable;

final class GeminiRecognitionProvider implements RecognitionProvider
{
    public function __construct(private readonly HttpFactory $http) {}

    public function recognize(RecognitionInput $input): RecognitionResult
    {
        $apiKey = config('services.gemini.api_key');
        $model = config('services.gemini.model');

        if (! is_string($apiKey) || $apiKey === '' || ! is_string($model) || $model === '') {
            throw new RecognitionProviderException('Gemini is not configured.');
        }

        try {
            $response = $this->http
                ->baseUrl(rtrim(config('services.gemini.base_url'), '/'))
                ->withHeaders(['x-goog-api-key' => $apiKey])
                ->acceptJson()
                ->asJson()
                ->connectTimeout(config('services.gemini.connect_timeout_seconds'))
                ->timeout(config('services.gemini.timeout_seconds'))
                ->post('/models/'.rawurlencode($model).':generateContent', [
                    'contents' => [[
                        'role' => 'user',
                        'parts' => [
                            ['text' => $this->prompt($input)],
                            ['inlineData' => [
                                'mimeType' => $input->mimeType,
                                'data' => base64_encode($input->mediaContents),
                            ]],
                        ],
                    ]],
                    'generationConfig' => [
                        'responseMimeType' => 'application/json',
                        'responseJsonSchema' => $this->responseSchema(),
                    ],
                ])
                ->throw();

            $json = $response->json('candidates.0.content.parts.0.text');

            if (! is_string($json) || $json === '') {
                throw new RecognitionProviderException('Gemini returned no structured result.');
            }

            return $this->normalize(json_decode($json, true, flags: JSON_THROW_ON_ERROR), $input->source);
        } catch (RecognitionProviderException $exception) {
            throw $exception;
        } catch (JsonException $exception) {
            throw new RecognitionProviderException('Gemini returned invalid JSON.', previous: $exception);
        } catch (Throwable $exception) {
            throw new RecognitionProviderException('Gemini request failed.', previous: $exception);
        }
    }

    private function prompt(RecognitionInput $input): string
    {
        $task = $input->source === RecognitionSource::Photo
            ? 'Look at the photo and identify the SINGLE most prominent foreground object: the one the user most likely wants to remember. Ignore background clutter and surfaces such as tables, floors, and walls unless they are the primary subject. List other clearly recognizable distinct objects as additional_items.'
            : 'Listen to the voice recording, preserve the raw spoken words in transcript, and identify the primary physical item and its storage location. List other clearly mentioned physical items as additional_items.';

        return <<<PROMPT
        You are an object-recognition assistant for a "remember where I put things" app. {$task}
        Return title, description, location_text, additional_items, confidence, and transcript as strict JSON. Write title, description, location_text, and additional item titles in locale "{$input->locale}". Title must contain 2-4 words. Description must be one sentence describing color, type, or another distinguishing detail. Return an empty location_text when the media provides no clear location context. Confidence describes confidence in title from 0 to 1. For photo input transcript must be null. If nothing is clearly identifiable, return a generic title such as "Unknown item" with confidence below 0.3 instead of failing. Never invent a location. For voice input, transcript must preserve the spoken words and their original language rather than translating them.
        PROMPT;
    }

    /**
     * @return array<string, mixed>
     */
    private function responseSchema(): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => [
                'title' => ['type' => 'string'],
                'description' => ['type' => 'string'],
                'location_text' => ['type' => 'string'],
                'additional_items' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'properties' => [
                            'title' => ['type' => 'string'],
                        ],
                        'required' => ['title'],
                    ],
                    'maxItems' => 8,
                ],
                'transcript' => ['type' => ['string', 'null']],
                'confidence' => [
                    'type' => 'number',
                    'minimum' => 0,
                    'maximum' => 1,
                ],
            ],
            'required' => [
                'title',
                'description',
                'location_text',
                'additional_items',
                'transcript',
                'confidence',
            ],
        ];
    }

    private function normalize(mixed $data, RecognitionSource $source): RecognitionResult
    {
        if (! is_array($data)) {
            throw new RecognitionProviderException('Gemini result does not match the expected schema.');
        }

        $transcript = $source === RecognitionSource::Voice && is_string($data['transcript'] ?? null)
            ? trim($data['transcript'])
            : null;

        $additionalItems = array_values(array_unique(array_slice(array_map(
            fn (array $item): string => trim($item['title']),
            array_filter(
                is_array($data['additional_items'] ?? null) ? $data['additional_items'] : [],
                fn (mixed $item): bool => is_array($item)
                    && is_string($item['title'] ?? null)
                    && trim($item['title']) !== '',
            ),
        ), 0, 8)));

        $confidence = is_numeric($data['confidence'] ?? null)
            ? max(0.0, min(1.0, (float) $data['confidence']))
            : 0.0;
        $title = is_string($data['title'] ?? null) ? trim($data['title']) : '';

        if ($title === '') {
            $title = 'Unknown item';
            $confidence = min($confidence, 0.29);
        }

        return new RecognitionResult(
            title: $title,
            locationText: is_string($data['location_text'] ?? null) ? trim($data['location_text']) : '',
            tags: $additionalItems,
            transcript: $transcript,
            confidence: $confidence,
            description: is_string($data['description'] ?? null) ? trim($data['description']) : '',
            additionalItems: $additionalItems,
        );
    }
}
