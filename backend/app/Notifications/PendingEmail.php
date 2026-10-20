<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PendingEmail extends Notification
{
    public function __construct(public string $url, public string $language) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $tr = $this->language === 'tr';

        return (new MailMessage)->subject($tr ? 'Yeni e-posta adresini doğrula' : 'Confirm your new email')
            ->line($tr ? 'Hesabınız için e-posta değişikliği istendi. Devam etmek için mevcut hesabınıza giriş yapın.' : 'An email change was requested. Sign in to your existing account to confirm.')
            ->action($tr ? 'Adresi doğrula' : 'Confirm address', $this->url);
    }
}
