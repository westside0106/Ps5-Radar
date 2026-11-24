# PS5-Radar · Game Intelligence: Spielzeiten, PS5-FPS und US-Store-Katalog

## Integrierte Quellen
1. **FramePatch** (https://github.com/arthurcarlsonn/framepatch): `data/fpsRecords.json`, belegte FPS-Modi pro PS5/PS5 Pro, Patches, Qualitätsstufen und externe Quellen. Die externe Datei wird nur auf Anfrage vom Server geladen und 12 Stunden im jeweiligen warmen Serverprozess zwischengespeichert.
2. **howlongtobeat-ts** (https://github.com/Deadlock-too/howlongtobeat-ts, MIT): Die Dokumentation und der quelloffene Suchablauf der Bibliothek wurden als kleiner eigenständiger, serverseitiger Adapter umgesetzt; kein npm-Paket oder zusätzlicher Token nötig. Der Adapter führt den dokumentierten `/api/search/site/init` + `/api/search/site` Ablauf aus, liefert exakte Titel-Treffer und wandelt Sekunden in Stunden um.
   **Wichtig:** HowLongToBeat ist eine inoffizielle, häufig gegen Server-/Datacenter-IP gesperrte Schnittstelle; ein HTTP 403, Timeout, Parserfehler oder eine neue Fingerprint-Prüfung erzeugt *nicht verfügbar*, keine erfundenen Stunden. Nutzer können die öffentliche Website direkt öffnen.
3. **game-store-catalog** (https://github.com/Ephellon/game-store-catalog): On-demand regionaler `psn/<letter>.json`-Katalog plus `psn/$.json` für den Zeitstempel. **US-Katalog / USD** – Preisangaben als historische, nicht live verifizierte Momentaufnahmen. Keine Umrechnung in Euro, kein lokales DE-Angebot und kein behaupteter Tiefstpreis.
4. **ps-catch** (https://github.com/enviGit/ps-catch): Als Multi-Region-Quellenarchitektur geprüft, **nicht als Live-Preisfeed integriert**, da der Reposcraper eine eigene Datenbank und authentifizierte Aggregationsinfrastruktur voraussetzt. Aus den US-Katalogdaten werden keine länderübergreifenden vergleichbaren Live-Angebote konstruiert.

## Im Produkt
In **Meine PlayStation → Spiele → Spiel öffnen → Spielzeit, FPS & Store-Abgleich**:
- Externe Abfragen erfolgen **erst nach** Klick auf `QUELLENDATEN ABRUFEN`, nicht bei der Profilseite oder dem Öffnen eines Modals.
- HLTB zeigt **Story**, **Story + Extras** und **100 % Completionist** getrennt von der kumulierten Sony-Spielzeit. Ein 100%-HLTB-Wert ist **kein Nachweis einer Platinzeit**.
- Der Nutzer kann HLTB-Story und HLTB-100%-Werte **explizit** im vorhandenen GamingPlanner als noch ungespeichertes persönliches Ziel vorbelegen. GamingPlanner verlangt weiterhin `Spielplan speichern`; HLTB-Daten werden nie automatisch als Ziel oder abgeschlossene Trophäen übernommen.
- FramePatch zeigt PS5-/PS5-Pro-Profile, Modus, dokumentierten FPS-Zielwert, VRR/Unlocked/Resolution, Beleglage und source-backed Patch-Updates. Fehlende Belege sind unbekannt; 60 FPS werden nicht aus reiner PS5-Kompatibilität abgeleitet. Dokumentierte Zielwerte sind keine garantiert konstante Framerate.
- Store zeigt Titel mit **exakter Titelübereinstimmung** und vertrauenswürdigem `store.playstation.com/en-us/product/...`-Link. Weitere Editionen werden ausschließlich anhand eng definierter Editionssuffixe als **andere Editionen – nicht direkt vergleichbar** aufgeführt, mit gesondertem Prüf-Link. Erweiterungen/DLCs und Fortsetzungen zählen nicht als Edition.
- Das zusätzlich eingebundene **eigene EUR-Preisradar** verwendet nur genau einen eindeutigen, bereits beobachteten Titel aus `data/price-history.json` (keine ungeprüften Fremdpreise). Es zeigt eigene Messpunkte, den Radar-Tiefstwert und nur bei einem innerhalb von 72 Stunden belegten aktiven Deal dessen aktuellen Status. Wenn genau diese Edition beobachtet wird, führt **EUR-Preisziel festlegen** zum schon vorhandenen privaten Preisregel-Editor. Für andere Spieleditionen wird keine Regel angelegt.
- Region US und Datenstand erscheinen am externen Store-Preis. Ein historischer US-Preis wird nie als deutscher oder aktuell verifizierter Preis empfohlen oder in die EUR-Preisalarm-Logik übernommen.

## Datenqualität und Datenschutz
- HTTPS-URLs und feste Hosts für alle Datenbeschaffung; Eingabetitel 3–125 Zeichen, Zeitlimit je Quelle, Größenlimit 4 MB (FramePatch) bzw. 1,6 MB (Store-Letter).
- API `GET /mein-playstation/api/game-intelligence?title=...` ist nur mit gültiger Radar-Session zugänglich, `private, no-store`.
- Kein Kontoname, keine `NPWR`-ID, kein Sony-Token und keine Bibliotheksliste wird an HLTB, FramePatch oder Store-Katalog weitergeleitet. Nur der **vom Nutzer ausgewählte Titel** wird an die drei Quellen übergeben; FramePatch/Store-URLs selbst enthalten nur fixe Dateipfade.
- Fehler einer Quelle verhindern die anderen Ergebnisse nicht; Nutzer sehen einen klaren Nicht-verfügbar-Zustand statt Nullwerten.
- Weder Vercel-Crons, PSN-Polling, ntfy, Server-Env/Secrets noch die bestehende PSN-Cloud-Backup-Struktur wurden geändert.

## Verifizierungsgrenzen
- Die Quellenrepositorien und die FramePatch-/Store-Datenschemas wurden direkt eingesehen; GitHub-Daten: FramePatch `fpsRecords.json` u. a. für `cyberpunk-2077`, `elden-ring`, `assassins-creed-shadows` sowie `game-store-catalog/psn/c.json` und `psn/$.json`.
- CI testet die API semantisch und die UI mit deterministischen, synthetischen Antworten. **Ein authentifizierter Realabruf aus der Produktionsseite ist erst nach Deployment überprüfbar**; die tatsächliche HLTB-Nutzbarkeit hängt von externen Zugangssperren ab.
- Eine echte globale Live-Preisaggregation und automatische Edition-ID-Korrelation benötigen zusätzliche Daten-/Storeverträge und sind **nicht** Teil dieses Releases.
