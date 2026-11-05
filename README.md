# Genesys Queue Analytics

**Versie 0.3.23 · 5 november 2026**

Genesys Queue Analytics is een lichte, Nederlandstalige webapplicatie voor het volgen van **wachtrijprestaties, persoonlijke prestaties en agentstatussen** in Genesys Cloud. De applicatie draait volledig in de browser, kan worden ingebed als Genesys Cloud Client Application en kan ook in een afzonderlijk browservenster worden gebruikt.

> **Status:** ontwikkel-/demoversie. De belangrijkste functies zijn geïmplementeerd, maar de berekeningen, rechten en API-responses moeten per Genesys Cloud-organisatie worden gevalideerd voordat je de cijfers als definitieve operationele rapportage gebruikt.

## Gebruikershandleiding

Voor aanmelden, wachtrijen en statistieken instellen, datum en mediatype kiezen, verversen en het openen van een apart venster: **[lees HELP.md](HELP.md)**. De handleiding is ook vanuit de app bereikbaar via het vraagteken rechtsboven, tussen Instellingen en Aanmelden. De app laadt `HELP.md` relatief aan de eigen locatie, zodat dit op GitHub Pages, Vimexx en andere HTTPS-hosts werkt. Publiceer `HELP.md` naast `index.html`, `app.js` en `style.css`.

## Instellingen per klant (v0.3.23)

De Client Application URL ondersteunt `showAgents=false` (tabblad Agenten verbergen) en `primaryColor=%230078D4` (hoofdkleur instellen; `%23` is `#`). Beide instellingen zijn optioneel. Standaard blijft Agenten zichtbaar en is de kleur `#1A2B67`. De opties blijven behouden bij aanmelden via OAuth en bij openen in een apart venster.

Voorbeeld:

```text
https://JOUW_DOMEIN/analytics/?clientId=JOUW_CLIENT_ID&region=mypurecloud.de&showAgents=false&primaryColor=%230078D4
```

## Wat kun je ermee?

### 1. Dagcijfers per queue

Kies een datum, mediatype en één of meer queues. Het overzicht toont **Dagcijfers - [mediatype]** met per queue maximaal **zes zelf te kiezen statistieken**. Beschikbare opties omvatten onder meer:

- Offered, Answered, Handle, Abandoned, Abandon % en Answer %;
- Service Level (SL %), ASA, AHT, Avg Talk, Avg Hold en Avg ACW;
- Transfer, Blind Transfer, Consult Transfer, Flow Out, Avg Wait en Avg Abandon;
- **Waiting** en **Wait Time (Longest Waiting)** voor actuele wachtrijactiviteit.

De tabel heeft een **Totalen**-regel. Aantallen worden samengevoegd; percentages en gemiddelden worden op basis van onderliggende statistieken berekend in plaats van simpelweg de zichtbare percentages op te tellen.

**Mediatypes:** Alle media, Voice, E-mail, Chat, Messaging en Callback. Bij **Alle media** worden de resultaten per queue gecombineerd. De interne keuze `all` wordt **niet** als `mediaType` naar de Genesys API gestuurd: de mediafilter wordt dan weggelaten. De betekenis en beschikbaarheid van bepaalde metrics kunnen per mediatype verschillen.

**Actieve queues:** je kunt alleen queues selecteren waarvan je zelf lid bent. Standaard toont de tabel de geselecteerde queues waarin je volgens het queue-lidmaatschap actief (`joined`) bent. Met **Alle geselecteerde queues tonen** verschijnen ook de overige geselecteerde queues. De selectie zelf verandert niet.

### 2. Live Waiting en Longest Waiting

Voor de huidige datum haalt de applicatie actuele `oWaiting`-observaties op uit de Genesys Queue Activity API.

- **Waiting:** het aantal wachtende interacties, opgeteld over de getoonde queues en — bij Alle media — over mediatypes.
- **Wait Time / Longest Waiting:** de tijd sinds de **oudste** `observations[].observationDate` van de wachtende interacties. Dit is geen optelling van wachttijden.
- De tijdteller loopt **iedere seconde lokaal** op; de livegegevens worden ongeveer **iedere drie seconden** opnieuw opgehaald.
- Bij nul wachtenden wordt **—** getoond. Bij ontbrekende of onbruikbare tijdstempels wordt geen wachttijd verzonnen.
- Bij historische datums worden de livekolommen niet gevuld.

Voor de Totalen-regel is de bedoelde Longest Waiting de **langst wachtende interactie over alle getoonde queues**, niet de som van de wachttijden. Controleer deze totalen in de eigen tenant.

### 3. Mijn prestaties

Zes compacte kaarten tonen de prestaties van de ingelogde gebruiker binnen de geselecteerde queues:

**Handle · Transfer · Avg Handle · Avg Talk · Avg ACW · ASA**

De gekozen datum en het mediatype zijn ook van toepassing op deze kaarten. Let op: de precieze toerekening van persoonlijke ASA en transfers moet nog worden vergeleken met Genesys-rapportages op conversatieniveau.

### 4. Agentenoverzicht

