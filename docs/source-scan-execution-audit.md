# PS5-Radar · private Ausführungsprotokolle für Quellenchecks

## Ziel
Ein gesunder API-Anbieter beweist nicht, dass der täglich geplante Vercel-Cron tatsächlich ausgeführt wurde. Die neue private Übersicht **PRÜFPROTOKOLL UND CRON-STATUS** unterscheidet deshalb tatsächliche Ausführungen von den sechs diagnostizierten Provider-Zuständen.

## Datenmodell und Schutz
`public.radar_source_scan_runs` enthält einen pro Ausführung zufälligen UUID-Schlüssel, Startzeit, optionalen Abschlusszeitpunkt, Auslöser (`scheduled` oder `manual`), Laufstatus (`running`, `success`, `failed`), Dauer und ausschließlich aggregierte Provider- und ntfy-Zähler.

Die SQL-Migration steht in `supabase/source-scan-execution-audit.sql`. RLS ist aktiv, `anon` und `authenticated` besitzen keine Tabellenrechte. Nur der private Server-Service-Role-Zugriff ist freigeschaltet; die API `GET /zentrale/api/source-runs` erfordert dieselbe Radar-Session wie die übrige Zentrale.

**Nicht gespeichert:** API-Schlüssel, Twitch-Tokens, Rohfehler, private PSN-Kontoinhalte, individuelle Spiele und weitere nutzerbezogene Detaildaten. Im Fehlerfall wird nur der feste Code `scan_failed` protokolliert.

## Aufzeichnung
- Der bestehende täglich für **09:00 UTC** konfigurierte Vercel-Cron erhält einen Protokolleintrag vor der eigentlichen Diagnose.
- Der geschützte Button **JETZT PRÜFEN & MELDUNGEN SENDEN** schreibt ebenfalls einen Eintrag, aber **erst nach** erfolgreicher 10-Minuten-Reservierung.
- Nach der Diagnose markiert der Server den Eintrag als `success` oder `failed`, mit Dauer, Summen und der Anzahl an von ntfy **angenommenen** Meldungen.
- Ein unterbrochener Prozess ohne ordentlichen Abschluss hinterlässt `running`, das nach zwei Minuten als **Ohne Abschluss** angezeigt wird.
- Wenn das Protokoll selbst vorübergehend nicht geschrieben werden kann, wird die Quellenprüfung **nicht** unterbunden; im Antwortobjekt steht `audit.recorded=false`. Auch ein Fehler beim Abschluss-UPDATE wird nicht fälschlich als Erfolg der Protokollierung angegeben.

## Zeitplan-Aussage
Die Ansicht unterscheidet: Cron heute vorhanden, noch vor 09:00 UTC, im geplanten Ausführungsfenster 09:00–10:00 UTC, oder nach dem Fenster ohne protokollierten Lauf. **„Kein Eintrag“ ist kein Beweis für einen nicht gelaufenen Cron**, beispielsweise wenn der Protokollspeicher nicht erreichbar war. Die Uhrzeit ist UTC; in Deutschland entspricht 09:00 UTC je nach Jahreszeit 10:00 oder 11:00 Uhr.

Das ist ein Protokoll tatsächlicher Ausführungen, keine neue oder zusätzliche Überwachung. `vercel.json`, Preisalarme, bestehende PSN-Uploader, die Zwei-Tage-Störungsmeldungsregel und die ntfy-Topic-Konfiguration bleiben unverändert.

## Kein künstlicher Rückblick
Es werden nur echte Läufe **ab Deployment dieser Version** als Protokolleinträge angezeigt. Alte Tagesmessungen und der bereits bekannte erfolgreiche iPhone-Test werden nicht rückwirkend als neue Run-Receipts ausgegeben.

## Qualität
- `scripts/test-source-scan-audit.mjs`: Start-/Abschlussbelege, sicherer Fehlercode, fortgesetzte Providerchecks bei Audit-Datenbankausfall, fehlerhafte Quittierungen und Abfragebegrenzung.
- `scripts/test-psn-browser-smoke.mjs`: geschützte API, Anzeige von erfolgreichen manuellen versus fehlgeschlagenen geplanten Läufen, Mobile Layout in Chromium und WebKit.
- Keine DB-Tabelleninhalte werden über öffentliche Endpunkte geliefert.
