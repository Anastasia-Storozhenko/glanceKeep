<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class RecognizeRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'device_id' => $this->header('X-Device-Id'),
            'idempotency_key' => $this->header('Idempotency-Key'),
        ]);
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $source = $this->input('source');
        $maximumKilobytes = in_array($source, ['photo', 'voice'], true)
            ? (int) config("recognition.max_size_kilobytes.{$source}")
            : max(config('recognition.max_size_kilobytes'));

        return [
            'device_id' => ['required', 'uuid'],
            'idempotency_key' => ['nullable', 'string', 'max:128', 'regex:/^[A-Za-z0-9._:-]+$/'],
            'source' => ['required', 'string', Rule::in(['photo', 'voice'])],
            's3_key' => ['nullable', 'string', 'max:255', 'required_without:media', 'prohibits:media'],
            'media' => [
                'nullable',
                'required_without:s3_key',
                'prohibits:s3_key',
                'file',
                'max:'.$maximumKilobytes,
            ],
            'locale' => ['sometimes', 'string', 'max:16', 'regex:/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $source = $this->input('source');
                $media = $this->file('media');

                if ($media !== null && ! config('recognition.allow_multipart_uploads')) {
                    $validator->errors()->add('media', 'Direct media uploads are no longer supported.');
                }

                $key = $this->input('s3_key');
                $deviceId = $this->input('device_id');

                if (is_string($key) && is_string($deviceId)) {
                    $prefix = trim((string) config('recognition.transit.key_prefix'), '/');
                    $ownedKeyPattern = sprintf(
                        '#^%s/%s/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$#i',
                        preg_quote($prefix, '#'),
                        preg_quote($deviceId, '#'),
                    );

                    if (preg_match($ownedKeyPattern, $key) !== 1) {
                        $validator->errors()->add('s3_key', 'The uploaded media does not belong to this device.');
                    }
                }

                if (! in_array($source, ['photo', 'voice'], true) || $media === null || ! $media->isValid()) {
                    return;
                }

                $mimeType = $media->getMimeType();
                $allowedMimeTypes = config("recognition.allowed_mime_types.{$source}", []);

                if ($mimeType === null || ! in_array($mimeType, $allowedMimeTypes, true)) {
                    $validator->errors()->add('media', "The media type is not supported for {$source} recognition.");
                }

            },
        ];
    }
}
