<?php

namespace App\Http\Controllers;

use App\Actions\AcceptEvent;
use App\Actions\ReplayDelivery;
use App\Http\Requests\AcceptEventRequest;
use App\Http\Resources\EventResource;
use App\Models\Delivery;
use App\Models\DeliveryAttempt;
use App\Models\Event;
use App\Models\Project;
use App\Models\WebhookSource;
use App\Services\Access;
use App\Services\Audit;
use App\Services\Settings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class EventController extends Controller
{
    public function accept(AcceptEventRequest $r)
    {
        [$event,$replayed] = app(AcceptEvent::class)->execute($r->attributes->get('project'), $r->input('type'), json_decode($r->getContent())->data, $r->getContent(), $r->header('Idempotency-Key'));

        return response()->json(['data' => ['id' => $event->id, 'accepted_at' => $event->created_at, 'delivery_count' => $event->deliveries()->count(), 'routing_result' => $event->routing_result]], 202)->header('Idempotency-Replayed', $replayed ? 'true' : 'false');
    }

    public function ingest(Request $r, string $token)
    {
        $source = WebhookSource::where('token_hash', hash('sha256', $token))->where('enabled', true)->firstOrFail();
        abort_if($source->project->blocked(), 404);
        abort_unless($r->isJson(), 415, 'json_required');
        abort_if(strlen($r->getContent()) > config('hookdesk.max_body_bytes'), 413, 'payload_too_large');
        $data = json_decode($r->getContent());
        abort_unless(is_object($data), 422, 'json_object_required');
        $bucket = 'ingest:'.$source->project_id;
        $max = app(Settings::class)->limit('ingest_per_minute', $source->project->workspace);
        abort_if(RateLimiter::tooManyAttempts($bucket, $max), 429, 'rate_limit_reached', ['Retry-After' => (string) RateLimiter::availableIn($bucket)]);
        RateLimiter::hit($bucket, 60);
        [$event,$replayed] = app(AcceptEvent::class)->execute($source->project, $source->event_type, $data, $r->getContent(), $r->header('Idempotency-Key'), $source->id, $source->mode === 'capture_and_forward');

        return response()->json(['data' => ['id' => $event->id, 'delivery_count' => $event->deliveries()->count()]], 202)->header('Idempotency-Replayed', $replayed ? 'true' : 'false');
    }

    public function index(Request $r, Project $project)
    {
        app(Access::class)->project($project);

        return EventResource::collection($this->filters($r, Event::where('project_id', $project->id))->withCount('deliveries')->latest()->paginate($this->pageSize($r)));
    }

    public function filters(Request $r, $q)
    {
        $data = $r->validate(['type' => 'sometimes|string|max:100', 'producer' => 'sometimes|string|max:100', 'id' => 'sometimes|string|max:26', 'from' => 'sometimes|date', 'to' => 'sometimes|date|after_or_equal:from']);
        foreach (['type', 'producer', 'id'] as $field) {
            if (! empty($data[$field])) {
                $q->where($field, $data[$field]);
            }
        }
        if (! empty($data['from'])) {
            $q->where('created_at', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $q->where('created_at', '<=', $data['to']);
        }

        return $q;
    }

    public function show(Request $r, Event $event)
    {
        if ($project = $r->attributes->get('project')) {
            abort_unless($project->id === $event->project_id, 404);
        } else {
            app(Access::class)->project($event->project);
        }

        return ['data' => new EventResource($event->loadCount('deliveries')), 'deliveries' => $event->deliveries()->with('endpoint:id,name,kind')->latest()->get()];
    }

    public function payload(Event $event)
    {
        app(Access::class)->project($event->project);
        app(Audit::class)->record('event.payload_viewed', $event, workspaceId: $event->project->workspace_id);

        return response()->json(['data' => json_decode($event->body)])->header('Cache-Control', 'no-store');
    }

    public function deliveries(Request $r, Event $event)
    {
        $p = $r->attributes->get('project');
        abort_unless($p && $p->id === $event->project_id, 404);

        return ['data' => $event->deliveries()->latest()->get()];
    }

    public function delivery(Delivery $delivery)
    {
        app(Access::class)->project($delivery->event->project);
        $body = ['data' => $delivery->load(['attempts', 'endpoint:id,name,kind', 'event'])];

        return response()->json($body)->header('Cache-Control', 'no-store');
    }

    public function attemptBody(DeliveryAttempt $attempt)
    {
        $d = Delivery::findOrFail($attempt->delivery_id);
        app(Access::class)->project($d->event->project);
        app(Audit::class)->record('attempt.response_viewed', $attempt, workspaceId: $d->event->project->workspace_id);

        return response()->json(['body' => $attempt->response_body, 'truncated' => $attempt->response_truncated])->header('Cache-Control', 'no-store');
    }

    public function replay(Delivery $delivery)
    {
        app(Access::class)->project($delivery->event->project, 'write');

        return response()->json(['data' => app(ReplayDelivery::class)->execute($delivery)], 202);
    }

    public function test(Request $r, Project $project)
    {
        app(Access::class)->project($project, 'write');
        $data = $r->validate(['type' => 'required|string|max:100|regex:/^[a-zA-Z0-9_.-]+$/', 'data' => 'present|array']);
        $object = json_decode($r->getContent())->data ?? null;
        abort_unless(is_object($object), 422, 'data_must_be_object');
        [$event] = app(AcceptEvent::class)->execute($project, $data['type'], $object, $r->getContent(), $r->header('Idempotency-Key'), 'dashboard');

        return response()->json(['data' => $event],202);
    }

    private function pageSize(Request $r): int
    {
        return min(100,max(1,(int) $r->input('per_page',25)));
    }
}