Het tabblad **Agenten** ontdekt automatisch de leden van **alle queues waarvan de ingelogde gebruiker lid is**, onafhankelijk van de voor het dagrapport aangevinkte queues. Dubbele agenten worden op Genesys User ID samengevoegd. Een handmatig ingestelde Genesys Group ID is niet nodig.

Het overzicht toont:

- naam en Genesys-presencestatus;
- **Tijd in status**, iedere seconde oplopend als een bruikbaar starttijdstip beschikbaar is;
- een telefoonicoon bij routingstatus `INTERACTING`;
- sortering op **langste Tijd in status bovenaan**; onbekende starttijden onderaan.

Standaard worden **Offline, Unavailable, Out of Office** en agenten met **Onbekend** verborgen. Met **Ook niet-beschikbare agenten tonen** worden deze zichtbaar. **Onbekend** betekent dat de status niet betrouwbaar uit de API kon worden bepaald; het wordt niet automatisch vertaald naar Offline. Custom presence-benamingen kunnen aanvullende validatie vereisen.

Agentgegevens worden ongeveer **iedere 15 seconden** vernieuwd zolang het tabblad zichtbaar is.

### 5. Bedieningsgemak

- Instellingenvenster met queueselectie, **maximaal zes** prestatiestatistieken en herstel van de standaardselectie.
- Eén handmatige vernieuwknop, afgestemd op het geopende tabblad.
- Automatisch laden bij aanmelden en bij wijziging van datum, mediatype of selectie.
- Performancecijfers worden voor vandaag ongeveer **iedere 30 seconden** ververst; historische cijfers niet automatisch.
- Live- en performance-tijdstempels in de bedieningsbalk.
- Refreshes worden gepauzeerd wanneer het browservenster niet zichtbaar is; de app probeert overlappende aanvragen en HTTP 429-rate-limitproblemen te beperken.
- Huisstijlkleur centraal in `style.css`: `--primary-color: #1A2B67`.
- Knop voor een afzonderlijke pop-up. De browser bepaalt of de adresbalk zichtbaar blijft; volledig zonder adresbalk kan bijvoorbeeld via Edge-appmodus. **Always on top** is geen browserfunctie, maar kan op Windows via Microsoft PowerToys (`Win + Ctrl + T`).

## Installatie en hosting

De applicatie bestaat uit drie statische bestanden in de root van de website:

```text
index.html
app.js
style.css
```

Er is **geen backend, database of `config.js` nodig**. De webhosting levert alleen de statische bestanden; de browser communiceert rechtstreeks met de Genesys Cloud API.

### GitHub Pages

1. Zet de drie bestanden in de repository.
2. Open **Settings → Pages** en kies **Deploy from a branch**, `main`, `/(root)`.
3. Gebruik de gepubliceerde HTTPS-URL als start- en OAuth-redirectadres.
4. Na een update kan het nodig zijn de Client Application te sluiten en opnieuw te openen. De verwijzingen naar CSS en JavaScript bevatten een versieparameter tegen verouderde browsercache.

De applicatie kan ook op eigen HTTPS-webhosting worden geplaatst, bijvoorbeeld onder `https://www.dewitonline.nl/analytics/`.

### Genesys Cloud OAuth

Maak in Genesys Cloud Admin een OAuth-client aan met **Authorization Code Grant + PKCE** voor een publieke browserclient. Er hoort **geen client secret in JavaScript**. Configureer de exacte redirect-URL die bij de daadwerkelijke hosting en integratie hoort, inclusief pad en afsluitende slash waar van toepassing. Controleer of de tenant en OAuth-configuratie deze browserflow toestaan.

De gebruikte OAuth-scopes zijn onder andere:

```text
analytics:readonly
groups:readonly
presence:readonly
routing:readonly
users:readonly
```

`groups:readonly` is afkomstig uit de eerdere configuratie; de huidige agentdiscovery gebruikt queueleden in plaats van groepsleden. Of deze scope verwijderd kan worden, moet met de werkelijke benodigde rechten worden gecontroleerd. **Scopes alleen zijn niet genoeg:** ook de Genesys-rollen, permissies en divisietoegang van de ingelogde gebruiker bepalen welke data beschikbaar is.

De regio en OAuth Client ID kunnen via de interface worden opgeslagen of via URL-parameters worden meegegeven:

```text
https://JOUW_DOMEIN/analytics/?clientId=JOUW_CLIENT_ID&region=mypurecloud.de
```

De Client ID is geen geheim. Gebruik nooit een client secret of access token in de URL.

### Genesys Cloud Client Application

Configureer de gehoste HTTPS-URL als Client Application Integration in Genesys Cloud. Afhankelijk van iframe-, CSP- en OAuth-beleid van de organisatie werkt de applicatie ingebed of moet zij in een extern venster worden geopend. Een apart venster kan ook handig zijn voor gebruik naast de Genesys-interface.

## Technische opzet

