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

Route::get('me', [AccountController::class, 'me'])->middleware('auth:sanctum');
Route::middleware(['auth:sanctum', 'verified', 'audit_mutation'])->prefix('dashboard/v1')->name('dashboard.')->group(function () {
    Route::patch('profile', [AccountController::class, 'profile'])->name('profile');
    Route::delete('account', [AccountController::class, 'delete'])->name('account.delete');
    Route::post('workspaces', [WorkspaceController::class, 'store'])->name('workspace.create');
    Route::patch('workspaces/{workspace}', [WorkspaceController::class, 'update'])->name('workspace.update');
    Route::post('workspaces/{workspace}/archive', [WorkspaceController::class, 'archive'])->name('workspace.archive');
    Route::get('workspaces/{workspace}/audit', [WorkspaceController::class, 'audit']);
});

$productRoutes = function () {
    Route::get('workspaces', [WorkspaceController::class, 'index']);
    Route::get('workspaces/{workspace}/summary', [WorkspaceController::class, 'summary']);
    Route::post('workspaces/{workspace}/projects', [ProjectController::class, 'store'])->name('project.create');
    Route::patch('projects/{project}', [ProjectController::class, 'update'])->name('project.update');
    Route::post('projects/{project}/archive', [ProjectController::class, 'archive'])->name('project.archive');
};
Route::middleware(['auth:sanctum', 'verified', 'audit_mutation'])->prefix('dashboard/v1')->name('dashboard.')->group($productRoutes);
