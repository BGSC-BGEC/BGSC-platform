# BGSC student hosting setup: detailed instructions

Updated October 25, 2026. Use this with [the public-launch checklist](PUBLIC_LAUNCH_CHECKLIST.md). This guide describes work still to do; the example configurations below have not been added to the application or deployed.

Replace `example.in`, `YOUR_VPS_IP`, `YOUR_ADMIN_IP`, repository names, and every `REPLACE_...` value. Run computer commands on your computer and server commands only after connecting to the correct VPS. Do not paste an entire section before reading its prerequisites.

**A. What you will pay for, and what stays free**

| Expense | Decision | Cost rule |
|---|---|---|
| Hostinger VPS | Paid | Recurring server bill; includes the compute/disk used by the backend, MongoDB, Redis, and uploaded files |
| Domain | Paid | Keep normal renewal, including required fees/taxes, at or below ₹1,200/year |
| Google Play registration | Paid | US$25 one-time; confirm local checkout and identity requirements |
| Apple App Store membership | Separate decision | Normally US$99/year; an institution's approved waiver is an exception |
| Admin/public web hosting | Cloudflare Pages Free | Static websites; no paid Worker or server-side Pages Functions in this design |
| DNS / website HTTPS | Cloudflare Free / Pages certificates | Attach website domains in Pages and let its certificate provisioning finish |
| API origin HTTPS | Caddy automatic HTTPS | Free certificate; the VPS must remain reachable for the chosen renewal method |
| Database / event bus | Existing MongoDB and Redis containers | No separate subscription; the team handles maintenance and recovery |
| Outgoing transactional email | Brevo Free | Currently 300 sends/day, including verification, reset, resends, and feedback |
| Incoming support mail | Cloudflare Email Routing | Forward to an existing verified inbox; outgoing replies need Brevo or that inbox's sender identity |
| Email verification | Existing token links through Brevo | Consumes email quota; no SMS or separate auth provider is needed |
| Phone OTP / WhatsApp | Deferred | Do not budget production delivery as free or depend on trial credits |
| Member images/videos | Current upload volume on the VPS | No separate image-processing or object-storage subscription initially |
| Off-server backups | R2 Standard within allowance, or approved university storage | R2 has metered billing beyond included usage; review before subscribing |
| Mobile build service | EAS Free, or a local build | Wait/build locally if free quota runs out; do not auto-upgrade |

Cloudflare's free outgoing email can send to verified destinations in your own account, but arbitrary-recipient sending requires a paid Workers plan. Consequently member verification/reset delivery uses Brevo. Student status alone does not make SMS delivery or all Cloudflare products free. [Cloudflare email pricing](https://developers.cloudflare.com/email-service/platform/pricing/).

