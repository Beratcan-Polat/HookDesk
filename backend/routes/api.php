<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\CredentialController;
use App\Http\Controllers\EndpointController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ReadinessController;
use App\Http\Controllers\SupportController;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::get('ready', ReadinessController::class)->middleware('throttle:60,1');

Route::prefix('v1')->middleware('project_key')->group(function () {
    Route::post('events', [EventController::class, 'accept']);
    Route::get('events/{event}', [EventController::class, 'show']);
    Route::get('events/{event}/deliveries', [EventController::class, 'deliveries']);
});
Route::get('me', [AccountController::class, 'me'])->middleware('auth:sanctum');
Route::middleware(['auth:sanctum', 'verified', 'audit_mutation'])->prefix('dashboard/v1')->name('dashboard.')->group(function () {
    Route::patch('profile', [AccountController::class, 'profile'])->name('profile');
    Route::delete('account', [AccountController::class, 'delete'])->name('account.delete');
    Route::post('invitations/accept', [WorkspaceController::class, 'acceptInvite'])->name('invitation.accept');
    Route::post('workspaces', [WorkspaceController::class, 'store'])->name('workspace.create');
    Route::patch('workspaces/{workspace}', [WorkspaceController::class, 'update'])->name('workspace.update');
    Route::post('workspaces/{workspace}/archive', [WorkspaceController::class, 'archive'])->name('workspace.archive');
    Route::post('workspaces/{workspace}/transfer', [WorkspaceController::class, 'transfer'])->name('workspace.transfer');
    Route::post('workspaces/{workspace}/leave', [WorkspaceController::class, 'leave'])->name('workspace.leave');
    Route::get('workspaces/{workspace}/team', [WorkspaceController::class, 'team']);
    Route::post('workspaces/{workspace}/invitations', [WorkspaceController::class, 'invite'])->name('invitation.create');
    Route::delete('workspaces/{workspace}/invitations/{invitation}', [WorkspaceController::class, 'revokeInvite'])->name('invitation.revoke');
    Route::patch('workspaces/{workspace}/members/{membership}', [WorkspaceController::class, 'member'])->name('member.update');
    Route::delete('workspaces/{workspace}/members/{membership}', [WorkspaceController::class, 'removeMember'])->name('member.remove');
    Route::get('workspaces/{workspace}/audit', [WorkspaceController::class, 'audit']);
    Route::get('projects/{project}/keys', [CredentialController::class, 'keys']);
    Route::post('projects/{project}/keys', [CredentialController::class, 'createKey'])->name('key.create');
    Route::delete('keys/{key}', [CredentialController::class, 'revokeKey'])->name('key.revoke');
    Route::post('endpoints/{endpoint}/rotate-secret', [EndpointController::class, 'rotate'])->name('endpoint.rotate');
    Route::post('sources/{source}/rotate', [CredentialController::class, 'rotateSource'])->name('source.rotate');
});

$productRoutes = function () {
    Route::get('workspaces', [WorkspaceController::class, 'index']);
    Route::get('workspaces/{workspace}/summary', [WorkspaceController::class, 'summary']);
    Route::post('workspaces/{workspace}/projects', [ProjectController::class, 'store'])->name('project.create');
    Route::patch('projects/{project}', [ProjectController::class, 'update'])->name('project.update');
    Route::post('projects/{project}/archive', [ProjectController::class, 'archive'])->name('project.archive');
    Route::get('projects/{project}/endpoints', [EndpointController::class, 'index']);
    Route::post('projects/{project}/endpoints', [EndpointController::class, 'store'])->name('endpoint.create');
    Route::patch('endpoints/{endpoint}', [EndpointController::class, 'update'])->name('endpoint.update');
    Route::get('projects/{project}/sources', [CredentialController::class, 'sources']);
    Route::post('projects/{project}/sources', [CredentialController::class, 'createSource'])->name('source.create');
    Route::patch('sources/{source}', [CredentialController::class, 'updateSource'])->name('source.update');
    Route::get('projects/{project}/events', [EventController::class, 'index']);
    Route::post('projects/{project}/test', [EventController::class, 'test'])->name('event.test');
    Route::get('events/{event}', [EventController::class, 'show']);
    Route::get('events/{event}/payload', [EventController::class, 'payload']);
    Route::get('deliveries/{delivery}', [EventController::class, 'delivery']);
    Route::get('attempts/{attempt}/response', [EventController::class, 'attemptBody']);
    Route::post('deliveries/{delivery}/replay', [EventController::class, 'replay'])->name('delivery.replay');
};
Route::middleware(['auth:sanctum', 'verified', 'audit_mutation'])->prefix('dashboard/v1')->name('dashboard.')->group($productRoutes);
Route::middleware(['auth:sanctum', 'super_admin', 'support_context', 'audit_mutation'])->prefix('support/v1/sessions/{supportSession}')->name('support.')->group($productRoutes);

