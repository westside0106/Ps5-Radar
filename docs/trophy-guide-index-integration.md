# PS5-Radar · Trophy-Guide-Index (langdonx) – Funktionsintegration

## Quelle und technische Grundlage
Der öffentlich zugängliche, von der Community gepflegte Index `langdonx/trophy-guide-list-json` dokumentiert `guides-v2.min.json` samt `types/guides-v2.d.ts` und `types/attributes-v2.ts`.

- Originalquelle: https://github.com/langdonx/trophy-guide-list-json
- Dokumentierte Datenfelder: `n` (Guide-Bezeichnung), `a` (Bitflags für Quelle, Plattform, DLC, verpassbare/Online-/fehlerhafte Trophäen), `r` ([Schwierigkeit, Durchläufe, Stunden]), `p` (optionaler relativer Guide-Pfad), `g` (PSNProfiles-Spiel-IDs), `u` (Autoren).
- Abruf nur **auf Nutzeraktion**, serverseitig über den festen `langdonx.github.io`-Index, ohne PSN-ID, Accountname, Sony-Token, Region oder Trophäenliste im Request.
- Index wird in der warmen Serverinstanz bis zu sechs Stunden zwischengespeichert; keine Kopie des kompletten Drittanbieter-Datensatzes im Repository oder in der Benutzer-Supabase-Datenbank.
- Die Ergebnis-API `/mein-playstation/api/trophy-guide-index?title=...` benötigt eine Radar-Sitzung; `Cache-Control: private, no-store`, begrenzter Suchname, höchstens acht Treffer. Bei Index-Ausfall bleibt die manuelle Guide-Suche funktionsfähig.

## Benutzerfluss
Unter **Meine PlayStation → Trophäen-Zentrale → Spiel-Trophäen öffnen → Deine Platin-Roadmap** gibt es den Block **GUIDES UND PLATINZEITEN FINDEN**.

1. `GUIDES IM INDEX SUCHEN` fragt einen externen Guide-Index nach dem sichtbaren Titel ab.
2. Ergebnisse zeigen Guide-Quelle, Plattform (soweit markiert), Schwierigkeitswert/10, geschätzte Stunden, Durchläufe und positive Warnflags für verpassbare/Online-/fehlerhafte Trophäen sowie DLC.
3. `GUIDE PRÜFEN` öffnet die externe Quelle in einem neuen Tab.
4. `LINK ÜBERNEHMEN` trägt die URL nur als **nicht gespeicherten Vorschlag** in den bestehenden persönlichen Editor ein. Der Nutzer muss Edition/Region prüfen und dann selbst `GUIDE-LOG SPEICHERN` ausführen.
5. Bereits bestehende persönliche Guide-Links, Verpassbarkeitsmarkierungen und Notizen bleiben erhalten. Die vorhandene private Cloud-Backup-/Importstruktur ändert sich nicht.

## Keine falschen Übereinstimmungen
Der Index `guides-v2` referenziert **PSNProfiles-Spielnummern**, keine eindeutige Sony-`npCommunicationId`/`NPWR`-Verknüpfung. Daher wird **nie automatisch** eine PSN-Trophäenliste mit einer Community-Guide-ID verknüpft.

- Nur Normalisierung der sichtbaren Titelzeichen und gängige *Trophy Guide / Roadmap*-Endungen.
- Ähnlich beginnende Titel oder DLCs erscheinen ausdrücklich als **ähnlicher Titel – Edition prüfen** und werden nicht als sicherer Treffer ausgegeben.
- Fehlende Schwierigkeit/Zeit/Durchläufe (`-1` und andere ungültige Werte) werden als unbekannt behandelt, niemals zu `0` gemacht.
- Ein nicht gesetztes `HAS_MISSABLE_TROPHIES`-Bit bedeutet **nicht**, dass keine verpassbaren Trophäen existieren. Nur positive Markierungen werden als Hinweise angezeigt.
- Nur fest definierte HTTPS-Guide-Domains werden zugelassen, mit sicheren relativen Pfaden und ohne Benutzerdaten in externen URLs.

## Grenzen
Diese Integration liefert eine **durchsuchbare Guide-Quelle**, keinen automatischen Trophy-Walkthrough, keine verifizierte Verpassbarkeitsanalyse und keine vollständige Spielzeitdatenbank. Die Angaben sind Drittquellenschätzungen, keine Sony-Daten. Der Download der externen Indexdatei kann ausfallen oder auf GitHub Pages verzögert sein; dann bleibt das bisherige persönliche Guide-Log verfügbar.

Der erste Live-Abruf aus dem externen Index ist nach dem Deployment gesondert zu prüfen. CI verwendet synthetische Datensätze ohne echte Sony-Tokens und lädt die Drittquelle nicht selbst.

## Sicherheit und Tests
- Tests: `scripts/test-psn-trophy-guide-index.mjs`; sichere Quellen-/URL-Pfade, Title-Rankings, missable-/online-/DLC-Bitflags, Input-Grenzen, geschützter Remote-Abruf, keine NPWR-Übertragung.
- Bestehende Tests: `scripts/test-psn-trophy-guides.mjs`, Cloud-Backup-Vertrag, private Browser-Endpunkte, mobile Layoutregressionen und Produktionsbuild.
- Keine neuen secrets, Cron-Jobs, Monitoringfunktionen oder PSN-Rechte.
