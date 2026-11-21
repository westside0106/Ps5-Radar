# PS5-Radar · erster und letzter Tagesstatus, Statuswechsel

## Datenmodell
Die bisherige private Tabelle `radar_source_health_checks` bewahrt den **allerersten gespeicherten** Messwert jedes UTC-Tages unverändert:
- `checked_at`, `status`, `detail` und `last_data_at` bleiben der Tagesbasiswert.
- `latest_checked_at`, `latest_status`, `latest_detail` und `latest_last_data_at` geben den **letzten erfolgreich gespeicherten** Tagesbefund an.
- Auch bei parallelen Serverläufen darf ein älterer Messzeitpunkt keinen neueren überschreiben (bedingter PostgREST-PATCH mit Datumskontrolle).
- Ein Datenbanktrigger erfasst jede echte Änderung von `latest_status` atomar in `radar_source_health_transitions` (Vorher-Nachher-Status, beide Zeitpunkte, Quelle). Die neuen Datenbanktabellen sind privat mit RLS und ohne Rechte für `anon`/`authenticated`.

Die Migration in `supabase/source-health-day-transitions.sql` fügt die neuen Felder **nullable und rückwärtskompatibel** hinzu und initialisiert sie anhand bereits vorhandener Tageswerte. Das schützt auch ein mögliches Rollback auf einen älteren App-Commit.

## Benutzeroberfläche
Auf der Quellen-Seite bleibt die 14-Tage-Historie erhalten. Jedes Tagesfeld ist nach dem ersten Zustand eingefärbt; bei späterem geändertem Tagesstatus zeigt die rechte Hälfte den letzten Zustand. Unter dem Tagesstreifen stehen der **erste Tagesbefund** und der **letzte gespeicherte Status** mit Uhrzeiten. Daneben erscheint ein eigenständiger Zeitverlauf aller erfassten Statuswechsel.

**Wichtig:** Die normalen Browser-Live-Prüfungen (ca. alle drei Minuten bei sichtbarem Tab) sind weiterhin Momentaufnahmen, die nicht in die Tagesdatenbank geschrieben werden. Nur eine authentifizierte, gespeicherte Sofortprüfung oder der tägliche Server-Cron aktualisieren den letzten Datenbankstand. Die private Live-Diagnose zeigt unabhängig davon den momentan abgefragten Providerzustand.

## Alarme bleiben streng getrennt
Die Störungsmeldungen und ntfy-Zustellungen werden ausschließlich aus den **ersten Tagesbefunden zweier direkt aufeinanderfolgender UTC-Tage** ermittelt. Wiederholte Prüfungen ändern keine früheren Tagesbasiswerte, erzeugen keine zusätzlichen Störungsalarme und verändern den Schwellwert nicht. Ein Statuswechsel in der neuen Verlaufsliste ist **keine** Alarmmeldung.

## Kein fiktiver rückwirkender Verlauf
Der am 21.11.2026 um 04:34 Uhr gespeicherte IGDB-Fehler ist vorhanden. Die Screenshots der erfolgreichen Live-Prüfung um 04:56 Uhr belegen eine spätere Erholung, **aber der alte App-Stand hat diesen späteren Zustand nicht in der Datenbank archiviert**. Deshalb wird nicht vorgegeben, dass ein sekundenexakter Statuswechsel bereits gespeichert sei. Ab dem ersten neuen erfolgreichen gespeicherten Prüfstand nach dem Deployment erscheinen Erst-/Letztstatus und Wechsel korrekt und nachvollziehbar.

## Regressionen und Datenschutz
- Node-Tests sichern Tagesbasis-Unveränderlichkeit, bedingte spätere Updates, keine doppelten Tagesalarme.
- Chromium/WebKit testen 14-Tage-Felder mit zwei Farben, Statuswechsel und mobile Darstellung.
- Der Datenbanktrigger wurde in einer absichtlich zurückgerollten SQL-Transaktion mit zwei aufeinanderfolgenden Wechseln geprüft; keine Testdaten blieben zurück.
- Alle privaten Status-APIs bleiben durch die existierende Radar-Session gesichert. Provider-Secrets oder private Spielinhalte werden nicht gespeichert.
