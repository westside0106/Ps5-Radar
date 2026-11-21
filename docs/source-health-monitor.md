# PS5-Radar · Datenquellen-Monitor (November 2026)

## Einstieg
Öffne `/zentrale?tab=quellen` und den Bereich **Datenquellen-Monitor**. Beim Öffnen und durch **Erneut prüfen** wird der authentifizierte Server-Endpunkt `GET /zentrale/api/source-health` abgefragt.

Der Diagnose-Endpunkt verlangt die bestehende Radar-Session und gibt weder API-Schlüssel noch Sony-Daten oder Supabase-Nutzdaten aus. Eine fehlende Radar-Session liefert HTTP 401. Der Client setzt `cache: no-store`; der Server verwendet einen kurzen, pro Laufzeitinstanz geführten Ergebnis-Cache (60 s), um wiederholte Anbieterabfragen zu begrenzen.

## Prüfumfang

| Quelle | Aktiver Test | Aussagegrenze |
| --- | --- | --- |
| PSN | bestehender read-only Dashboard-Abruf | Einzelne Bereiche können fehlen, auch wenn Sony andere liefert |
| IGDB | Twitch-OAuth plus minimaler IGDB-Games-Abruf | Kein Qualitätsnachweis für alle Spielzuordnungen |
| RAWG | authentifizierter Games-Abruf | Keine Aussage über Metadatenabdeckung |
| SteamGridDB | authentifizierter Suchabruf | Keine Garantie für Artwork pro Titel |
| Supabase · Spielwelt | authentifizierte `psn_private_profile`-Tabellenabfrage | Keine Aussage über erfolgreiche künftige Schreibvorgänge |
| Supabase · PSN-Monitor | authentifizierte `psn_monitor_snapshot`-Tabellenabfrage und `received_at` | Unbeobachtete Spielzeiten bleiben unbekannt |

Status: **Erreichbar** (Probe erfolgreich), **Eingeschränkt** (Teilversagen, Ratelimit, ungültiger Zeitwert oder letzter Monitor-Upload älter als 60 Minuten), **Fehler** (Probe schlägt fehl), **Nicht eingerichtet** (benötigte Konfiguration fehlt). Ein leerer Monitor-Speicher erhält keinen gesunden Aktualitätsstatus. Einzelne Anbieter können unabhängig ausfallen.

## Grenzen und Sicherheit

- Kein Hintergrundjob, keine historischen SLAs, keine Push-Alarme und keine neue Datenbanktabelle.
- `lastDataAt` zeigt den Zeitpunkt einer PSN-Abfrage oder eines empfangenen Monitor-Uploads, nicht den Zeitpunkt des letzten tatsächlich gespielten Titels.
- Supabase-Tabellen werden ausschließlich gelesen, kein Probe-POST und keine Änderung persönlicher Daten.
- Die Anbietercodes werden in serverseitigen Antworten bewusst kategorisiert; externe Fehlermeldungen und Credentials werden nicht weitergereicht.
- Regressionen: `npm run test:psn` und `npm run build`. In der bestehenden mobilen Browser-Suite bleibt der Quellen-Tab erreichbar.

Für zukünftige permanente Ausfallhistorie sind ein separater Cron-Job und ein persistenter, zugriffsbeschränkter Statusspeicher nötig. Diese Erweiterung behauptet **keine** permanente Überwachung.
