# PS5-Radar · Statushistorie und tägliche Quellenalarme

## Zugriff
Unter `/zentrale?tab=quellen` erscheint unter dem On-Demand-Monitor eine Historie mit 14 Tagesfeldern je Anbieter und einer privaten Meldungszentrale. Die zugrunde liegende `GET /zentrale/api/source-history`-Route erfordert eine gültige Radar-Session. Über `PATCH` mit einer gültigen Meldungskennung lässt sich ein Hinweis als gelesen markieren.

## Zeitplan und Erkennung
`vercel.json` enthält einen zweiten, täglich um **09:00 UTC** startenden Cron (`GET /api/radar/source-health`). Dieser ist wie der unveränderte Preisalarm um 08:00 UTC durch den bereits eingerichteten `CRON_SECRET` geschützt. Ausführung nur auf der Production-Umgebung.

Jeder Lauf prüft PSN, IGDB, RAWG, SteamGridDB, Supabase-Profil und Supabase-Monitor mit dem gleichen serverseitigen Diagnosekern wie die Live-Ansicht. Pro UTC-Tag und Anbieter wird höchstens eine Zeile gespeichert (Datenbank-Primärschlüssel). Der erste Tagesbefund bleibt dauerhaft unverändert; spätere gespeicherte Prüfungen aktualisieren ausschließlich den letzten Status und erzeugen bei einer echten Änderung separate Statuswechsel-Einträge (Details in `docs/source-health-transitions.md`). Der Posteingang erstellt:
- **Störungsmeldung**, wenn der aktuelle und der unmittelbar vorherige UTC-Kalendertag den Zustand `error` oder `degraded` hatten und noch kein fortlaufender Ausfall bestätigt ist.
- **Wiederherstellungsmeldung**, wenn auf mindestens zwei problematische Tagesprüfungen eine `healthy`-Prüfung am folgenden Tag folgt.
- `unconfigured` ist kein Anbieter-Ausfall und erzeugt keine Störungsmeldung. Fehlende Tage werden nicht als gesund eingestuft.
- Wiederholte Aufrufe am selben Tag erzeugen durch `on_conflict=ignore-duplicates` keine Duplikate.

Tageshistorie ist **keine** Echtzeit-SLA-Erfassung. Optionaler iPhone-Push über ntfy ist in `docs/source-health-ntfy-push.md` dokumentiert und über einen privaten, zufällig erzeugten Topic konfiguriert. E-Mail-Versand ist nicht implementiert. Vorliegende Meldungen sind dauerhaft gespeichert, bis eine spätere Aufbewahrungsregel ergänzt wird.

## Datenmodell
`public.radar_source_health_checks`: Quelle, UTC-Tag, unveränderlicher erster Tagesbefund und separat letzter gespeicherter Status mit Zeitpunkten.

`public.radar_source_health_events`: idempotente Störungs- und Erholungsmeldungen mit optionalem Lesezeitpunkt.

`public.radar_source_health_transitions`: getrenntes, zugriffsgeschütztes Protokoll jeder Änderung des zuletzt gespeicherten Status.

Migration im Repository: `supabase/source-health-history.sql`; RLS aktiviert, keine Policies für `anon` oder `authenticated`, alle Tabellenrechte für diese Rollen entzogen. Nur serverseitiger `service_role`-Zugriff. Die neuen Tabellen enthalten keine Credentials, privaten Trophäen oder Spielzeiten.

## Qualität
- `npm run test:psn` enthält deterministische Szenarien für zwei aufeinanderfolgende Fehler, Isoliertfehler, Wiederherstellung, fehlende Tage, doppelte Cron-Ausführung und sichere Ereignisbestätigungen.
- `scripts/test-psn-browser-smoke.mjs` kontrolliert die geschützten Endpunkte sowie die mobile 14-Tage-Ansicht in Chromium und WebKit.
- Die bestehende automatische PSN-Monitor-Upload-Pipeline und die Preisalarmtabellen werden nicht verändert.
