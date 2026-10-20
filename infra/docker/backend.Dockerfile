FROM php:8.4-fpm-bookworm AS base
RUN apt-get update && apt-get install -y --no-install-recommends git unzip libpq-dev libonig-dev libzip-dev \
    && docker-php-ext-install pdo_pgsql mbstring bcmath pcntl zip opcache \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /srv/backend
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --no-progress
COPY backend/ ./
RUN composer dump-autoload --optimize --no-dev && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache
COPY infra/docker/php.ini /usr/local/etc/php/conf.d/hookdesk.ini
USER www-data
EXPOSE 9000
CMD ["php-fpm"]

FROM base AS development
USER root
RUN composer install --no-interaction --prefer-dist --no-progress
USER www-data
