FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --prefer-dist

COPY . .
RUN composer dump-autoload \
    --no-dev \
    --classmap-authoritative \
    --no-interaction

FROM php:8.2-cli-alpine

WORKDIR /app

RUN docker-php-ext-install pdo_mysql

COPY docker/php.ini /usr/local/etc/php/conf.d/glancekeep.ini
COPY --from=vendor --chown=www-data:www-data /app /app

USER www-data

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT}"]
