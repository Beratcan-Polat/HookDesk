<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AcceptEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['type' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_.-]+$/'], 'data' => ['present', 'array']];
    }

    protected function prepareForValidation(): void
    {
        abort_unless($this->isJson(), 415, 'json_required');
        abort_if(strlen($this->getContent()) > config('hookdesk.max_body_bytes'), 413, 'payload_too_large');
        $raw = json_decode($this->getContent());
        abort_unless(is_object($raw) && isset($raw->data) && is_object($raw->data), 422, 'data_must_be_object');
        if ($this->hasHeader('Idempotency-Key')) {
            abort_if(strlen($this->header('Idempotency-Key')) > 200, 422, 'idempotency_key_too_long');
        }
    }
}
