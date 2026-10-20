<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WorkspaceInvitation extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $workspaceName, public string $token, public string $language = 'en') {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $tr = $this->language === 'tr';

        return (new MailMessage)->subject($tr ? 'HookDesk çalışma alanı daveti' : 'Your HookDesk workspace invitation')
            ->line(($tr ? 'Davet edildiğiniz çalışma alanı: ' : 'You have been invited to: ').$this->workspaceName)
            ->action($tr ? 'Daveti kabul et' : 'Accept invitation', config('hookdesk.frontend_url').'/invitations/'.$this->token)
            ->line($tr ? 'Bu davet 72 saat geçerlidir.' : 'This invitation expires in 72 hours.');
    }
}
