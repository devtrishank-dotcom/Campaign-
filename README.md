# Campaign Admin — Bulk Email / WhatsApp / SMS + Voting Surveys

A full admin panel to manage contacts, run bulk campaigns over **Email, WhatsApp and SMS**, and collect
**voting / feedback survey** responses with open & click tracking.

All provider credentials are configured from the admin panel and stored **encrypted in MongoDB** — nothing is
hardcoded, so you can plug in any API you have.

## Tech stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth
- **Frontend:** React + Vite (admin panel)
- **Channels:** Email (SMTP / SendGrid / custom HTTP), WhatsApp (Meta Cloud API / Twilio / custom HTTP),
  SMS (Twilio / MSG91 / Fast2SMS / custom HTTP)

## Features

- **Super Admin + sub-users** with a **separate Roles module** — create/edit custom roles and assign them
- **Users import/export** — CSV & Excel (`.xlsx`), plus a downloadable example file
- **Contacts** with tags, custom fields and CSV import
- **Contact lists** for audience segmentation
- **Templates** with `{{variables}}`
- **Bulk campaigns** (Email / WhatsApp / SMS) with a background send queue, pause / resume / cancel
- **Scheduled campaigns** — auto-sent at the scheduled time by the built-in scheduler
- **Approval workflow** — users without `campaigns.approve` must get their campaign approved by an admin
- **Sending rules** — time window (e.g. 9am–9pm) + daily limit, with auto-pause and auto-resume
- **Retries** — failed sends retried automatically with backoff; manual "retry failed" + CSV export
- **Delivery webhooks** — Meta / Twilio / generic callbacks update `delivered` / `failed` status
- **Test send** — send a single test message before a bulk campaign
- **Surveys (feedback forms)** with a public page, attachable to campaigns as a tracked link
- **Tracking**: open pixel, click redirect, unsubscribe + email `List-Unsubscribe` header
- **Analytics**: delivery / open / click stats per campaign + audit logs
- **Provider settings**: add multiple providers per channel, activate one, test send, all encrypted
- **WhatsApp templates** — fetch approved templates from the Meta Cloud API

## Product presentation &amp; user guide

Two self-contained, printable pages are served by the frontend (also linked from the sidebar, opening in a new tab):

- **Product presentation** (with SVG diagrams): `http://localhost:5001/presentation.html`
- **User guide** (step-by-step instructions): `http://localhost:5001/guide.html`

Both have a **Print / PDF** button to export them.

## Project structure

```
election project/
  backend/
    src/
      config/        env + db
      models/        User, Contact, ContactList, Template, Campaign,
                     CampaignRecipient, ProviderSetting, Survey,
                     SurveyResponse, TrackingEvent, AuditLog
      controllers/   REST controllers
      routes/        Express routers
      services/      providers (email/whatsapp/sms), queue, providerService
      middleware/    auth, permission, upload, error
      utils/         crypto, render, logger, audit
      scripts/       seed.js
  frontend/
    src/
      pages/         Login, Dashboard, Contacts, Lists, Templates,
                     Campaigns, CampaignDetail, Surveys, SurveyDetail,
                     Reports, Users, Settings, Profile
      components/    Layout, ui
      lib/           api, auth, toast
```

## Getting started

### 1. Backend

```bash
cd backend
cp .env.example .env      # then edit the values
npm install
npm run seed              # creates the super admin from .env
npm run dev
```

`backend/.env` requires at minimum:

```
MONGO_URI=mongodb://127.0.0.1:27017/campaign_db
JWT_SECRET=some-long-random-string
SETTINGS_ENCRYPTION_KEY=some-long-random-32-char-key
PUBLIC_BASE_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5001
```

