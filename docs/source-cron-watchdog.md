# PS5-Radar · unabhängiger Quellen-Cron-Wächter

## Zweck
Der reguläre Quellen-Check läuft täglich um **09:00 UTC** (`GET /api/radar/source-health`). Seit #96 werden Ausführungen und Ergebnisse in `radar_source_scan_runs` protokolliert. Ein guter API-Zustand ist dabei **kein Beweis**, dass Vercel den Tagescheck wirklich ausgelöst hat.

Ein zweiter, **separater Vercel-Cron** wertet die Ausführungsnachweise einmal täglich um **11:15 UTC** aus:
`GET /api/radar/source-watchdog`.
Vercel kann insbesondere auf dem Hobby-Plan verzögert innerhalb der geplanten Stunde auslösen. Der Abstand zum regulären Cron lässt dessen **09:00–10:00-UTC-Zeitfenster** auslaufen und gibt zusätzlich einen Puffer.

Die tägliche Entscheidung wird in `public.radar_source_cron_watchdog` mit `run_day` als Primärschlüssel archiviert. Es entstehen keine rückdatierten Einträge.

## Statusmodell
- `ok`: mindestens ein automatischer Quellen-Scan wurde an diesem UTC-Tag mit `success` abgeschlossen. Das sagt **nichts** darüber aus, ob alle externen Provider erfolgreich waren.
- `failed`: ein geplanter Quellen-Scan ist fehlgeschlagen, ohne dass am selben UTC-Tag ein anderer geplanter Scan erfolgreich war.
- `unfinished`: ein gestarteter geplanter Scan wurde nach fünf Minuten noch nicht abgeschlossen; ein aktuell noch laufender Scan wird vorerst `pending` und noch nicht festgeschrieben.
- `unconfirmed`: **kein Cron-Lauf protokolliert**, aber sechs gespeicherte Tagesmessungen liegen vor. Das kann ein verlorener Audit-Eintrag oder ein manuell erzeugter Tagesbefund sein; keine unbewiesene Aussage über Vercel.
- `missing`: kein geplanter Cron-Lauf protokolliert und weniger als sechs Tagesbefunde vorhanden.
- `not_due`: vor 11:00 UTC; der Wächter schreibt und sendet dann nichts.

Ein Status `missing` bzw. `unconfirmed` ist ein **Hinweis auf fehlende Bestätigung**, kein Beweis dafür, dass die Ausführung nie stattgefunden hat. Ein vollständig ausgefallener Vercel-Dienst könnte auch den Watchdog selbst verhindern.

## Datensparsame Benachrichtigungen
- Für jeden UTC-Tag wird ein **einziger, unveränderlicher** Wächter-Befund eingefügt, auch bei mehrfachen Cron-Invocations. Der Konfliktfall gibt den gespeicherten Befund zurück.
- Bei `failed`, `unfinished`, `missing` oder `unconfirmed` wird eine **generische** Warnung über die bestehende serverseitige ntfy-Konfiguration verschickt. Keine Kontonamen, Passwörter, Spielzeiten, Titel oder Provider-Rohdiagnosen.
- Für ntfy gilt eine **atomare 10-Minuten-Lease** mit Token und Abschlussquittierung. Die Meldung wird nur dann als zugestellt gespeichert, wenn ntfy sie angenommen und die Datenbank das bestätigt hat.
- Nicht zugestellte Meldungen bleiben in der Warteschlange. Ein späterer Wächterlauf kann bis zu sechs alte Meldungen erneut versuchen; dies ist bewusst **at least once**, im Randfall kann eine Mitteilung doppelt ankommen.
- Ohne eingerichtetes ntfy wird die Abweichung trotzdem gespeichert, aber **nicht** als versendete Warnung gemeldet.
- Ein fehlerhafter ntfy-Kanal darf das Ergebnis der Tageskontrolle nicht löschen.

## Sicherheit
- Beide Cron-Endpunkte prüfen denselben langen `CRON_SECRET` mit zeitkonstantem Vergleich und liefern auf fehlende/falsche Autorisierung **401**.
- `GET /zentrale/api/source-watchdog` ist ausschließlich mit Radar-Session zugänglich und sendet `private, no-store`.
- Die SQL-Migration `supabase/source-cron-watchdog.sql` aktiviert Row-Level Security und entzieht `anon` und `authenticated` sämtliche Zugriffe. Nur `service_role` darf auswählen, anlegen und aktualisieren.
- Die Tabelle speichert ausschließlich UTC-Tag, Status, Anzahl protokollierter Läufe, Anzahl vorhandener Tagesbefunde sowie generische Push-Quittungsdaten.

## Oberfläche und Grenzen
Unter **Quellen → CRON-WÄCHTER & FEHLERHINWEISE** wird der heutige Stand sowie die letzten sieben archivierten Wach-Tage angezeigt. Vor dem ersten Cron nach dieser Version bleibt die Historie leer; der Benutzer kann die Ansicht manuell aktualisieren.

**Unverändert**: tägliche Quellenprüfung, ihre ursprüngliche Störungsalarmregel (zwei problematische Tage), die Preisalarm-Kette, Ubuntu/PSN-Monitor-Uploads, ntfy-Topic und die bestehende Sofortprüfungs-Sperre. Die neue Prüfung schreibt keine künstlichen Provider-Tagesbefunde und triggert keinen zusätzlichen PSN-/Twitch-API-Call.

## Tests
`scripts/test-source-cron-watchdog.mjs` prüft UTC-Grenzen, vorzeitige Prüfung, echte und fehlende Cron-Läufe, konservative Einstufung, Secret-Hygiene, einmaligen Versand trotz mehrfacher Cron-Invocations und ausbleibende Push-Bestätigung bei Fehlern. Die Chromium/WebKit-Suite kontrolliert private API-Rechte und das mobile Watchdog-Dashboard.
