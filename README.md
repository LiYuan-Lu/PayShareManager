# Pay Share Manager

This is a web application designed to record who paid what amount and to calculate how to evenly split the bill.

The project is built with React and is based on code from the [React Router Address Book Tutorial](https://reactrouter.com/tutorials/address-book).

## Features
- **Payment Records:** Add, edit, and delete payment entries with payer names and amounts inside event.
- **Even Split Calculation:** Automatically computes the average amount each person should contribute.
- **React Router:** Implements multi-page routing with React Router.
- **Intuitive Interface:** A clean and user-friendly design.

## Development(dev)

From your terminal:

```sh
npm run dev
```

This starts app in development mode, rebuilding assets on file changes.

## Deployment(release)

First, build app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

## Docker / NAS testing

Build and start the app with Docker Compose:

```sh
docker compose up -d --build
```

The app will listen on port `3000` by default. To use another host port, copy
`.env.example` to `.env` and change `PAYSHARE_PORT`.

Set the initial admin account in `.env`:

```text
PAYSHARE_ADMIN_EMAIL=you@example.com
PAYSHARE_ADMIN_PASSWORD=use-a-long-password
PAYSHARE_COOKIE_SECURE=true
```

When the container starts, the app creates this account as admin if it does not
exist. If the email already exists, it is promoted to admin and the password is
updated from `PAYSHARE_ADMIN_PASSWORD`. The password must be at least 8
characters. When both admin variables are set, the built-in demo account is not
created and any existing demo account is removed.

If no admin variables are set, the built-in demo admin is available for local
testing:

```text
demo@payshare.local / password123
```

After signing in as admin, open `/admin` to create invite codes or generate
manual password reset links.

For public HTTPS deployments, keep `PAYSHARE_COOKIE_SECURE=true` so session
cookies are only sent over HTTPS. If you run the container directly over plain
HTTP for local testing, set `PAYSHARE_COOKIE_SECURE=false`.

SQLite data is stored at:

```text
./data/payshare.db
```

The compose file mounts `./data` into the container, so the database survives
container rebuilds and restarts.

Stop the app:

```sh
docker compose down
```
