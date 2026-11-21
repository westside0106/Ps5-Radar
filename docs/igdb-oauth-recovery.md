# IGDB OAuth 403 · Produktion, Fallback und Wiederholungsintervalle

## Bestätigter Befund, 21. November 2026
In den Vercel-Produktionslogs steht bei `GET /mein-playstation` mehrfach
`PSN IGDB metadata fallback: IGDB OAuth 403`.
Auch die private Tageshistorie vom 21.11.2026 meldete für IGDB `Authentifizierung abgewiesen (HTTP 403)`.
Das ist eine **Twitch-OAuth-Antwort**, nicht der Nachweis eines defekten IGDB-Games-Endpunkts. Die genaue Ursache der Ablehnung (z. B. widerrufener Secret, falsche Anwendung, Anbieterrestriktion) ist daraus nicht ersichtlich.

Offizielle Quellen:
- https://dev.twitch.tv/docs/authentication/register-app/
- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
- https://api-docs.igdb.com/

## Fehlerbehebung durch den Kontoinhaber
1. In https://dev.twitch.tv/console/apps die zu IGDB gehörige Twitch-Entwickler-Anwendung prüfen. Client-ID, Secret und App-Konfiguration abgleichen.
2. Auf Vercel im Projekt `playstation-radar-private` die Existenz der beiden **Production**-Variablen `IGDB_CLIENT_ID` und `IGDB_CLIENT_SECRET` kontrollieren. Secrets nicht in Chats, Logs, Browser oder Git einfügen.
3. Nur bei nachgewiesener falscher/alter Secret-Konfiguration einen neuen Secret erzeugen. Twitch weist darauf hin, dass ein neuer Secret frühere Secrets ungültig machen kann; betroffene andere Integrationen berücksichtigen.
4. Korrektur über die Vercel Environment-Variables-Oberfläche vornehmen und **neu auf Production deployen**. Danach über `/zentrale?tab=quellen` einen neuen IGDB-Live-Test auslösen.
5. Wenn die Anmeldung trotz korrekter App weiter 403 liefert, nicht wiederholt blind Secrets rotieren. Twitch-App-Status / API-Berechtigungen und Anbieterstatus prüfen.

## Automatische Schadensbegrenzung
Der private PSN-Metadatenabruf verwendet ab diesem Update ein in-memory OAuth-Token-Management pro laufender Serverinstanz:
- Nach **401/403**: bis zu 30 Minuten keine erneuten *Metadaten-Tokenanfragen* derselben Serverinstanz.
- Nach **429**: 5 Minuten; bei Netzwerk-, Format- und anderen HTTP-Fehlern: 1 Minute.
- Gleichzeitige Tokenanfragen derselben Instanz werden zu einer einzigen Anfrage zusammengefasst.
- Erfolgreiche Zugriffstokens werden nur serverseitig bis kurz vor Ablauf zwischengespeichert; rotierte Credentials setzen die Token-/Negativcaches zurück.
- Bereits vorhandene PS-Plus-Katalog-Metadaten, PSN-Playtimes, Trophäen und historische Insights werden weiterhin unverändert dargestellt. Fehlen live geladene IGDB-Screenshots, wird dies nicht als fehlende gesamte PSN-Sammlung interpretiert.
- Die eigene, geschützte **Live-Quelle-Diagnose** stellt weiterhin echte OAuth-Prüfanfragen und ist bewusst unabhängig vom Metadaten-Backoff. In Vercel Serverless ist der Backoff **instanzlokal**, keine verteilte globale Abschaltung.

## Zusätzliche Datenkorrektur
Bei mehreren Cloud-Monitor-Snapshots fragt die Quellenprüfung jetzt ausdrücklich den zuletzt empfangenen Upload über `order=received_at.desc&limit=1` ab, statt einen beliebigen ersten Datensatz als aktuell zu interpretieren. Eine erfolgreiche Abfrage allein beweist weiterhin nicht, dass alle Uploads oder Spielzeiten vollständig sind.

Regressionen: `scripts/test-igdb-oauth-backoff.mjs`, `scripts/test-source-health.mjs` und bisherige private Browser-Smoke-Tests.
