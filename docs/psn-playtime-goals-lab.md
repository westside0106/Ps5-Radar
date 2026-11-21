# PS5-Radar – Spielzeit-Labor / persönliche Zeitziele

## Zweck

Der Bereich **Meine Spielwelt → Gaming-Chronik & Statistiken → Spielzeit-Labor** vergleicht unabhängig voneinander drei unterschiedliche Arten von Zeitwerten:

1. **Sony / PSN**: vom PlayStation-Endpoint gelieferte kumulierte `playDuration` (ISO-8601-Dauer), keine Sitzungen.
2. **PSN Monitor**: aus CSV-Statuswechseln rekonstruierte, abgeschlossene Beobachtungsintervalle; nicht vollständig und nicht die historische Gesamtspielzeit.
3. **Persönliches Zeitziel**: vom Benutzer ausdrücklich eingegebener Richtwert in Stunden (`0,5` bis `1.000`, Schritte `0,5`), optional mit dem Typ Story/Platin/Persönlich.

Die Werte werden **niemals addiert**. Eine erkannte Über- oder Unterschreitung des Zeitrichtwerts ist keine Aussage darüber, ob eine Story oder Platin tatsächlich abgeschlossen wurde. Insbesondere darf aus `goalHours - psnMinutes` keine angeblich verlässliche verbleibende Spieldauer werden.

## Bedienung

- **Spiele planen & Backlog → Mein Spielplan**: Spiel auswählen; optional eigene Stunden eingeben und Zieltyp setzen; explizit über „Spielplan speichern“ sichern.
- **Spielzeit-Labor**: relevante Titel, nur persönliche Zeitziele, nur Monitor-beobachtete Titel oder alle Spiele wählen; Suche und mobile Kartenansicht.
- „Ziel bearbeiten“ öffnet denselben bestehenden Plan-Editor (keine parallele Speicherung).
- Community-`platinumHours`-Werte erscheinen **nur als historischer Richtwert**. Sie sind nicht mit dem persönlichen Ziel gleichgesetzt, werden nicht als Restaufwand ausgegeben und nicht automatisch gespeichert.

## Matching der beobachteten Spielintervalle

PSN-Monitor-CSV besitzt keinen stabilen `titleId`-Schlüssel. Deswegen gilt:

- Bei **genau einem** Treffer über normalisierten Titelnamen (optional PS4/PS5-Suffix) darf ein Intervall diesem Titel zugeordnet werden.
- Existieren zwei PSN-Versionen mit demselben Namen, wird nichts automatisch zugeordnet.
- Ähnliche, aber unterschiedliche Spielnamen werden **nicht** nach Teilstring/Ähnlichkeit zusammengefügt.
- Nicht zuordenbare Titel erscheinen in einem separaten, eingeklappten Bereich mit Grund; sie bleiben in der originalen Monitor-Auswertung erhalten.
- Die vorhandene `normalizeObservedSessions`-Funktion validiert Zeitstempel/Dauer, setzt Maximalgrenzen und entfernt doppelte Intervalle.

## Speicherung und Kompatibilität

- Speicherung im bestehenden `psn-game-planner-v1` pro Spiel-ID als `timeGoalHours` und `timeGoalType`. Das ist bewusst kein neuer lokaler Storage-Key.
- Der bestehende **version-2 JSON-Backup-Export**, der JSON-Import und die optionale private Supabase-Cloud-Sicherung enthalten persönliche Zielwerte, ohne neue Tabellen oder neue Zugangsdaten.
- Alte Notizen/Backups ohne diese Felder bleiben kompatibel; ungültige importierte Zielwerte werden nicht übernommen.
- Das bestehende Spielerstatusfeld (`planned`, `playing`, `paused`, `completed`, `platinum`) wird unabhängig vom Stundenvergleich geführt. Der Status ändert sich **nicht** automatisch.

## Tests

- `scripts/test-psn-playtime-goals.mjs`: valide/ungültige Richtwerte, Sony-Sessions-Differenzierung, unbekannte Dauer, Ziel überschritten, PS4/PS5-Dubletten, Titelnähe, Duplikate und inkompatible ältere Daten.
- Chromium-/WebKit-Mobile-Smoketests: manuelles Spiel mit Zeitrichtwert anlegen, speichern, nach Reload im Labor nachweisen, mobile Breite und interaktive Filter prüfen.
- Alle bestehenden PSN-/Metadaten-Regressions- und Next.js-Produktionsbuild-Schritte unverändert.
