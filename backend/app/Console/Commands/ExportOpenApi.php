<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;

class ExportOpenApi extends Command
{
    protected $signature = 'hookdesk:openapi';

    protected $description = 'Export the actual versioned routes and request contracts';

    public function handle(): int
    {
        $object = fn (array $properties, array $required = []) => ['type' => 'object', 'properties' => $properties, ...($required ? ['required' => $required] : [])];
        $string = ['type' => 'string'];
        $boolean = ['type' => 'boolean'];
        $reason = ['type' => 'string', 'minLength' => 5, 'maxLength' => 1000];
        $schemas = [
            'AcceptEvent' => $object(['type' => ['type' => 'string', 'maxLength' => 100, 'pattern' => '^[a-zA-Z0-9_.-]+$'], 'data' => ['type' => 'object', 'additionalProperties' => true]], ['type', 'data']),
            'Workspace' => $object(['name' => ['type' => 'string', 'maxLength' => 100]], ['name']),
            'Project' => $object(['name' => $string, 'description' => ['type' => ['string', 'null']]], ['name']),
            'Endpoint' => $object(['name' => $string, 'kind' => ['enum' => ['https', 'sandbox']], 'url' => ['type' => ['string', 'null'], 'format' => 'uri'], 'sandbox_behavior' => ['enum' => ['success', 'fail_twice', 'always_fail', 'timeout']], 'subscriptions' => ['type' => 'array', 'minItems' => 1, 'items' => ['type' => 'string', 'maxLength' => 100]]], ['name', 'kind', 'subscriptions']),
            'Source' => $object(['name' => $string, 'event_type' => ['type' => 'string', 'maxLength' => 100], 'mode' => ['enum' => ['capture_only', 'capture_and_forward']], 'enabled' => $boolean], ['name', 'event_type', 'mode']),
            'Key' => $object(['name' => $string, 'abilities' => ['type' => 'array', 'items' => ['enum' => ['events:read', 'events:write']]]], ['name', 'abilities']),
            'Invitation' => $object(['email' => ['type' => 'string', 'format' => 'email'], 'role' => ['enum' => ['admin', 'developer', 'viewer']]], ['email', 'role']),
            'StepUp' => $object(['password' => $string, 'code' => $string], ['password', 'code']),
            'Reason' => $object(['reason' => $reason], ['reason']),
            'UserChange' => $object(['name' => $string, 'status' => ['enum' => ['active', 'suspended']], 'platform_role' => ['enum' => ['user', 'super_admin']], 'reason' => $reason], ['reason']),
            'SupportSession' => $object(['user_id' => $string, 'workspace_id' => $string, 'reason' => $reason], ['user_id', 'workspace_id', 'reason']),
            'Limit' => $object(['key' => $string, 'value' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 1000000], 'reason' => $reason], ['key', 'value', 'reason']),
            'Setting' => $object(['key' => $string, 'value' => ['type' => ['boolean', 'integer']], 'reason' => $reason], ['key', 'value', 'reason']),
            'AdminAction' => $object(['action' => $string, 'user_id' => $string, 'email' => ['type' => 'string', 'format' => 'email'], 'reason' => $reason], ['action', 'reason']),
            'BulkReplay' => $object(['delivery_ids' => ['type' => 'array', 'minItems' => 1, 'maxItems' => 100, 'items' => $string], 'reason' => $reason], ['delivery_ids', 'reason']),
            'Error' => $object(['message' => $string, 'errors' => ['type' => 'object', 'additionalProperties' => ['type' => 'array', 'items' => $string]]]),
        ];
        $paths = [];
        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();
            if (! str_starts_with($uri, 'api/') && ! str_starts_with($uri, 'ingest/')) {
                continue;
            }
            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $isAdmin = str_starts_with($uri, 'api/admin/');
                $public = str_starts_with($uri, 'api/v1/');
                $operation = ['operationId' => str_replace(['/', '{', '}', '-'], ['_', '', '', '_'], strtolower($method).'_'.$uri),
                    'summary' => $route->getActionMethod(), 'tags' => [$isAdmin ? 'Administration' : ($public ? 'Events' : (str_starts_with($uri, 'ingest/') ? 'Sources' : (str_contains($uri, 'support/') ? 'Support' : 'Dashboard')))],
                    'security' => [$public ? ['projectKey' => []] : ['sessionCookie' => []]],
                    'responses' => ['200' => ['description' => 'Successful operation; data is wrapped in a data field unless otherwise documented.'], '401' => ['description' => 'Authentication required'], '403' => ['description' => 'Permission, verification or account state denied'], '404' => ['description' => 'Resource not found'], '422' => ['description' => 'Validation failed'], '429' => ['description' => 'Rate or daily quota exceeded']]];
                $parameters = [];
                preg_match_all('/\\{([^}]+)\\}/', $uri, $matches);
                foreach ($matches[1] as $name) {
                    $parameters[] = ['name' => $name, 'in' => 'path', 'required' => true, 'schema' => $string];
                }
                if ($public && $method === 'POST' || str_starts_with($uri, 'ingest/')) {
                    $parameters[] = ['name' => 'Idempotency-Key', 'in' => 'header', 'schema' => ['type' => 'string', 'maxLength' => 200], 'description' => '24-hour project/producer scoped exact-body deduplication.'];
                }
                if ($method === 'GET' && ! preg_match('/\\{[^}]+\\}$/', $uri)) {
                    foreach (['page', 'per_page', 'search', 'type', 'status', 'from', 'to', 'project_id', 'workspace_id'] as $name) {
                        $parameters[] = ['name' => $name, 'in' => 'query', 'schema' => $string];
                    }
                }
                if ($parameters) {
                    $operation['parameters'] = $parameters;
                }
                if (! in_array($method, ['GET', 'HEAD'], true)) {
                    $action = $route->getActionMethod();
                    $schema = match (true) {
                        in_array($action, ['accept', 'test'], true) => 'AcceptEvent',
                        $action === 'stepUp' => 'StepUp',
                        str_contains($uri, 'support-sessions') && $method === 'POST' => 'SupportSession',
                        $action === 'updateUser' => 'UserChange',
                        $action === 'limit' => 'Limit',
                        $action === 'updateSettings' => 'Setting',
                        $isAdmin && $action === 'replay' => 'BulkReplay',
                        $isAdmin && str_ends_with($action, 'Action') => 'AdminAction',
                        $isAdmin => 'Reason',
                        str_contains($uri, 'invitations') && $action === 'invite' => 'Invitation',
                        $action === 'createKey' => 'Key',
                        in_array($action, ['createSource', 'updateSource'], true) => 'Source',
                        str_contains($uri, 'endpoints') && in_array($action, ['store', 'update'], true) => 'Endpoint',
                        str_contains($uri, 'projects') && in_array($action, ['store', 'update'], true) => 'Project',
                        str_contains($uri, 'workspaces') && in_array($action, ['store', 'update'], true) => 'Workspace',
                        default => null,
                    };
                    $body = $schema ? ['$ref' => '#/components/schemas/'.$schema] : $object([], []);
                    if ($action === 'ingest') {
                        $body = ['type' => 'object', 'additionalProperties' => true];
                    }
                    $operation['requestBody'] = ['required' => true, 'content' => ['application/json' => ['schema' => $body]]];
                    $operation['responses']['201'] = ['description' => 'Resource created. Credentials are only returned once where applicable.'];
                    $operation['responses']['202'] = ['description' => 'Event persisted or replay accepted. Delivery is asynchronous.'];
                    $operation['responses']['204'] = ['description' => 'Operation completed without a response body.'];
                    if ($isAdmin && $action !== 'stepUp') {
                        $operation['responses']['423'] = ['description' => 'Password and TOTP step-up required within five minutes.'];
                    }
                }
                if (str_starts_with($uri, 'ingest/')) {
                    $operation['security'] = [];
                }
                $paths['/'.$uri][strtolower($method)] = $operation;
            }
        }
        $document = ['openapi' => '3.1.0', 'info' => ['title' => 'HookDesk API', 'version' => '1.0.0', 'description' => 'At-least-once webhook delivery. No ordering guarantee. Dashboard/admin use CSRF-protected session cookies; external events use project-scoped bearer keys.'],
            'servers' => [['url' => '/']], 'paths' => $paths, 'components' => ['securitySchemes' => ['projectKey' => ['type' => 'http', 'scheme' => 'bearer'], 'sessionCookie' => ['type' => 'apiKey', 'in' => 'cookie', 'name' => 'hookdesk_session']], 'schemas' => $schemas]];
        $json = json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        foreach ([base_path('../docs/api/openapi.json'), base_path('../frontend/public/openapi.json')] as $path) {
            if (! is_dir(dirname($path))) {
                mkdir(dirname($path),0755,true);
            }file_put_contents($path,$json."\n");
        }
        $this->info('OpenAPI exported from '.count($paths).' routes.');

        return self::SUCCESS;
    }
}
