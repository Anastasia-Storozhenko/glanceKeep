<?php

namespace App\Data;

final readonly class RecognitionResult
{
    /**
     * @param  list<string>  $tags
     */
    public function __construct(
        public string $title,
        public string $locationText,
        public array $tags,
        public ?string $transcript,
        public float $confidence,
        public string $description = '',
        public array $additionalItems = [],
    ) {}

    public static function unrecognized(): self
    {
        return new self('', '', [], null, 0.0, '', []);
    }

    public function isRecognized(): bool
    {
        return $this->title !== ''
            || $this->locationText !== ''
            || ($this->transcript !== null && $this->transcript !== '');
    }

    /**
     * @return array{title: string, description: string, location_text: string, additional_items: list<array{title: string}>, tags: list<string>, transcript: ?string, confidence: float}
     */
    public function toArray(): array
    {
        return [
            'title' => $this->title,
            'description' => $this->description,
            'location_text' => $this->locationText,
            'additional_items' => array_map(
                fn (string $title): array => ['title' => $title],
                $this->additionalItems,
            ),
            'tags' => $this->tags,
            'transcript' => $this->transcript,
            'confidence' => $this->confidence,
        ];
    }
}
