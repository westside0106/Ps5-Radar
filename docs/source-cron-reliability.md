# PS5-Radar · Betriebsnachweise der Quellen-Crons (7 / 30 Tage)

## Ausgangspunkt: echte Produktionsbefunde vom 21. November 2026
Die erste automatisierte Tagesprüfung **hat tatsächlich funktioniert**: `radar_source_scan_runs` enthält einen erfolgreichen geplanten Lauf ab 09:57:49 UTC mit sechs gesunden Anbietern. Der unabhängige Wächter hat um 11:49:51 UTC `ok` gespeichert. Die private Tagesmessung hält den ursprünglichen IGDB-Fehler vom frühen Morgen als ersten Befund fest und protokolliert die spätere Wiederherstellung um 09:57:51 UTC getrennt. Eine ntfy-Warnung war bei erfolgreichem Cron nicht nötig.

Das ursprünglich bestehende UI-Problem: `todaySchedule` erklärte jeden erfassten automatischen Lauf pauschal als positiven Nachweis, selbst wenn er `failed` oder `running` war.

## Umsetzung
Unter **Quellen → Prüfprotokoll und Cron-Status → Cron Betriebsverlauf** stehen:
- Umschalter **7 oder 30 Tage**.
- **Tage mit Cron-Nachweis:** Tage, an denen mindestens ein tatsächlich protokollierter automatischer Lauf existiert – unabhängig davon, ob er erfolgreich war.
- **Erfolgreich abgeschlossen**, **Fehler / ohne Abschluss** und **Watchdog-Tagesurteile** als getrennte Kennzahlen, jeweils ohne künstliche Prozentquote.
- Pro UTC-Tag: tatsächlicher Zustand, Startzeit in Berlin, Zeitfenster-Prüfung, unabhängiger Wächterstatus und gegebenenfalls der Nachweis einer angenommenen ntfy-Warnung.
- Bei mehreren geplanten Versuchen am selben Tag gewinnt ein tatsächlich erfolgreicher Abschluss vor vorherigen Fehlern.
- Eine fehlende Cron-Quittung wird bei vorhandenem Watchdog-`ok` nicht als bewiesener erfolgreicher Cron gewertet; das ist `Nicht bestätigt`.

## Datenquellen und Grenzen
`/zentrale/api/source-runs` bleibt privat und liefert jetzt zusätzlich:
- `scheduledRuns`: **separat abgefragte** letzte 45 automatischen Quittungen, damit zahlreiche manuelle Tests keine vergangenen Cron-Läufe aus der Übersicht verdrängen;
- `watchdogDays`: 45 Watchdog-Befunde, soweit überhaupt vorhanden;
- unverändert `runs`: die letzten 60 allgemeinen Protokolleinträge.

Die Kennzahlen sind nur **Ausführungsbelege**, keine garantierte Dienst-Uptime. Historische Tage vor Inbetriebnahme der Quittungen bleiben **Keine historischen Daten**, nicht ausgefallen oder erreichbar. Während des regulären 09:00–10:00-UTC-Fensters wird noch kein fehlender Start beanstandet. Bis zum Abschluss des Watchdog-Fensters (12:15 UTC) ist das Urteil ausstehend; selbst danach ist fehlendes Logging kein zweifelsfreier Beweis für ausgefallene Vercel-Crons.

Bei Hobby-Cron-Ausführung ist ein Start um **09:57 UTC ausdrücklich innerhalb des zulässigen Fensters**, nicht 57 Minuten verspätet. Erst ein gespeicherter Start außerhalb der Stunde wird als außerhalb des Zeitfensters markiert, ohne daraus allein einen Anbieterausfall abzuleiten.

## Unverändert
Weder der tägliche Cron um 09:00 UTC noch der Wächter um 11:15 UTC werden neu geplant. Keine Migration, neuen Tokens, ntfy-Nachrichten, Kontodaten oder zusätzlichen Providerabfragen. Die bestehenden Source- und Watchdog-APIs bleiben geschützt.

## Regressionen
`scripts/test-source-cron-reliability.mjs` prüft Zeitfenster und deren Randwerte, echte/fehlgeschlagene/abgebrochene Cron-Läufe, mehrere Versuche, inkonsistente Quittungen, 7-/30-Tage-Fenster, unbekannte Tage und UTC-Grenzen. Die Browser-Suite verifiziert den korrigierten Fehlstatus, Mobile-Layout und die neue private Auswertung.
