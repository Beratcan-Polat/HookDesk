<?php

return [
    'required' => ':attribute alanı zorunludur.', 'string' => ':attribute metin olmalıdır.', 'email' => ':attribute geçerli bir e-posta adresi olmalıdır.',
    'unique' => ':attribute daha önce kullanılmış.', 'confirmed' => ':attribute doğrulaması eşleşmiyor.', 'in' => ':attribute seçimi geçersiz.',
    'boolean' => ':attribute doğru veya yanlış olmalıdır.', 'integer' => ':attribute tam sayı olmalıdır.', 'array' => ':attribute bir dizi olmalıdır.',
    'present' => ':attribute alanı bulunmalıdır.', 'regex' => ':attribute biçimi geçersiz.', 'prohibited' => ':attribute alanına izin verilmiyor.',
    'required_if' => ':other alanı :value olduğunda :attribute zorunludur.', 'exists' => ':attribute kaydı bulunamadı.',
    'current_password' => 'Mevcut parola doğru değil.', 'date' => ':attribute geçerli bir tarih olmalıdır.', 'after_or_equal' => ':attribute, :date tarihinden önce olamaz.',
    'max' => ['string' => ':attribute en fazla :max karakter olabilir.', 'array' => ':attribute en fazla :max öğe içerebilir.', 'numeric' => ':attribute en fazla :max olabilir.'],
    'min' => ['string' => ':attribute en az :min karakter olmalıdır.', 'array' => ':attribute en az :min öğe içermelidir.', 'numeric' => ':attribute en az :min olabilir.'],
    'password' => ['letters' => ':attribute en az bir harf içermelidir.', 'numbers' => ':attribute en az bir sayı içermelidir.'],
    'attributes' => ['name' => 'Ad', 'email' => 'E-posta', 'password' => 'Parola', 'reason' => 'Gerekçe', 'code' => 'Doğrulama kodu'],
];