The seeded super admin uses `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (default `admin@example.com` / `Admin@12345`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5001 and log in. Vite proxies `/api`, `/t` and `/s` to the backend on port 5000.

## First-time setup in the panel

1. **Settings → Providers**: add your Email / WhatsApp / SMS provider, click **Set active**, then **Test**.
2. **Contacts / Lists**: add or import contacts.
3. **Templates**: create reusable messages with `{{name}}` etc.
4. **Surveys**: build a voting form and set it to *active*.
5. **Campaigns**: create a campaign, pick target lists, attach a survey, and **Send now**.

## Custom HTTP provider

For any third-party API, choose the `custom_http` provider and fill in:

- `url`, `method`, `headers` (JSON)
- `bodyTemplate` — JSON or text using `{{to}}`, `{{message}}`, `{{subject}}`, `{{name}}`
- optional `successPath` / `successValue` to validate the response

Example body template:

```json
{ "to": "{{to}}", "message": "{{message}}" }
```

## Multi-tenant accounts

The system supports many independent accounts (tenants) on one install:

- **Super admin** — sees everything: all admins, all users and all data.
- **Admin** — owns a tenant. Creates and manages its own sub-users and only ever sees its own
  contacts, lists, templates, campaigns, surveys, providers and reports.
- **Sub-users** (manager / viewer / custom roles) — belong to their admin's tenant and see the same data as their admin.

Rules:

- Only a **super admin** can create admins (and other super admins).
- An **admin** can create sub-users with any role except `admin` / `super_admin`.
- Every data document stores an `owner` (the tenant). All queries are automatically scoped, so one account can
  never see another account's data.
- Provider settings and sending rules are also per-tenant.

## Roles & Users

Roles and users are managed on **separate pages**:

- **Roles** (`/roles`) — the 4 built-in roles (`super_admin`, `admin`, `manager`, `viewer`) are seeded and cannot be
  deleted. Create custom roles and tick the permissions they should have.
- **Users** (`/users`) — create a user and pick a role from the list. You can also grant a few **extra permissions**
  to a single user on top of their role.
- **Import / Export** — export all users as CSV or Excel, import users from `.csv` / `.xlsx`
  (columns: `name, email, password, role`), and download an **example Excel** template.
- Changing a role's permissions instantly affects every user with that role (permissions are resolved from the
  Role collection at request time).

## Approval workflow

- Users with the `campaigns.approve` permission (super admin / admin) can create and send campaigns directly.
- Users **without** it (e.g. `manager`) create campaigns that go into **pending approval** state.
- An approver clicks **Approve** (or **Reject** with a reason) on the campaign page. Only approved campaigns can be sent.

## Sending rules (window + daily limit)

In **Settings → Sending Rules** you can:

- restrict sending to a time window (e.g. `09:00`–`21:00`, timezone offset in minutes — IST = `330`)
- set a **daily limit** (`0` = unlimited)

When a campaign hits a rule it is automatically **paused** with a reason, and the scheduler **auto-resumes** it
once the window opens / the next day begins.

## Delivery webhooks

Point your provider's status callback to:

| Provider | URL |
| --- | --- |
| Meta WhatsApp Cloud | `POST {PUBLIC_BASE_URL}/api/webhooks/meta` (verify: `GET` with `hub.verify_token`) |
| Twilio (SMS/WhatsApp) | `POST {PUBLIC_BASE_URL}/api/webhooks/twilio` |
| Custom HTTP | `POST {PUBLIC_BASE_URL}/api/webhooks/custom` |

For Meta, set a **Webhook Verify Token** in the provider config and use the same token in the Meta dashboard.
For custom providers, optionally set a **Webhook token** and include it as `token` in the callback body:

```json
{ "providerMessageId": "abc123", "status": "delivered", "token": "shared-secret" }
```

## Docker deployment

```bash
# from the project root
export JWT_SECRET="a-long-random-secret"
export SETTINGS_ENCRYPTION_KEY="another-long-random-key"
export PUBLIC_BASE_URL="http://your-domain"   # used in survey/tracking links
export CORS_ORIGIN="http://your-domain"
docker compose up -d --build

# create the super admin
docker compose exec backend npm run seed
```

- Admin panel: `http://localhost:8080`
- Backend API: `http://localhost:5000`

## Notes / production tips

- The send queue is in-process (with concurrency + retries). For very high volume, move it to Redis + BullMQ —
  the queue is isolated in `backend/src/services/queue.js`.
- Set `SEND_DELAY_MS` to control the delay between sends (rate limiting), `MAX_CONCURRENT_CAMPAIGNS`,
  `MAX_SEND_RETRIES` and `RETRY_BACKOFF_MS` for the engine.
- **Change `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY` and the super admin password before going live.**
- Public survey links look like `PUBLIC_BASE_URL/s/:slug`.