**Authenticatie:** OAuth Authorization Code + PKCE (SHA-256) en state-controle. Access tokens blijven in het geheugen van de pagina; de tijdelijke PKCE-verifier en state staan in `sessionStorage`. Regio, Client ID en gebruikersselecties worden lokaal in de browser opgeslagen. Na een herstart of verlopen token kan opnieuw aanmelden nodig zijn.

**Belangrijkste Genesys Cloud API's:**

| Endpoint | Doel |
| --- | --- |
| `GET /api/v2/users/me` | Ingelogde gebruiker |
| `GET /api/v2/users/{userId}/queues` | Eigen queue-lidmaatschappen en `joined`-indicatie |
| `GET /api/v2/routing/queues/{queueId}/members` | Leden van queues, inclusief paginering |
| `GET /api/v2/users/{userId}/presences/purecloud` | Presence en tijdstempels |
| `GET /api/v2/users/{userId}/routingstatus` | Routingstatus / interactie-indicator |
| `POST /api/v2/analytics/conversations/aggregates/query` | Queue- en persoonlijke dagstatistieken |
| `POST /api/v2/analytics/queues/observations/query` | Live `oWaiting` en observatietijdstempels |
| `GET /oauth/authorize` en `POST /oauth/token` | Aanmelden en tokenuitwisseling op de regionale login-host |

De regionale API- en login-host worden bepaald door de ingestelde Genesys Cloud-regio. De app ondersteunt paginering voor queueleden en queue-lidmaatschappen.

## Bekende beperkingen en aandachtspunten

- **Validatie:** vergelijk Offered, Answered, Service Level, persoonlijke ASA, transfers, gecombineerde media en de Totalen-regel met de officiële Genesys Cloud-schermen en API-responses.
- **Longest Waiting:** de berekening is afhankelijk van aanwezige, correcte `observationDate`-waarden in de live `oWaiting`-observaties.
- **Presence:** ontbrekende tijdstempels of rechten kunnen leiden tot **Onbekend** of een ontbrekende Tijd in status.
- **Tijdzone:** de dagintervalberekening is gebaseerd op de lokale browserdatum/-tijd. Controleer tijdzone en zomer-/wintertijd bij rapportage over daggrenzen.
- **Divisies en autorisatie:** de app toont queueleden en data binnen de toegestane Genesys-rechten. Een zichtbaarheidfilter in de browser is **geen beveiligingsgrens**.
- **Schaalbaarheid:** het agentenoverzicht kan veel presence- en routingaanvragen veroorzaken wanneer iemand lid is van veel grote queues. Batching/caching en rate-limitgedrag verdienen verdere optimalisatie.
- **Beschikbaarheid:** dit is een statische browserapp zonder server-side monitoring of garanties op uptime. Een normale pop-up kan geen always-on-top of verborgen adresbalk afdwingen.

## Versiehistorie

| Versie | Belangrijkste wijziging |
| --- | --- |
| **0.3.23** | Agenten optioneel en hoofdkleur instelbaar via URL-parameters |
| **0.3.22** | Ingebouwde helpknop en dynamisch geladen, Nederlandstalige `HELP.md` voor eindgebruikers |
| **0.3.20** | Extra bescherming tegen ongeldige `mediaType=all`-filters; correcte versievermelding en cache-busting |
| **0.3.19** | **Alle media** combineren; titel **Dagcijfers - [mediatype]** |
| **0.3.18** | Compactere pop-upinstellingen; overbodige `config.js`-verwijzing verwijderd |
| **0.3.17** | Longest Waiting vanaf oudste `observationDate`; live oplopende tijdtellers voor wachttijd en agentstatus |
| **0.3.16** | Centrale CSS-huisstijlkleur; verbetering wachttijdberekening; agenten op Tijd in status sorteren |
| **0.3.15** | Aangepast filter voor niet-beschikbare agenten en kleur **#1A2B67** |
| **0.3.14** | Automatische agentdiscovery via queueleden; filter op actieve geselecteerde queues |
| **0.3.13** | Refresh-tijdstempels verplaatst en interface opgeschoond |
| **0.1** | Eerste prototype met OAuth PKCE en basisanalytics |

## Veiligheid en verdere ontwikkeling

Publiceer geen access tokens, client secrets, gebruikersgegevens of ongeschoonde API-responses in GitHub. Gebruik HTTPS, beperk Genesys-permissies tot wat nodig is en test nieuwe releases eerst in een geschikte demo- of testomgeving.

Mogelijke vervolgstappen zijn geautomatiseerde tests met geanonimiseerde API-fixtures, expliciete tijdzoneafhandeling, verbeterde batchverwerking voor grote agentenpopulaties, duidelijkere API-foutmeldingen en optionele exportmogelijkheden.

---

**Genesys Queue Analytics** · Statische Genesys Cloud analytics-webapp · **v0.3.23**


### Help op verschillende webservers

De helpknop laadt eerst `HELP.html`, omdat sommige webservers directe toegang tot `.md`-bestanden blokkeren met HTTP 403. Als `HELP.html` ontbreekt, probeert de app `HELP.md`. Publiceer beide bestanden naast `index.html` en `app.js`. De paden zijn relatief aan de applicatie en werken daardoor ook bij een andere host of submap.
