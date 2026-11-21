# PSN Monitor → PS5-Radar: sicherer automatischer Abgleich

## Status und Grenzen

Dieses Modul ergänzt den bereits live vorhandenen manuellen CSV-Import um einen **optionalen Server-Push**. Es startet oder verändert `psn_monitor` nicht. Es überträgt **keine NPSSO- oder Sony-Tokens**, sondern lediglich die CSV-Statusmeldungen; in Supabase werden nur die daraus abgeleiteten Intervalle gespeichert.

Vor Konfiguration ist die neue Route absichtlich inaktiv. Ein passwortgeschütztes Dashboard allein wäre **kein hinreichender Schutz** für maschinelle Uploads: diese benötigen ein separates, langes Push-Token.

## Architektur

```text
psn_monitor → changes.csv (Ubuntu)
                  │
                  ▼
   Python-Uploader (alle 10 min, systemd)
      HTTPS / Bearer (eigenes 64-stelliges Token)
                  │
                  ▼
       Next.js /mein-playstation/api/monitor-sync
          POST → CSV-Parser + Zeitkontrolle
                 → Supabase private Tabelle psn_monitor_snapshot
          GET  ← Radar-Session-Cookie, niemals Push-Token
                  │
                  ▼
     Meine Spielwelt → Session Monitor
      automatisch alle 2 min, nur wenn Tab aktiv
      sichere Zusammenführung in localStorage
```

- Der Uploader prüft die CSV, liest maximal die **letzten 1.800 vollständigen Datensätze** und beschränkt den Payload auf 1,9 MB.
- Der Next.js-Parser validiert IANA-Zeitzonen, DST-Doppeldeutigkeiten, Session-Grenzen und Duplikate. Nicht interpretierbare Übergänge werden **nicht** in vermeintlich genaue Spielzeit umgewandelt.
- Das Backend speichert maximal 2.000 normalisierte Intervalle, ohne gleichzeitig die Cloud-Revision der persönlichen Spielpläne zu verändern.
- `psn_monitor` kann nur historische Zeilen liefern. Das System übernimmt keine direkte Kontrolle der PlayStation oder des Monitors.
- Ohne Cloud-Konfiguration lassen sich die bisherigen CSV-Imports weiterhin manuell verwenden.

## Einmalige Einrichtung – Vercel

1. Vergewissere dich, dass das vorhandene Vercel-Projekt bereits `SUPABASE_URL` und `SUPABASE_SECRET_KEY` korrekt gesetzt hat.
2. Führe die Migration `supabase/psn-monitor-snapshot.sql` **im Supabase-Projekt PS5-Radar** aus. Sie erstellt `public.psn_monitor_snapshot` und aktiviert RLS, ohne `anon` oder `authenticated` Zugriffe zu vergeben.
3. Erstelle auf dem Monitor-Rechner ein Token:

   ```bash
   openssl rand -hex 32
   ```

   Ergebnis ist ein **geheimes Token von 64 Hex-Zeichen**, kein PSN-Token. Gib es niemals in GitHub, Logs oder Screenshots weiter.
4. Hinterlege in Vercel unter **Production → Environment Variables**:

   ```text
   PSN_MONITOR_PUSH_TOKEN=<derselbe geheime 64-stellige Wert>
   PSN_MONITOR_TIME_ZONE=UTC
   ```

   `PSN_MONITOR_TIME_ZONE` ist nur ein **Beispiel**: Verwende exakt die Einstellung `LOCAL_TIMEZONE` aus deiner tatsächlichen `psn_monitor`-Konfiguration. Wenn dort `Europe/Berlin` steht, muss hier ebenfalls `Europe/Berlin` stehen. Niemals eine Zeitzone raten. Anschließend neu deployen.

## Einmalige Einrichtung – Ubuntu

Voraussetzung ist ein bereits laufender `psn_monitor`, dessen CSV-Pfad bekannt ist. **Keine neuen PSN-Credentials in diesem Uploader hinterlegen.**

1. Repo auf dem Monitor-Rechner unter `/opt/ps5-radar` bereitstellen oder die in der systemd-Vorlage angegebene Skriptdatei an deinen tatsächlichen Pfad anpassen.
2. Sichere Konfigurationsdatei anlegen:

   ```bash
   sudo install -d -m 700 /etc/ps5-radar
   sudo install -m 600 /dev/null /etc/ps5-radar/monitor-push.env
   sudoedit /etc/ps5-radar/monitor-push.env
   ```

   Inhalt (Pfade und Token ersetzen):

   ```text
   PSN_MONITOR_CSV_PATH=/home/truck/psn_monitor/changes.csv
   PSN_MONITOR_PUSH_TOKEN=<dasselbe geheime Token wie in Vercel>
   PSN_MONITOR_SYNC_URL=https://playstation-radar-private.vercel.app/mein-playstation/api/monitor-sync
   ```

   Der Pfad ist ein **Platzhalter**, nicht der nachgewiesene Dateipfad deines Systems.