Route::middleware(['auth:sanctum', 'super_admin'])->prefix('admin/v1')->name('admin.')->group(function () {
    Route::post('step-up', [AdminController::class, 'stepUp'])->middleware('throttle:5,1');
    Route::middleware(['admin_mutation', 'audit_mutation'])->group(function () {
        Route::get('overview', [AdminController::class, 'overview']);
        Route::get('users', [AdminController::class, 'users']);
        Route::get('users/{user}', [AdminController::class, 'user']);
        Route::patch('users/{user}', [AdminController::class, 'updateUser'])->name('user.update');
        Route::post('users/{user}/actions', [AdminController::class, 'userAction'])->name('user.action');
        Route::get('workspaces', [AdminController::class, 'workspaces']);
        Route::get('workspaces/{workspace}', [AdminController::class, 'workspace']);
        Route::post('workspaces/{workspace}/actions', [AdminController::class, 'workspaceAction'])->name('workspace.action');
        Route::put('workspaces/{workspace}/limits', [AdminController::class, 'limit'])->name('workspace.limit');
        Route::get('projects', [AdminController::class, 'projects']);
        Route::get('projects/{project}', [AdminController::class, 'project']);
        Route::patch('workspaces/{workspace}/members/{membership}', [AdminController::class, 'member'])->name('member.update');
        Route::delete('workspaces/{workspace}/members/{membership}', [AdminController::class, 'removeMember'])->name('member.remove');
        Route::delete('workspaces/{workspace}/invitations/{invitation}', [AdminController::class, 'revokeInvitation'])->name('invitation.revoke');
        Route::post('projects/{project}/actions', [AdminController::class, 'projectAction'])->name('project.action');
        Route::delete('keys/{key}', [AdminController::class, 'revokeKey'])->name('key.revoke');
        Route::post('sources/{source}/actions', [AdminController::class, 'sourceAction'])->name('source.action');
        Route::patch('endpoints/{endpoint}', [AdminController::class, 'endpointAction'])->name('endpoint.action');
        Route::get('events', [AdminController::class, 'events']);
        Route::post('events/{event}/payload', [AdminController::class, 'payload'])->name('payload.read');
        Route::post('attempts/{attempt}/response', [AdminController::class, 'attemptPayload'])->name('response.read');
        Route::get('deliveries', [AdminController::class, 'deliveries']);
        Route::get('deliveries/{delivery}', [AdminController::class, 'delivery']);
        Route::post('deliveries/replay', [AdminController::class, 'replay'])->name('delivery.replay');
        Route::get('settings', [AdminController::class, 'settings']);
        Route::put('settings', [AdminController::class, 'updateSettings'])->name('setting.update');
        Route::get('audit', [AdminController::class, 'audit']);
        Route::get('health', [AdminController::class, 'health']);
        Route::get('support-sessions', [SupportController::class, 'index']);
        Route::post('support-sessions', [SupportController::class, 'store'])->name('support.create');
    });
    Route::delete('support-sessions/{supportSession}', [SupportController::class, 'destroy'])->middleware('audit_mutation')->name('support.end');
});
