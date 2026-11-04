# Genesys Queue Analytics — prototype v0.1

A static, GitHub Pages-friendly proof of concept for Genesys Cloud analytics, using OAuth Authorization Code + PKCE (no client secret). This is **not a production-ready or validated analytics application**.

## Installation

1. Create a public repository on GitHub and upload `index.html`, `style.css`, and `app.js` to its root.
2. Enable GitHub Pages: Settings → Pages → Deploy from a branch → main / root.
3. In Genesys Cloud Admin → Integrations → OAuth, create an OAuth client for **Authorization Code Grant with PKCE**, configured as a **public client** (no client secret in browser). Set the exact redirect URL to the Pages URL ending in `/` (e.g. `https://yourname.github.io/genesys-queue-analytics/`). Verify your Genesys tenant supports this public-client flow.
4. Open the Pages URL, choose region, paste the OAuth Client ID, save and sign in.
5. For a Genesys Cloud Custom Client Application, configure its URL to the Pages URL. Whether it can be embedded or opened externally depends on Genesys integration configuration, iframe/CSP and organizational policy. Use external launch when embedded OAuth redirects are blocked.

## Security / division caveats

The app reads the current user's primary division and attempts to read permitted divisions. It filters visible queues by their `division.id`. **This is only a UI filter, not an authorization boundary**: Genesys permissions must enforce access on the API. A user's primary division and the divisions where they have permissions are different concepts. A queue may belong to another division than the user's primary division; decide the policy before production.

For production, explicitly verify the endpoint `/api/v2/authorization/divisionspermitted/me?permission=routing:queue:view`, its response structure, pagination, and necessary roles/permissions in your Genesys region. The current prototype deliberately fails closed to queues with no matching division metadata. The queues listing endpoint may require pagination or expand parameters that vary by environment.

Tokens are kept in JavaScript memory only and disappear on refresh. Client ID and region are kept in localStorage. PKCE verifier/state are kept in sessionStorage during login. No client secret is used or stored. Host only over HTTPS; never put credentials or tokens in the GitHub repository.

## Accuracy limitations to fix before deployment

- Date range currently uses the browser's local timezone and fixed 24 hours; implement an explicit IANA timezone (`Europe/Amsterdam`) with DST-aware UTC bounds.
- `answered = offered - abandoned` is a proxy and not necessarily the Genesys answered metric.
- Service level is displayed per queue only; no weighted overall SL is calculated.
- The original per-agent AHT, initial-answerer attribution, transfer exclusion, and clipboard HTML report are **not yet migrated**.
- Genesys analytics metric structures and `nOffered` counting must be validated against actual tenant responses.
- Division endpoint and OAuth public-client support need tenant testing.
- A normal web popup cannot guarantee always-on-top; a native wrapper is needed.

## Architecture for next version

Separate `auth`, `genesys-api`, `division-policy`, `analytics`, `metrics`, and `ui` modules. Add unit tests with sanitized API fixtures, user-selectable queue groups, timezone handling, CSV/HTML export, clear permissions errors and token refresh/relogin behavior. Consider a backend if stronger cross-tenant controls are needed.
