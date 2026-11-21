# PS5-Radar · Datenqualität, Messabdeckung und CSV-Export

## Ziel
Die Quellen-Historie stellt bewusst **keine** fortlaufend gemessene Uptime und keine SLA-Verfügbarkeit dar. Ein einzelner guter Prüftag wird nicht als 100-prozentige Verfügbarkeit kommuniziert.

Unter `/zentrale?tab=quellen` ergänzt die Box **MESSABDECKUNG STATT SCHEIN-SLA** den vorhandenen Live-Monitor und die private UTC-Tageshistorie.

## Bedienung
- **7 Tage / 30 Tage**: Zeitraum des eingeschränkten UTC-Tages-Samples wechseln.
- **Quelle**: alle sechs Anbieter oder einzelne Quelle filtern.
- **Tageswerte vorhanden**: wie viele der erwartbaren UTC-Tagesfelder tatsächlich einen gespeicherten Erstbefund besitzen, etwa `1/7`. Ein fehlender Tageswert ist unbekannt – weder gesund noch gestört.
- **Tage ohne Befund**: zeigt explizit die Datenlücken; auch Tage vor Aktivierung des historischen Monitors zählen als *nicht geprüft*, nicht als Ausfall des Providers.
- **Erste Befunde gesund**: gesunde *erste* Prüftage geteilt durch alle aufgezeichneten Tage, niemals durch den vollständigen Zeitraum.
- **Letzte Befunde gesund**: entsprechend jeweils der letzte gespeicherte Zustand derselben gemessenen Tage. Das kann sich vom ersten unterscheiden.
- **Zuletzt gespeichert**: Status und Zeitpunkt der jüngsten tatsächlich in der Cloud gespeicherten Tagesmessung, nicht die letzte im Browser angezeigte Live-Momentaufnahme.
- **CSV exportieren**: speichert eine lokale UTF-8-CSV mit BOM und Semikolontrennung (Excel in de-DE), bestehend aus jedem Tag im gewählten Zeitraum und separaten echten Statuswechsel-Zeilen. Jeder fehlende Tag enthält `Nicht geprüft` statt erfundener Messwerte.

Der Export enthält ausschließlich kontrollierte Quellennamen, normierte UTC-Zeitpunkte und feste Statustexte; er exportiert **keine** Diagnosetexte, Tokens, Spiele, Trophäen, Profile oder Provider-Antworten. CSV-Zellen werden gequotet und mögliche Formel-Anfänge entschärft. Der Export erfolgt lokal im angemeldeten Browser, ohne neuen Download-API-Endpunkt oder serverseitige Dateispeicherung.

## Technische Grenzen
- Gespeicherte Tageswerte sind Momentaufnahmen aus den planmäßigen Cron-Checks und expliziten Sofortprüfungen; die alle drei Minuten laufende Browser-Live-Ansicht schreibt weiterhin keine Datenbankzeilen.
- **Messabdeckung** ist eine Kennzahl der vorhandenen Daten. **Gesunde Tages-Stichproben** sind keine gemessene Zeitverfügbarkeit über 24 Stunden.
- Die bestehende alarmierende Zwei-Tage-Regel bewertet nur die ersten Tagesbefunde; weder Statistiken noch Export verändern diesen Mechanismus.
- Es werden keine neuen Datenbanktabellen, Secrets, Cron-Jobs oder Web-Push-Endpunkte benötigt.

## Qualitätssicherung
`scripts/test-source-quality.mjs` prüft 7-/30-Tage-Fenster, explizite fehlende Tage, UTC-Grenzen, Erst-/Letztauswertung, Quellenfilter, CSV-Vollständigkeit und CSV-Datenschutz. Die mobile Chromium-/WebKit-Suite prüft Tabellen, Zeitraumschalter, Quellenfilter und horizontale Darstellungsgrenzen; Chromium prüft zusätzlich den echten CSV-Dateidownload.
