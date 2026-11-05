Genesys Queue Analytics v0.3.20 — 5 november 2026

- Herstelt/voorkomt HTTP 400 door ongeldige mediaType=all in alle analytics queries.
- Alle media laat de mediaType-predicate weg; overige media gebruiken de specifieke filter.
- Centrale defensieve opschoning voor analytics request bodies.
- Versienummer in index.html bijgewerkt naar v0.3.20.
- Cache-busting voor app.js en style.css om verouderde code in Genesys Client Application te vermijden.
- Overige werking uit v0.3.19 behouden.

Installatie: vervang index.html, app.js en style.css. Gebruik geen config.js.
Test: live Genesys tenant/iframe niet beschikbaar in deze omgeving.
