# Vue 3 + Tailwind CSS migratie

**Branch:** `vue-migration` · **doelversie:** 0.4.0

## Status

De migratiebranch en Vite/Vue 3/Tailwind CSS 4-projectstructuur zijn aangemaakt. **De functionaliteit is nog niet overgezet**: de huidige Vue-pagina is uitsluitend een ontwikkelskelet. De stabiele applicatie op `main` blijft intact.

## Nog uit te voeren

1. OAuth Authorization Code + PKCE migreren naar composables en API-service, inclusief terugkeer vanaf OAuth-redirect.
2. Queuelidmaatschap, selecties en mediafilters overzetten.
3. Analytics-metrieken, dagtotalen en persoonlijke prestaties migreren en vergelijken met v0.3.23.
4. Realtime polling, backoff, agentstatussen en tijd-in-status migreren.
5. Instellingen, helpvenster, popup en responsieve componenten overzetten.
6. Tests, productiebuild en GitHub Pages/Vimexx deployment controleren.

## Ontwikkelen

```sh
npm install
npm run dev
npm run build
```

Gebruik de inhoud van `dist/` voor statische hosting. De Vite `base` is relatief ingesteld zodat GitHub Pages-subpaden en Vimexx-submappen ondersteund worden.