For the Android budget, Google documents a one-time registration fee. Apple documents annual membership and restricts educational fee waivers to eligible organizations, rather than individual students. Decide who legally owns the app account before paying. [Google registration](https://support.google.com/googleplay/android-developer/answer/6112435), [Apple membership](https://developer.apple.com/programs/enroll/), [waiver requirements](https://developer.apple.com/help/account/membership/fee-waivers/).

Optional: apply for GitHub Education through your own verified student account. Record the expiry and renewal conditions of any third-party benefit. Keep the core deployment working without expiring credits or repeated trial accounts. [Student benefit terms](https://docs.github.com/en/education/about-github-education/github-education-for-students/github-terms-and-conditions-for-the-student-developer-pack).

**B. Finish the required code before attempting a public deployment**

Give these tasks to whoever is implementing backend/frontend changes. Merely putting credentials into an environment file will not replace the current stubs.

1. Add a minimal Brevo HTTPS email sender used by both auth and feedback, following the existing shared-code structure. Use Node's existing HTTP facilities unless an installed project dependency already solves it.
2. Add production configuration validation, bounded request timeouts, provider error handling, and private error reporting. Keep the current generic public responses for recovery/resend requests.
3. Replace the production stubs in `Backend/apps/auth-service/src/auth/mailer.service.ts` and `Backend/apps/feedback-service/src/feedback/mailer.ts` with that sender. Development tests must not send real messages.
4. Add public routes/screens for `/verify-email` and `/reset-password` in `web/`. Verification posts the token to `/auth/verify-email`; password reset posts the token/new password using the existing reset schema. Show a safe expired/invalid outcome and a way to request another link.
5. Keep email verification link based. A six-digit email OTP would require a deliberate backend/frontend contract change; the existing phone OTP cannot be relabeled as email verification.
6. While SMS is deferred, make the phone send route return an explicit unavailable error in production and hide its entry points. Check no required signup/event step demands a verified phone. Do not set `is_phone_verified` without actual phone verification.
7. Complete or hide Google login. The backend already has a browser login-code exchange, but mobile currently reports it unavailable and the web callback page is missing. Complete or hide the Strava callback handoff too.
8. Fix confirmed API gaps, including the current user's global rank if that card launches. Update the clients and API registry with each change.
9. Fix CI to use `Backend/`, MongoDB, Redis, the supported Node version, and the scripts actually present in the project. Require the release commit to pass.

Proposed new mail settings below are names the implementation should add consistently. They do not currently activate email by themselves:

| Setting | Used by | Purpose |
|---|---|---|
| `BREVO_API_KEY` | Auth and feedback backend services | Private credential for the email API |
| `MAIL_FROM_EMAIL` | Same services | Authenticated sender, e.g. `accounts@example.in` |
| `MAIL_FROM_NAME` | Same services | Recognizable name, e.g. `BGSC` |
| `MAIL_REPLY_TO_EMAIL` | Same services | Monitored support address |

The planned sender calls `POST https://api.brevo.com/v3/smtp/email` with its `api-key` credential header. Supply sender, recipients, subject/content, and reply-to using the provider's current request schema. Record the returned message reference privately; acceptance is not proof of inbox delivery. [Brevo send API](https://developers.brevo.com/reference/send-transac-email).

Completion evidence: a test user can receive and use verification/reset links; feedback receipts/responses arrive; an unavailable phone provider cannot produce a successful dispatch message.

**C. Buy and connect the domain**

1. Search for an available non-premium `.in` name at your registrar. Read its normal renewal total and registration term. Keep it within the annual cap after required fees; avoid adding paid mailboxes, website builders, or hosting bundles you do not need.
2. Register it under a stable project owner. Enable two-factor authentication, auto-renewal/reminders, and registrar lock where offered. Keep recovery codes and an external recovery email.
3. Create a Cloudflare account, choose the free domain plan, add the domain, and review its imported DNS records before changing anything.
4. Copy the two nameservers Cloudflare assigns. At the registrar, replace the old nameservers with that exact pair. Wait until Cloudflare reports the zone active.
5. Add an API record in Cloudflare DNS: type `A`, name `api`, content `YOUR_VPS_IP`, TTL Auto. Start with Proxy status **DNS only** so you can establish origin HTTPS first.
6. Add `staging-api` only if hosting an isolated staging backend on a reachable server. Do not create records for MongoDB, Redis, or individual domain services.
7. Do not add `admin` or root records pointing at the VPS for website hosting. Those domains will be attached to their Cloudflare Pages projects in section F.
8. Enable DNSSEC after the nameserver move works. Copy Cloudflare's generated DS details to the registrar and verify validation. Confirm registrar/extension support; do not leave an old DS record tied to a previous provider.

From your computer, after replacing the example domain:

```bash
nslookup api.example.in
```

In DNS-only mode, the result should contain the VPS address. Once proxying is enabled it normally contains Cloudflare addresses instead. A DNS change can take time to reach cached resolvers; test from another network too.

No second domain purchase is needed for `admin`, `api`, and staging subdomains. Nameserver changes are performed at the registrar; DNS record changes are then performed in Cloudflare. [Cloudflare domain setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/), [Hostinger DNSSEC](https://www.hostinger.com/support/3667267-how-to-use-dnssec-records-at-hostinger/).

Completion evidence: the API name resolves as expected, Cloudflare manages the domain, and registrar/Cloudflare access can be recovered securely.

**D. Prepare the Hostinger VPS**

1. Choose a supported Ubuntu LTS VPS. Evaluate KVM 2 using measured backend usage and checkout totals. Do not purchase a separate shared-web-hosting package for the admin panel.
2. Record its IP, region, renewal bill, SSH username, and Hostinger browser-console recovery method. Limit hPanel access and enable account two-factor authentication.
3. On your computer, create an SSH key if you do not already have an appropriate one. Add its public key to the VPS; keep its private half private.
4. Connect using the provided initial SSH account. Create a named `sudo` user such as `bgsc`, install the public key for it, and verify a second terminal can log in before tightening SSH settings.
5. Update packages and configure routine security updates. Plan reboots so they do not interrupt event registration.
6. Restrict inbound traffic using Hostinger's firewall and the host firewall. Permit TCP 80/443 for API HTTPS and certificate validation; permit SSH only from your administrative network where practical. Apply equivalent IPv6 rules if IPv6 is enabled.
7. Once the new key login and recovery console work, disable root/password SSH access. Keep a working session open while testing the new settings.
8. Install current Docker Engine with the Compose plugin and Caddy using their supported Ubuntu instructions. Check `docker compose version` and `caddy version`. The override example below needs Compose 2.24.4 or newer.
9. Give Docker access only to trusted administrators. Create a restricted configuration directory, e.g. `/etc/bgsc/`, and a working checkout/artifact directory, e.g. `/srv/bgsc/platform/`.

Example commands after logging into the correct VPS as the named administrator:

```bash
sudo apt update
sudo apt upgrade
sudo install -d -m 750 -o bgsc -g bgsc /etc/bgsc
```

Use the provider's current supported installation instructions for packages instead of an unreviewed one-line installer: [Docker on Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Caddy installation](https://caddyserver.com/docs/install).

Completion evidence: key-based administration works, updates are applied, Docker/Caddy are installed, and database/application ports are not publicly reachable.

**E. Configure private MongoDB, Redis, and the backend**

Keep all 12 services on the existing private Docker network. This preserves the current MongoDB models and Redis pub/sub event delivery. Do not switch the database URI to Cloudflare D1 or Redis to an HTTP cache URL.

1. Check out the reviewed release in `/srv/bgsc/platform/` or retrieve the corresponding image/artifacts. The commands below assume your current directory is its `Backend/` folder.
2. Create `/etc/bgsc/backend.production.env`, owned by the deployment account and readable only by it. Use `touch /etc/bgsc/backend.production.env` followed by `chmod 600 /etc/bgsc/backend.production.env`, then edit it in a private terminal. Preserve existing values if the file already exists. Do not commit it, print it in CI logs, or copy it into a container image.
3. Generate a different strong value for each secret. `openssl rand -hex 32` can generate a URL-safe value to save in your password manager and the appropriate file field. Root DB, application DB, JWT access, JWT refresh, internal signing, and Redis credentials must be distinct.
4. Add real values using the template below. Keep the production and staging files separate. Optional OAuth settings remain absent until the feature is configured.

```dotenv
# Private server file: /etc/bgsc/backend.production.env
NODE_ENV=production
RELEASE_TAG=2026-10-25-rc1
MONGO_ROOT_PASSWORD=REPLACE_WITH_ROOT_DB_SECRET
MONGO_URI=mongodb://bgsc_app:REPLACE_WITH_APP_DB_SECRET@mongodb:27017/bgsc_prod?authSource=bgsc_prod
REDIS_PASSWORD=REPLACE_WITH_REDIS_SECRET
JWT_ACCESS_SECRET=REPLACE_WITH_ACCESS_SECRET
JWT_REFRESH_SECRET=REPLACE_WITH_REFRESH_SECRET
INTERNAL_API_TOKEN=REPLACE_WITH_INTERNAL_SECRET
API_BASE_URL=https://api.example.in
FRONTEND_URL=https://admin.example.in
CORS_ORIGIN=https://admin.example.in

# Proposed settings: implement the mail integration before relying on these
BREVO_API_KEY=REPLACE_WITH_BREVO_API_KEY
MAIL_FROM_EMAIL=accounts@example.in
MAIL_FROM_NAME=BGSC
MAIL_REPLY_TO_EMAIL=support@example.in
```

The existing Compose file hardcodes its development Mongo URI in every domain service. Setting only `MONGO_URI` in the external file will not override those entries. Create `Backend/compose.production.yml` as a reviewed deployment configuration. The following is a starting template for the current service names, not a file already present:

```yaml
x-backend: &backend
  image: bgsc-backend:${RELEASE_TAG:?set RELEASE_TAG}

x-database: &database
  MONGO_URI: ${MONGO_URI:?set the private application Mongo URI}

x-mail: &mail
  BREVO_API_KEY: ${BREVO_API_KEY:?set the email API key}
  MAIL_FROM_EMAIL: ${MAIL_FROM_EMAIL:?set the authenticated sender}
  MAIL_FROM_NAME: ${MAIL_FROM_NAME:-BGSC}
  MAIL_REPLY_TO_EMAIL: ${MAIL_REPLY_TO_EMAIL:?set the support address}

services:
  mongodb:
    ports: !reset []
  redis:
    ports: !reset []
  mongo-express:
    ports: !reset []
  gateway:
    <<: *backend
    ports: !override
      - "127.0.0.1:3000:3000"
  auth-service:
    <<: *backend
    environment:
      <<: [*database, *mail]
  user-service:
    <<: *backend
    environment: *database
  event-service:
    <<: *backend
    environment: *database
  registration-service:
    <<: *backend
    environment: *database
  announcement-service:
    <<: *backend
    environment: *database
  points-service:
    <<: *backend
    environment: *database
  leaderboard-service:
    <<: *backend
    environment: *database
  challenge-service:
    <<: *backend
    environment: *database
  media-service:
    <<: *backend
    environment: *database
  notification-service:
    <<: *backend
    environment: *database
  feedback-service:
    <<: *backend
    environment:
      <<: [*database, *mail]
  bracket-service:
    <<: *backend
    environment: *database
```

This override retains the base service environments, dependencies, storage mounts, health checks, and build configuration. It replaces app image tags, database URIs, and published ports. Check the merged configuration after future base-file changes. Use a Compose version that supports these override tags so the old public gateway mapping is replaced rather than appended. [Compose merging](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).

5. Validate the configuration without dumping its resolved secrets:

```bash
# VPS, inside the release's Backend/ directory
docker compose --project-name bgsc-prod \
  --env-file /etc/bgsc/backend.production.env \
  -f docker-compose.yml -f compose.production.yml config --quiet
```

6. Start only the database and Redis first:

```bash
docker compose --project-name bgsc-prod \
  --env-file /etc/bgsc/backend.production.env \
  -f docker-compose.yml -f compose.production.yml up -d mongodb redis
```

7. Create the application database user before starting the domain services. Enter Mongo's root password at the prompt, rather than pasting a password into command history:

```bash
docker compose --project-name bgsc-prod \
  --env-file /etc/bgsc/backend.production.env \
  -f docker-compose.yml -f compose.production.yml \
  exec mongodb mongosh --username bgsc_admin --authenticationDatabase admin --password
```

Inside that Mongo shell, run:

```javascript
use bgsc_prod
db.createUser({
  user: "bgsc_app",
  pwd: passwordPrompt(),
  roles: [{ role: "readWrite", db: "bgsc_prod" }]
})
```

At `passwordPrompt()`, enter the application DB secret from `MONGO_URI`, not the root secret. Leave the shell with `exit`. Perform this user creation once on the fresh database; an existing user needs a deliberate credential update. Confirm the role supports the indexes and operations the services perform.

8. Build the shared application image once from the gateway build context; all domain services use that same release image. On a constrained VPS, build in CI and pull the tagged image instead.

```bash
docker compose --project-name bgsc-prod \
  --env-file /etc/bgsc/backend.production.env \
  -f docker-compose.yml -f compose.production.yml build gateway

docker compose --project-name bgsc-prod \
  --env-file /etc/bgsc/backend.production.env \
  -f docker-compose.yml -f compose.production.yml up -d --no-build

docker compose --project-name bgsc-prod \
  --env-file /etc/bgsc/backend.production.env \
  -f docker-compose.yml -f compose.production.yml ps

curl -fsS http://127.0.0.1:3000/health
```

Prerequisites for step 8: the code fixes, proxy handling, production configuration, and email integration must already be implemented. A successful gateway health response does not prove all services work; inspect every service's health/logs and complete the manual journeys.

9. Verify only port 3000 on loopback is published for applications; database/Redis ports remain private. Keep the `tools` profile disabled. Inspect logs privately for connection errors, failed indexes, bad event signatures, and repeated restarts.
10. Preserve the Compose project name and volume mapping across releases. A new project name can create new empty volumes and make existing data appear missing. Never use `down -v` as a production update command.
11. Register/verify the founder account and run the existing `seed:founder` bootstrap using its documented procedure in this production environment. Preserve its recovery access.

Completion evidence: all services run in production mode, use `bgsc_prod` through the application user, authenticate to private Redis, and retain data/uploads after a restart.

**F. Host the admin website on Cloudflare Pages Free**

The admin UI is already a static Vite application. Its API calls still go to the Hostinger backend. Hosting its JavaScript files on Cloudflare does not move authentication or MongoDB there.

1. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git**. Select the GitHub repository and grant access only to the intended repository.
2. Create a staging project first, e.g. `bgsc-admin-staging`, then a production project, e.g. `bgsc-admin`. Set the production project to the reviewed release branch, normally `main` after its checks pass.
3. Enter these repository-specific build settings:

| Field | Value |
|---|---|
| Framework | Vite, or configure the equivalent fields manually |
| Root directory | `web` |
| Build command | `npm run build` |
| Build output directory | `dist` relative to that root |
| Node setting | Supported Node 22, e.g. `NODE_VERSION=22` |
| Production API | `VITE_API_URL=https://api.example.in` |
| Mock mode | `VITE_USE_MOCK=false` |
| Staging API | `VITE_API_URL=https://staging-api.example.in` in the separate staging project |

4. Deploy and inspect its build log. Confirm dependencies come from `web/package-lock.json`, the build finishes, and the deployment commit is the intended one. Fix errors before attaching the public admin hostname.
5. In that project's **Custom domains**, add `admin.example.in`. Follow the generated DNS/certificate instructions. Repeat with `staging-admin.example.in` on the staging project. Register the domain with Pages before manually inventing its DNS target.
6. Keep staging credentials/data separate. Protect staging using suitable access controls; do not put an interactive website login gate in front of mobile API calls without handling it in the test clients.

The account/project workflow follows [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/); framework build configuration is described in [the React deployment guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/). Website-domain attachment is described in [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

7. Directly open and refresh `/events`, `/verify-email`, and `/reset-password`. For a client-routed site, Pages normally falls back to the root app when there is no top-level `404.html`; confirm the built output matches that design. The account pages must render before login. [Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/).
8. Use exact CORS origins such as `https://admin.example.in`. Avoid allowing all preview URLs to access production. Use browser Network/Console tools to confirm API URLs, successful preflight requests, and errors.
9. Add appropriate static-site security headers through a reviewed `web/public/_headers` file if needed. Tailor Content Security Policy to the app's real API/media origins; test before enforcing it. Do not block your own images/fonts/API with a copied policy.
10. Keep Pages on Free, restrict build triggers to relevant frontend paths, and record the deployment history. Practice rolling back a staging deployment. Do not introduce a paid Worker just to serve the current static build.

For the root project-information site, create a separate small static Pages project with support/privacy/terms/download pages and attach `example.in` through its Custom domains settings. The directory/build inputs for that site still need to be created; they do not exist merely because the admin project exists.

Completion evidence: the admin website loads through its custom HTTPS domain, refreshes on nested routes, and calls the correct backend without mock mode.

**G. Establish API HTTPS, then enable Cloudflare protection**

1. Keep `api.example.in` DNS-only while setting up Caddy on the VPS. Confirm port 80/443 reaches it and no other program is occupying those ports.
2. Add an API site block to `/etc/caddy/Caddyfile`. This initial example assumes Caddy runs on the host and the gateway is bound to host loopback:

```caddyfile
api.example.in {
    reverse_proxy 127.0.0.1:3000
}
```

3. Validate and reload the file, preserving any other valid site blocks already present:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

4. Caddy obtains/renews the origin certificate when its automatic HTTPS requirements are met. From your computer, test the public API:

```bash
curl -fsS https://api.example.in/health
```

5. Before using this deployment for members, update the gateway's trusted-proxy handling. Its current direct-client configuration would count Caddy as every caller's IP. Allow only the actual proxy path and sanitize forwarded client/protocol headers.
6. Verify two different real clients are recognized separately, and a supplied fake `X-Forwarded-For` cannot bypass rate limits. Keep direct gateway access closed.
7. When enabling the Cloudflare proxy for the API, set its TLS mode to **Full (strict)**. Confirm origin and edge certificates are both valid and automated origin renewal still works. An Origin CA certificate alone is not publicly trusted for direct-browser origin access; the initial Caddy public certificate avoids that dependency.
8. Configure Caddy to trust only Cloudflare's actual published proxy networks before using its client-IP headers. Use the documented proxy parsing rules and pass a sanitized real client address to the gateway. Never trust `CF-Connecting-IP` on arbitrary direct connections. [Caddy proxy options](https://caddyserver.com/docs/caddyfile/options).
9. If relying on Cloudflare protection, restrict origin web traffic appropriately and test direct-IP attempts, including requests with the correct Host header. Keep SSH recovery and the chosen certificate-renewal method working.
10. Bypass shared caching for the API initially. Do not cache login, tokens, personalized responses, private files, or moderation previews. Do not apply browser challenges to mobile/API routes; test any firewall rule against the real app.
11. Check a normal HTTPS request, invalid-token request, blocked internal route, permitted upload, denied private upload, and large allowed video. Retest after enabling proxying rather than assuming DNS-only behavior remains identical.

The initial Caddy block is enough to establish HTTPS, but the forwarding/firewall code and configuration in steps 5–10 are additional required work. The application checklist tracks them. [Caddy HTTPS](https://caddyserver.com/docs/automatic-https), [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

Completion evidence: HTTPS works, direct backend ports remain private, real users get separate rate-limit identities, and spoofed headers grant no access.

**H. Configure free transactional and support email**

1. Create Brevo Free and complete required account activation for transactional sending. Choose one accountable owner; use the provider's permitted collaboration model rather than sharing a personal password.
2. Open its sender/domain settings, add the actual sending domain (`example.in` if sending as `accounts@example.in`), and choose manual DNS authentication if that best limits account permissions.
3. Copy its exact ownership/DKIM/DMARC values into Cloudflare. DKIM CNAME records must remain DNS-only. Do not paste DNS values from this guide or another project's account.
4. Recheck domain authentication in Brevo until it passes. Shared-IP domain authentication currently uses Brevo's ownership record, DKIM, and DMARC; SPF/MX are not required for that authentication. Preserve other valid mail records. [Brevo authentication steps](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).
5. Create an authenticated sender and an API credential. Store the credential only in the backend secret file, supplying it to auth/feedback containers through the reviewed override. It must never be a `VITE_` or `EXPO_PUBLIC_` value.
6. In Cloudflare's email routing settings, add and verify the existing team inbox, create `support@example.in`, and accept the required routing DNS records after checking existing mail services. Send an outside test message and confirm forwarding.
7. Use that support address as the email Reply-To. Test incoming replies from an actual recipient. Cloudflare forwarding does not configure Gmail/another inbox to send as the custom domain.
8. Send one controlled test of each application email. Verify the From/Reply-To addresses, correct HTTPS link, received content, spam placement, and DKIM/DMARC results in the received message headers.
9. Disable link/open tracking for account links if enabled. Keep sensitive tokens out of URLs sent to third-party analytics and out of access/error logs; remove account tokens from the browser address bar once processed where practical.

Brevo's Free quota is shared: plan at most 200 new registrations/day initially and reserve 100 sends for other operations, then revise from observed usage. Those are this project's planning limits, not extra provider allowances. A few members requesting many resends can still consume the reserve. Do not send announcement blasts by email.

10. Make usage/failures visible to the team and retain resend/recovery controls. Simulate API rejection/timeout without exhausting real quota. Accepted messages can be delayed after quota exhaustion and may arrive with expired tokens; offer a fresh request.
11. If the launch needs more simultaneous onboarding than the free limit supports, stagger invitations or explicitly fund email. Do not promise unlimited free auth mail or bypass limits using repeated accounts.

Use [Brevo's quota documentation](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) for current limits and [Cloudflare's email setup](https://developers.cloudflare.com/email-service/get-started/) for routing.

Completion evidence: real verification/reset/feedback mail and incoming support replies work, with a usable response to quota/provider failures.

**I. Handle OTP and images without hidden paid dependencies**

**Verification:** The default release verifies email ownership through the existing link. It does not verify phone ownership. Keeping a phone field is acceptable only when it is accurately labeled unverified and no permission/security decision treats it as proof.

If phone verification is essential, stop treating messaging as a zero-cost service: select a provider, budget it, complete applicable sender/template onboarding, and implement real delivery. A temporary trial, a development console OTP, a hardcoded code, or an email code sent instead does not prove access to a phone. The sending route must not remain a successful production stub.

If you specifically want six-digit email OTP later, record a separate implementation task covering cryptographic code generation, hashed storage, short expiry, single use, shared attempt limits, resend limits, and both frontend callers. It will consume the same email quota. Do not introduce it merely to rename the current working link flow.

**Images/media:** Retain the current shared upload volume for the initial release. It already has separate locations for avatars, event images, approved media, pending media, and private registration files.

1. Mount that volume in all the services that need it and use `UPLOAD_DIR=/app/uploads` as in the base Compose file.
2. Keep public delivery through the existing backend `/uploads` route; protect pending/private retrieval through its existing authenticated routes. Never point a static web server at the entire volume.
3. Retain content validation, per-file limits, authenticated upload checks, moderation, and deletion rules. The current media limits are 10 MiB for images and 50 MiB for video; verify actual proxy and device behavior against them.
4. Add an aggregate disk quota/admission check so many valid individual uploads cannot fill the VPS. Include rejected/pending content and temporary files in the calculation.
5. Monitor free disk and backup growth. Set a measured stop-upload threshold that leaves space for MongoDB, logs, temporary uploads, and one recovery operation.
6. Test upload → pending preview → approval → public view, avatar removal, private registration downloads, and persistence after deployment.
7. Include uploaded files in the off-server backup and restoration drill. The VPS disk is persistent storage, not an independent backup.

R2 can later hold uploads within its included allowance, but the current storage code writes local files. Supplying an R2 key alone will not migrate it. If needed, plan that migration across the storage helpers, moderation moves, deletion, response URLs, and private-file authorization. Use a separate private bucket for restricted content; no public URL for pending/private files. Do not purchase Cloudflare Images/Stream just to enable uploads that the current backend already handles.

Completion evidence: accurate verification status, no false OTP success, safe uploads, predictable disk usage, and no new paid media dependency.

**J. Keep off-server backups within a free allowance**

An acceptable backup must survive losing the VPS. Choose either a private R2 Standard bucket or institution-approved storage whose access control, quota, retention, and use for member data are acceptable. Do not store unencrypted member-data archives in a public bucket or shared link.

R2 setup:

1. Open Cloudflare **Storage & databases → R2**, inspect the current subscription/checkout terms, and decide whether its metered billing is acceptable. Free included usage does not mean billing is disabled. [R2 getting started](https://developers.cloudflare.com/r2/get-started/).
2. Create a Standard bucket such as `bgsc-prod-backups`. Keep public access disabled and attach no public custom domain.
3. Create a bucket-scoped credential for the backup process. Keep a separate secure credential available for recovery; do not expose object write/delete access in either frontend.
4. Configure an installed backup/sync tool, e.g. rclone, with the account's S3-compatible endpoint and restricted credentials. Store its config with restricted file permissions.
5. Before enabling scheduling, produce one consistent Mongo dump and an upload archive. For this small standalone Mongo setup, use a planned maintenance/write pause if needed so registrations/points/files cannot change halfway through the snapshot. Record database name, release version, timestamp, file manifest, and checksums.
6. Encrypt the archives before upload using a reviewed tool such as restic or an appropriate archive-encryption workflow. Keep its recovery key in secure storage outside the VPS.
7. Measure the total resulting backup set. Calculate space for all retained copies plus one new/in-progress copy, unrelated R2 objects, and a safety margin before setting retention.

An example budget is seven daily sets of 500 MB each, plus one in-progress set: roughly 4 GB before any other retained objects. Your real database/media size must replace that example. If every set becomes 2 GB, seven daily sets no longer fit this free plan.

8. Keep projected account usage below an internal threshold such as 8 GB, leaving margin beneath the included 10 GB-month allowance. This is a conservative project rule, not a guarantee against billing. Include request-operation usage and all buckets.
9. Configure retention/lifecycle deliberately. Stop and alert before an upload would exceed the chosen storage budget; never delete the last known good backup to make a failing upload fit.
10. Schedule daily backups initially, adjusted to the recovery requirements. Alert if a backup is late, fails, exceeds the storage plan, or cannot be verified.
11. Restore an archive into an isolated stack. Verify administrator login, a registration, point balances, and private/public media. Restore credentials/encryption keys through the documented recovery procedure.
12. If quotas cannot cover the required retention, move to approved university storage or fund the capacity. Do not launch assuming unverified free backup space is unlimited.

R2's published free allowance is account-wide and Standard-only; excess storage/operations can be charged. Billing alerts are not an automatic spending stop. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Completion evidence: encrypted off-server backup, successful isolated restore, written retention/recovery rules, and a quota response that someone monitors.

**K. Connect mobile, release Android, and keep staging isolated**

1. Complete `mobile/app.json` and build profiles as listed in the main checklist. Keep public build settings separate from backend secrets.
2. Use these production values in the chosen EAS environment/build setup, after publishing the linked pages:

```dotenv
EXPO_PUBLIC_API_URL=https://api.example.in
EXPO_PUBLIC_PRIVACY_URL=https://example.in/privacy
EXPO_PUBLIC_TERMS_URL=https://example.in/terms
```

3. Use staging API/policy addresses in the internal test build. Rebuild when embedded environment values change. Changing Hostinger's environment file does not change already installed clients.
4. Keep EAS Free and inspect its current allowance. Do not spend the release quota on every cosmetic change; use development builds for routine work and reserve signed builds for meaningful test/release candidates. Free quota exhaustion requires waiting or local builds, rather than automatic paid overages. [Expo billing behavior](https://docs.expo.dev/billing/faq/).
5. Install a real test build and verify auth, recovered sessions, public media URLs, private downloads, deep links, and cross-client admin changes over Wi-Fi and mobile data.
6. Register Google Play under the intended owner, complete its account verification and current testing requirements, secure signing/recovery credentials, and submit the proper production artifact after the pilot.
7. For iOS, make a separate annual-cost/waiver decision. If relying on an institution's account, get its agreement and access before scheduling a store release. A browser member build is a separate deliverable to test, not an automatic replacement already hosted by the admin site.

If staging shares the VPS, use a different Compose project, a different loopback gateway port such as 3100, a separate Mongo database/user and Redis instance, separate volumes/secrets, and a staging Caddy hostname. Give its app image a distinct tag. Test which database each deployment uses before any fixture/reset command. The production override example above is not also a ready-to-run staging configuration.

Completion evidence: the installed production candidate uses the production HTTPS API and passes the full journey checklist, while staging cannot mutate production data.

**L. Final acceptance, updates, and student-team handover**

Before public access, demonstrate these outcomes:

- [ ] Signup and verification work from an inbox without looking at server logs.
- [ ] Password recovery works while signed out; expired and reused links fail safely.
- [ ] An admin publishes an event on Pages; a member sees and registers for it on the app; the admin sees that registration.
- [ ] Attendance/results update the expected points once, including a retry and a service restart.
- [ ] Unauthorized users cannot change another event or read private files, even using direct API requests.
- [ ] HTTPS and certificate renewal work; intended client-IP/rate-limit behavior survives Cloudflare proxying.
- [ ] MongoDB/Redis/domain-service ports are unreachable externally; upload/database data survives a redeploy.
- [ ] Free email capacity, disk capacity, backup size, and build quotas cover the pilot and planned first public event.
- [ ] A restore and rollback have been performed in isolation; the person on duty can follow the written steps.

For an update: check the exact commit, back up data, build/pull a new shared image tag, deploy with the same production project/volume mapping, and verify critical journeys. Deploy the corresponding checked Pages build separately. Keep the previous backend image and successful Pages deployment. Data changes need their own compatibility/rollback plan; rolling back code does not reverse changed member data.

For a student team, keep a private handover record containing account owners, recovery contacts, billing/renewal dates, credential locations, backup/recovery instructions, deployed versions, and free-tier limits. Name a successor before the current owner graduates. Do not put passwords or recovery codes into the repository.

Only the planning documents are updated by this task. Provider accounts, code integrations, deployments, and tests still need to be completed and checked off.
