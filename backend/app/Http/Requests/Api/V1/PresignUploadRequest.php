<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class PresignUploadRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'device_id' => $this->header('X-Device-Id'),
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
        return [
            'device_id' => ['required', 'uuid'],
            'source' => ['required', 'string', Rule::in(['photo', 'voice'])],
            'content_type' => ['required', 'string', 'max:100'],
            'content_length' => ['required', 'integer', 'min:1'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $source = $this->input('source');

                if (! in_array($source, ['photo', 'voice'], true)) {
                    return;
                }

                $contentType = $this->input('content_type');
                $allowedMimeTypes = config("recognition.allowed_mime_types.{$source}", []);

                if (! is_string($contentType) || ! in_array($contentType, $allowedMimeTypes, true)) {
                    $validator->errors()->add(
                        'content_type',
                        "The content type is not supported for {$source} recognition.",
                    );
                }

                $contentLength = filter_var($this->input('content_length'), FILTER_VALIDATE_INT);
                $maximumBytes = (int) config("recognition.max_size_kilobytes.{$source}") * 1024;

                if ($contentLength !== false && $contentLength > $maximumBytes) {
                    $validator->errors()->add(
                        'content_length',
                        "The content length must not be greater than {$maximumBytes} bytes.",
                    );
                }
            },
        ];
    }
}
