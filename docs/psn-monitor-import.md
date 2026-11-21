# PSN Monitor – beobachtete Spielsitzungen importieren

## Grundlage

Datenquelle ist das externe Projekt [misiektoja/psn_monitor](https://github.com/misiektoja/psn_monitor), Lizenz **GPL-3.0**. PS5-Radar **kopiert keine Quellcodes** aus diesem Projekt, sondern liest dessen öffentlich dokumentiertes CSV-Protokoll über eine unabhängige Implementierung ein.

Upstream schreibt mit `csv.DictWriter` die folgenden Felder (in exakt dieser Reihenfolge):

```csv
"Date","Status","Game name"
"2026-11-20 10:00:00","online","Cyberpunk 2077"
"2026-11-20 11:00:00","online","Bloodborne"
"2026-11-20 12:30:00","offline",""
```

Die Spalte `Date` entsteht mit `datetime.now(pytz.timezone(LOCAL_TIMEZONE)).replace(tzinfo=None)`. **Im CSV fehlen dadurch UTC-Offset und IANA-Zeitzone.** Auch zwei identische Herbst-Zeitstempel können zwei verschiedene tatsächliche Zeiten meinen. Eine korrekte Zeitzonen-Auswahl beim Import ist zwingend.

## Import

1. Starte `psn_monitor` **ausschließlich in deiner eigenen Umgebung**, wenn du beobachtete Spielaktivitäten sammeln willst. Die offizielle Projektanleitung beschreibt `pip install psn_monitor`, `psn_monitor --setup` und `psn_monitor <PSN-Online-ID> -b changes.csv`. Den persönlichen NPSSO-Wert niemals in GitHub, Browser-Logs oder Support-Kommentaren veröffentlichen.
2. Öffne PS5-Radar → **Meine Spielwelt → Gaming-Chronik & Statistiken → Session Monitor** (oder verwende den Schnellzugriff auf dem Command Deck).
3. Wähle die **Zeitzone des Rechners, auf dem der Monitor lief** – oft `UTC` auf Ubuntu-Servern, `Europe/Berlin` auf einem deutschen Rechner. Nicht automatisch die iPhone-Zeitzone einsetzen.
4. Wähle die lokale CSV-Datei (max. 2 MB, maximal 20.000 Zeilen). Der Browser liest die Datei lokal, ohne sie an Vercel oder Sony zu senden.
5. Prüfe die Vorschau mit abgeschlossenen Intervallen und ausgeschlossenen Auffälligkeiten. Nur nach deinem Klick auf **Prüfung bestätigen & importieren** werden die Intervalle gespeichert.
6. Wiederholte Importe werden anhand Spieltitel, Anfang und Ende dedupliziert. Maximal 2.000 gültige Intervalle werden lokal gehalten (die neuesten bleiben).

## Semantik

- `online + Game name` beginnt die **erste beobachtete** Spielphase. Nicht der echte Startzeitpunkt.
- Eine spätere Meldung mit anderem Spiel, ohne Spiel oder `offline` beendet das beobachtete Intervall. Nicht zwingend der tatsächliche Endzeitpunkt.
- Mediaplayer wie YouTube und Netflix zählen nicht als Spiele.
- Ein Wechsel auf einen unbekannten Status unterbricht die Zuordnung. Eine laufende, am Dateiende nicht abgeschlossene Phase wird **nicht** zu einer erfundenen Session ergänzt.
- Zeitintervalle über **12 Stunden** werden als potenziell durch Monitor-Ausfälle verfälscht ausgeschlossen.
- Mehrdeutige Herbst-Zeitstempel und nicht existierende Frühjahrs-Zeitstempel werden **nicht** interpretiert. Solche Zeilen unterbrechen offene Intervalle.
- Zeitlich ungeordnete CSV-Zeilen werden nicht vorsorglich sortiert, da das eine unbelegte Ereignisfolge erzeugen könnte.
- Der Import ist **keine kontinuierliche Echtzeitverbindung**. Neue CSV-Änderungen erscheinen erst nach erneutem Import.

## Datenschutz & Backup

- Roh-CSV bleibt im Browser und wird nicht serverseitig hochgeladen.
- Ausgewertete Intervalle werden zunächst unter `psn-observed-game-sessions-v1` im Browser gespeichert.
- Das vorhandene **vollständige JSON-Backup** nimmt diese Intervalle mit auf.
- Die vorhandene **optionale Cloud-Sicherung** nimmt sie ebenfalls mit auf, wenn sie vom Nutzer aktiviert wird. Wiederherstellung dedupliziert bekannte Intervalle, statt sie zu überschreiben.
- Der existente passwortgeschützte PS5-Radar-Zugriff schützt den Zugriff auf die App, ersetzt aber nicht den Schutz persönlicher Aktivitäts- und PSN-Token-Daten. Der neue Import benötigt und speichert **keine NPSSO-/OAuth-Tokens**.
- Bestehende Supabase-Tabellen und ihre Zugriffsrechte bleiben unverändert; es wird lediglich ein optionales Array im vorhandenen privaten Profil-JSON gespeichert.

## QA und Release

- `npm run test:psn`: CSV-Quoting, DST-Lücken/-Mehrdeutigkeit, Server-Zeitzone, Statuswechsel, Medienapps, 12h-Sperre, Import-Deduplizierung, Backup-Schema.
- `npm run build`: Next.js-Kompatibilität.
- Browser-Smoke in Chromium und WebKit bei iPhone-Breiten: CSV-Dateiupload, Vorschau, 60-/90-Minuten-Intervalle, Speicherung, erneuter Import ohne Duplikate und Screenshot.
- Für echte Daten: In der Monitor-Konfiguration prüfen, welche `LOCAL_TIMEZONE` tatsächlich gesetzt ist; falls unbekannt, noch **nicht** importieren.

## Noch nicht enthalten

Kein Hintergrunddienst, kein Live-Socket, keine Fernsteuerung von `psn_monitor`, keine automatische Übernahme einer Serverdatei, keine minutengenaue Sony-Spielzeiterfassung. Dies erfordert gesondert abgesicherte Übertragung zwischen dem eigenen Server und der App sowie ausdrückliche Zugangskonfiguration.
