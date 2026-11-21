# PS5-Radar · Live-Quellenbetrieb und Sofortprüfung

## Verhalten der Quellenansicht
Die sechs Live-Diagnosen aktualisieren sich in einem sichtbaren, geöffneten Quellen-Tab ungefähr alle **3 Minuten**. Beim Wechsel in einen ausgeblendeten Tab werden Browser-Abfragen abgebrochen; bei Rückkehr erfolgt die nächste Prüfung, sofern das Intervall abgelaufen ist. Die Ergebnisse sind einzelne Momentaufnahmen, kein kontinuierlicher Ausfall-SLA und kein Hintergrundprozess bei geschlossenem Browser.

Der neue Button **JETZT PRÜFEN & MELDUNGEN SENDEN** startet eine explizit authentifizierte serverseitige Sofortprüfung, um den Tagesverlauf und ntfy-Warteschlangen auch vor dem täglichen 09:00-UTC-Cron prüfen zu können. Die Zustände werden anschließend in den Live-Karten, der Cloud-Tageshistorie und im Posteingang angezeigt.

## Sicherheit und Häufigkeit
- `POST /zentrale/api/source-live-run` verlangt dieselbe Radar-Session wie der Rest der privaten App und einen exakt zur aktuellen Origin passenden `Origin`-Header; `GET` ist dafür nicht erlaubt.
- Die serverseitige Rate-Begrenzung reserviert atomar den einzigen privaten `radar_source_push_control`-Datensatz. Ein manueller Lauf ist höchstens alle **10 Minuten** möglich; dies gilt über Browser, mehrere Serverinstanzen und erneute Seitenaufrufe hinweg. Der Test-Push hat einen separaten Cooldown.
- Der neue Zeitstempel `last_manual_scan_at` wird mit `supabase/source-live-ops.sql` ergänzt. Die Tabelle bleibt RLS-geschützt und für `anon`/`authenticated` unerreichbar.
- Fehlgeschlagene Prüfungen werden nicht als erfolgreich gespeichert. Eine bereits beanspruchte Rate-Limit-Sperre wird beim fehlgeschlagenen Versuch nicht automatisch rückgängig gemacht, damit es keine kostspieligen Sofort-Retry-Schleifen gibt.
- Der Button setzt `useCache:false`; die normale On-Demand-Ansicht behält ihren 60-Sekunden-Servercache.

## Tagesmessung statt täuschender Zusatzausfälle
- Pro Quelle und UTC-Kalendertag existiert weiterhin **genau eine** gespeicherte Messung.
- `storeScheduledHealth` verwendet jetzt `resolution=ignore-duplicates,return=representation`: nur tatsächlich **neu eingefügte** Tageswerte dürfen neue Störungs-/Erholungsmeldungen auslösen. Nachfolgende manuelle Versuche ändern den ersten Tagesbefund nicht und erzeugen keine zweite Statusmeldung.
- Eine manuelle Sofortprüfung kann bereits die erste Tagesmessung erzeugen und damit den Tagesbefund vor dem planmäßigen Cron festlegen. Dieser Trade-off wird in der Bedienoberfläche ausdrücklich beschrieben.
- Bereits wartende Meldungen werden nach einem erfolgreichen Sofortlauf über die bestehende, gegen Doppelzustellungen abgesicherte ntfy-Outbox verschickt. Fehlender ntfy-Zugang verhindert die Quellenprüfung nicht.
- Es werden weiterhin nur generische Quellennamen und Statuswechsel gepusht; keine PlayStation-Zugangsdaten, Spielzeiten oder Rohdiagnosen.

## Tests
- `npm run test:psn`: Cooldown/Fehlertoleranz, der erzwungene Live-Check, gleichzeitige Tages-Deduplizierung und Push-Fehlerbehandlung.
- Browser-Suite: geschützte POST-Route ohne Login, manuelle Aktion, sofortige Dashboard-Aktualisierung, Layout für 320–1280 Pixel in Chromium und WebKit.
- Bestehende Zeitpläne in `vercel.json`, PSN-Monitor-Uploads und Preisalarme bleiben unverändert.