3. Aus den Vorlagen `deploy/systemd/ps5-radar-monitor-push.{service,timer}` einrichten. Vorher `User=truck` und `ExecStart` passend zum **tatsächlichen Benutzer und Checkout** ändern.
4. Systemd-Timer aktivieren:

   ```bash
   sudo cp deploy/systemd/ps5-radar-monitor-push.service /etc/systemd/system/
   sudo cp deploy/systemd/ps5-radar-monitor-push.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now ps5-radar-monitor-push.timer
   sudo systemctl start ps5-radar-monitor-push.service
   systemctl status ps5-radar-monitor-push.service --no-pager
   systemctl list-timers ps5-radar-monitor-push.timer
   ```

5. Bei Fehlern: `journalctl -u ps5-radar-monitor-push.service -n 50 --no-pager`. Das Skript gibt **keine** Authentifizierungswerte, PSN-Tokens oder Spieltitel aus.

Der Uploader kann unabhängig davon mit `--dry-run` auf CSV-Header, Datensatzzahl und Übertragungsgröße geprüft werden. Die systemd-Einheit ist absichtlich nicht aktiv, solange diese Einrichtung fehlt.

## Dashboard

Unter **Meine Spielwelt → Gaming-Chronik & Statistiken → Session Monitor**:

- „Automatischer Datenabgleich“ lädt nach dem Öffnen und danach ungefähr alle zwei Minuten bzw. beim Zurückkehren in den Tab.
- Manuelles „Jetzt abgleichen“ ist jederzeit möglich.
- Übertragene Intervalle werden **lokal nur ergänzt und dedupliziert**, niemals ungefragt gelöscht.
- Ein Schalter pausiert den automatischen Empfang auf dem jeweiligen Gerät.
- Die manuelle CSV-Funktion bleibt als unabhängiger Fallback bestehen.

Der Server-Snapshot wird absichtlich nicht mit dem bestehenden `psn_private_profile` gemischt, um Überschreibungen persönlicher Notizen und Spielpläne zu verhindern. Das lokale vollständige JSON-Backup enthält die empfangenen Intervalle weiterhin.

## Sicherheit, Nachvollziehbarkeit und Rückbau

- Die POST-Route akzeptiert **nur** `Authorization: Bearer <geheimes Token>`; eine Radar-Browser-Session genügt dort nicht.
- GET erfordert die gültige Radar-Session und liefert kein Token und keine Roh-CSV.
- Die Supabase-Tabelle hat RLS und **keine** Freigaben für öffentliche/API-Client-Rollen; die Verbindung läuft nur serverseitig über den geheimen Supabase-Schlüssel.
- Der Uploader verbietet HTTP und Weiterleitungen, damit ein Secret bei einem Redirect nicht mitgesendet wird.
- Das Token ist in Vercel als **Production Secret** und auf Ubuntu als root-geschützte Datei zu verwalten. Token bei Verdacht auf Offenlegung auf beiden Seiten erneuern.
- Bei Ausfall bleibt die manuelle Importfunktion erhalten. Zur Abschaltung Timer deaktivieren und die beiden `PSN_MONITOR_*`-Variablen bei Vercel entfernen.
- Übertragungsdaten sind personenbezogene Aktivitätsdaten. Eine serverseitige Datensicherung ist zusätzlich sinnvoll; RLS schützt nicht vor dem Server-Secret selbst.

## Tests und Release-Gate

- `scripts/test-psn-monitor-cloud.mjs` simuliert Supabase-REST-Read/PATCH/POST, Versionskonflikte, getrennte Profil-Daten, Duplikate, manipulierte Dauerwerte und fehlende Konfiguration. Keine Testdaten landen in Supabase.
- `npm run test:psn` und `npm run build` müssen erfolgreich sein.
- Mobile Chromium/WebKit-Smoketests prüfen einen nicht authentifizierten GET und einen nicht autorisierten POST ohne Token.
- Ein echter **Ubuntu→Vercel→Supabase→iPhone-End-to-End-Test** setzt einen korrekt konfigurierten Server-Pfad, Zeitzone und Secret voraus. Ein grün durchgelaufener GitHub-Test ersetzt diesen Realtest nicht.
