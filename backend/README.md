# GlanceKeep Backend

API-only Laravel service for the GlanceKeep mobile application. The service will
proxy recognition requests to Gemini, so the Gemini API key never ships in the
mobile client.

## Requirements

- PHP 8.2+
- Composer 2
- MySQL 8+

## Local setup

```bash
composer setup
composer dev
```

The API is available at `http://127.0.0.1:8000/api/v1`. Check it with:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

Run the test suite with:

```bash
composer test
```

## Environment

Copy `.env.example` to `.env` and generate an application key. Secrets must be
provided through environment variables and must never be committed.

| Variable | Purpose |
| --- | --- |
| `APP_KEY` | Laravel encryption key |
| `GEMINI_API_KEY` | Server-side Gemini credential |
| `GEMINI_MODEL` | Pinned recognition model |
| `GEMINI_BASE_URL` | Gemini API base URL |
| `GEMINI_TIMEOUT_SECONDS` | Provider request timeout; defaults to 10 seconds |
| `GEMINI_CONNECT_TIMEOUT_SECONDS` | Provider connection timeout; defaults to 3 seconds |
| `RECOGNITION_TRANSIT_DISK` | Private S3 disk used only while recognition is in flight |
| `RECOGNITION_TRANSIT_KEY_PREFIX` | Device-scoped prefix for transient objects |
| `RECOGNITION_PRESIGN_TTL_SECONDS` | Presigned PUT lifetime; defaults to 5 minutes |
| `RECOGNITION_IDEMPOTENCY_TTL_SECONDS` | How long completed recognition responses can be replayed safely |
| `RECOGNITION_IDEMPOTENCY_LOCK_SECONDS` | Lock lifetime preventing concurrent duplicate recognition |
| `RECOGNITION_ALLOW_MULTIPART_UPLOADS` | Temporary compatibility flag for older clients |
| `RECOGNITION_PHOTO_MAX_KB` | Maximum photo upload size |
| `RECOGNITION_VOICE_MAX_KB` | Maximum voice upload size |
| `FREE_PHOTO_RECOGNITIONS_PER_MONTH` | Monthly anonymous-device photo limit; defaults to 20 |

## Recognition API

The current v1.3 flow keeps raw media in a private S3 bucket only while one
recognition request is in flight. The `X-Device-Id` header is required on both
API calls and must contain the UUID generated and persisted by the mobile
client.

First request a short-lived presigned PUT URL:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/uploads/presign \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'X-Device-Id: 550e8400-e29b-41d4-a716-446655440000' \
  -d '{"source":"photo","content_type":"image/jpeg","content_length":204800}'
```

Upload the exact bytes to the returned `upload_url` using every returned header,
then call recognition with the returned key:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/recognize \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'X-Device-Id: 550e8400-e29b-41d4-a716-446655440000' \
  -d '{"source":"photo","locale":"en","s3_key":"recognition/550e8400-e29b-41d4-a716-446655440000/...jpg"}'
```

The backend verifies the device-scoped key, downloads the object privately,
forwards it to Gemini, and deletes it in a `finally` block. No presigned GET URL
is returned to the client. Configure an S3 lifecycle rule as an additional
cleanup safeguard for abandoned uploads.

Clients should send a stable `Idempotency-Key` header for all attempts belonging
to one logical recognition. Replays return the cached response without another
Gemini call, quota increment, or S3 read.

The endpoint returns `status=recognized` with title, description, location,
additional items mapped to tags, confidence, and a transcript for voice input.
Provider errors return HTTP 200 with `status=unrecognized`, allowing the mobile
client to continue with editable fallback fields. Invalid input returns HTTP
422.

Direct multipart upload is disabled by default. It remains available only as a
temporary rollout bridge when `RECOGNITION_ALLOW_MULTIPART_UPLOADS=true` is set
explicitly. Disable it after released clients use the presigned flow.

The bucket must have all public access blocked. The backend identity only needs
`s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` for the configured key
prefix. Add a short lifecycle expiration rule as a fallback for presigned
uploads that are never submitted to `/recognize`.

Photo recognition is limited to 20 requests per anonymous device per UTC
calendar month by default. The server response includes `usage.used`,
`usage.limit`, and `usage.resets_at`. Voice requests do not consume this quota.
When the quota is exhausted, the server does not call Gemini and responds with
HTTP 429 and `code=monthly_limit_reached`. The server-side counter is the source
of truth; a client-side counter may only be used to display usage in the UI.

## Deployment target

The selected target is **Google Cloud Run** in a region close to the first user
cohort. It provides managed HTTPS and fits the stateless API-proxy architecture.
Production secrets are supplied from Google Secret Manager; they are not baked
into the image or passed as build arguments.

Production must use a shared persistent MySQL database, such as MySQL on Cloud
SQL, for usage counters. Do not use a container-local SQLite file in Cloud Run:
its filesystem is ephemeral and is not shared between instances. Configure
Laravel with `DB_CONNECTION=mysql` and the corresponding `DB_*` environment
variables, then run `php artisan migrate --force` as a deployment step.

Build the same container locally:

```bash
docker build -t glancekeep-api .
docker run --rm -p 8080:8080 --env-file .env glancekeep-api
```

Cloud Run should use `/api/v1/health` as its startup and liveness probe. For the
latency-sensitive recognition path, configure at least one minimum instance once
the endpoint is implemented and benchmarked. Deployment automation belongs in a
follow-up infrastructure ticket.
