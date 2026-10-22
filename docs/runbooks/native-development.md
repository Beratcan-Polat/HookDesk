# Development without Docker

Docker Compose is the default development environment. I kept the API and frontend independent so they can also run directly with local PostgreSQL and Redis services.

## Requirements

- PHP 8.4+ with cURL, mbstring, OpenSSL, PDO PostgreSQL, bcmath and zip.
- Composer and Node.js 24 with npm.
- PostgreSQL 18 and Redis 8.

## Configure the backend

From the project root:

```sh
cd backend
composer install
cp .env.example .env
```

Set the PostgreSQL and Redis connection values in `backend/.env`. The native defaults use `APP_URL` and `FRONTEND_URL` at `http://localhost:5173`, the API at `127.0.0.1:8000`, and `RECEIVER_URL=http://127.0.0.1:8001`.

Keep `QUEUE_CONNECTION=redis` and `CACHE_STORE=redis` to match the Docker environment. The database drivers can be used for lightweight local development, but Redis integration tests require a Redis instance.

After configuring the database:

```sh
php artisan key:generate
php artisan migrate
```

Use a separate database such as `hookdesk_test` for integration tests. Test configuration is described in the [testing guide](testing.md).

## Start the services

Run these commands in separate terminals from `backend`:

```sh
php -S 127.0.0.1:8000 -t public
```

```sh
php artisan queue:work redis --queue=deliveries,default --timeout=20 --tries=1 --sleep=1
```

```sh
php artisan schedule:work
```

The receiver uses the same application with a separate role. On Windows:

```powershell
$env:APP_ROLE = 'receiver'
php -S 127.0.0.1:8001 -t public
```

On Linux:

```sh
APP_ROLE=receiver php -S 127.0.0.1:8001 -t public
```

Start Vite from `frontend`:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open [localhost:5173](http://localhost:5173). Vite proxies API requests to port 8000.

## Windows helper scripts

Once database connections and PHP extensions are configured, application processes can also be managed from the project root:

```powershell
.\infra\scripts\start-native.ps1
.\infra\scripts\stop-native.ps1
```

The start script leaves existing listeners running and records the processes it starts. The stop script stops only those recorded processes.

## PostgreSQL driver errors

If Laravel reports `could not find driver (Connection: pgsql)`, check the PHP executable and configuration used by the terminal:

```sh
php --ini
php -r "print_r(PDO::getAvailableDrivers());"
```

The driver list must include `pgsql`. On Windows, enable this line in the loaded `php.ini`, with `extension_dir` pointing to the PHP installation's `ext` directory:

```ini
extension=pdo_pgsql
```

Restart `php artisan serve` after changing PHP extensions. PostgreSQL must also be running at the host and port configured in `backend/.env`; enabling a driver does not start the database server.

For manual startup, `php artisan serve` runs the backend on port 8000 and `npm run dev` runs the frontend on port 5173. Open [localhost:5173](http://localhost:5173) for the application. Port 8000 serves the API; its root returns service metadata.

## Email and sample data

Set SMTP values for a development mail server, or use `MAIL_MAILER=log` to read verification and reset links in the Laravel log. With Docker, Mailpit provides the email interface.

`php artisan hookdesk:demo` creates a sample account and workspace and prints the credentials. After changing worker code, run `php artisan queue:restart` and restart the worker process.
