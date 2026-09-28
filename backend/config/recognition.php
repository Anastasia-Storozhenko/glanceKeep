<?php

return [
    'provider' => env('RECOGNITION_PROVIDER', 'gemini'),

    'allow_multipart_uploads' => env('RECOGNITION_ALLOW_MULTIPART_UPLOADS', false),

    'idempotency_ttl_seconds' => (int) env('RECOGNITION_IDEMPOTENCY_TTL_SECONDS', 86400),
    'idempotency_lock_seconds' => (int) env('RECOGNITION_IDEMPOTENCY_LOCK_SECONDS', 30),

    'transit' => [
        'disk' => env('RECOGNITION_TRANSIT_DISK', 'recognition_uploads'),
        'key_prefix' => env('RECOGNITION_TRANSIT_KEY_PREFIX', 'recognition'),
        'presign_ttl_seconds' => (int) env('RECOGNITION_PRESIGN_TTL_SECONDS', 300),
    ],

    'max_size_kilobytes' => [
        'photo' => (int) env('RECOGNITION_PHOTO_MAX_KB', 5120),
        'voice' => (int) env('RECOGNITION_VOICE_MAX_KB', 10240),
    ],

    'allowed_mime_types' => [
        'photo' => [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
        ],
        'voice' => [
            'audio/aac',
            'audio/flac',
            'audio/m4a',
            'audio/mp4',
            'audio/mpeg',
            'audio/ogg',
            'audio/wav',
            'audio/x-m4a',
            'audio/x-wav',
            'video/mp4',
        ],
    ],
];
