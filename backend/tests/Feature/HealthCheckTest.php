<?php

namespace Tests\Feature;

use Tests\TestCase;

final class HealthCheckTest extends TestCase
{
    public function test_health_check_returns_service_status(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'service' => 'GlanceKeep API',
            ])
            ->assertJsonStructure(['status', 'service', 'timestamp']);
    }

    public function test_unknown_api_route_returns_json(): void
    {
        $this->get('/api/v1/missing')
            ->assertNotFound()
            ->assertHeader('content-type', 'application/json');
    }
}
