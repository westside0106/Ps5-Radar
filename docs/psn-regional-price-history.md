# PS5-Radar · Privates Regionalpreisarchiv (PR #103)

## Zweck
Ein transparentes, dauerhaftes Archiv für **tatsächlich abgefragte** PlayStation-Store-Regionalpreise. Weder Sony noch PS5-Radar bestätigen unabhängig den Zahlungspreis des Drittanbieter-Dienstes `imbbloh/ps-prices`. Die Messpunkte dienen ausschließlich dem persönlichen Verlauf, **nie** den bestehenden EUR-Preisalarm-Scans.

## Bedienung
Unter **Meine PlayStation → Spiel öffnen → Spielzeit, FPS & Store-Abgleich → Store-Preise nach Region prüfen**:
1. Option **„Plausible Regionalpreise ... im privaten 90-Tage-Archiv speichern“** ist sichtbar und abwählbar.
2. **VIER REGIONEN VERGLEICHEN** fragt den externen Dienst an. Nur mit gesetzter Archiv-Option wird dazu ein autorisierter POST an die eigene Anwendung gesendet; ohne Archiv-Option bleibt die bestehende reine GET-Abfrage erhalten.
3. Nur normalisierte, positive Preisantworten mit festem regionalem Währungscode, sicherem offiziellen Store-Link, ohne `suspect`, `foreign`, `redirected` und `adjusted` werden als **extern und unbestätigt** gespeichert. Ein `unverified-review`-Match erzeugt keine Messpunkte. Fehlgeschlagene Abfragen erzeugen keine erfundenen 0-€-Tage.
4. **GESPEICHERTEN VERLAUF LADEN** liest nur die eigene Cloud-Datenbank. Die Drittanbieter-API wird dabei **nicht** angefragt. Der Verlauf bleibt daher einsehbar, wenn der Anbieter später nicht erreichbar ist.
5. Die 7-/30-/90-Tage-Ansicht mit separatem Region-/Währungsfilter zeigt nur vorhandene Messpunkte. Keine künstliche Verbindung durch unbekannte Tage, keine FX-Konvertierung und keine Länder-Rangliste.

## Identität, Datenschutz und Korrektheit
- Präzise Sony-`concept`-/`product`-URL wird als separater Identitätsschlüssel gehasht (`reg-` + SHA-256), unabhängig von leicht variierenden Namen. Ohne passende Store-ID nutzt das Archiv den exakt normalisierten Spieltitel und trennt beispielsweise Standard- von Ultimate-Edition.
- Unbestätigte Titelzuordnungen, verschiedene Regionen und unterschiedliche Währungen werden nie zu einem Euro-Durchschnitt zusammengeführt.
- Deduplication: **je Spielschlüssel, Region und UTC-Tag maximal eine Zeile**; ein späterer gleichentägiger Abruf aktualisiert den Tageswert. Erfassung erfolgt erst, wenn der Nutzer auf Abrufen klickt, und nur bei aktiviertem Archiv-Häkchen.
- Echte Preise, Link, Anbieter, Zuordnungsart, Abrufzeitpunkt und Status werden serverseitig unter `public.psn_regional_price_history` gespeichert. Aufbewahrung im DB-Schema ohne automatischen Löschjob; die UI fragt höchstens 90 Tage ab, maximal 360 Zeilen je Spiel.
- RLS ist eingeschaltet; `anon`, `authenticated` und `public` haben **keine** Leseschreibrechte. Nur der serverseitige Supabase-Servicezugang zusammen mit einer gültigen privaten Radar-Session darf auf die Daten zugreifen.
- Die Tabelle liegt **neben** `psn_private_profile`, `psn_monitor_snapshot` und dem EUR-Preisradar; keine Überschreibung persönlicher Cloud-Backups, kein Rennen um Cloud-Revisionen, keine automatischen Preisalarm-Notifications.
- Der POST-Endpunkt nimmt ausschließlich ausgewählten Titel, optionalen Store-Link und `saveHistory:true` entgegen. **Keine vom Browser gelieferten Preiswerte** werden zum Archivieren akzeptiert. Die Werte stammen nur vom serverseitigen validierten Regionalvergleich.

## Installation
`supabase/psn-regional-price-history.sql` ist eine additive RLS-Migration. Bestehende Vercel-Variablen `SUPABASE_URL` und `SUPABASE_SECRET_KEY` werden wiederverwendet. Es werden keine neuen API-Keys oder kostenpflichtigen Drittanbieter-Abos verlangt.

## Test- und Betriebsgrenzen
- Die Node-Regressionen prüfen Identität, gültige Store-Links, korrekte Währung, Fehlstatus, UTC-Deduplikation, Speicherung und 90-Tage-Fenster. Die Playwright-Suite deckt Anzeige, Cloud-Archivierungsmodus, Regionenfilter und nicht authentifizierte Schreibzugriffe ab.
- Ein Echt-Abruf des freien Drittanbieters kann **nicht** als dauerhaft verfügbar bestätigt werden; falls er unerreichbar ist, wird nichts gespeichert, und der vorhandene Verlauf bleibt abrufbar.
- **Nicht Bestandteil dieses Releases:** automatischer täglicher Crawler für die gesamte Spielebibliothek, automatische Erstaufnahme neuer Spiele, nutzerunabhängige Sony-Preisverifikation, verifizierte Komplettversion-/DLC-Zuordnung und Fremdwährungs-Pushalarme. Diese Funktionen werden erst auf einer nachweislich stabilen Datenquelle aufgebaut.
