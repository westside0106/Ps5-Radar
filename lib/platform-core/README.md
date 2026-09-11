# Platform Core – vorbereiteter Datenvertrag

Node.js >= 22, reine ES-Module ohne externe Laufzeit-Abhängigkeiten. Das Modul ist ein Starter, keine abgeschlossene produktive Integration. `snapshot.schema.json` beschreibt die JSON-Struktur, `model.mjs` ergänzt semantische Prüfungen, `view.mjs` bietet plattformneutrale Selektoren, `platforms.mjs` enthält die Plattform- und offiziellen Discovery-Quellen.

Wichtige Sicherheitsregeln: explizite plattformspezifische Produkt-IDs, Produkt-/Editionstrennung, Preis als Integer-Minor-Units, getrennte Entitlements, tatsächliche Ereignisdaten statt Abrufdaten und ehrliche Coverage-/Stale-Metadaten. Der Source-Collector muss die Evidenz liefern; das Core-Modul kann keine Echtheit eines öffentlichen Belegs allein durch eine URL beweisen. Die Beispieldaten sind synthetisch. Keine persönlichen Besitzrechte aus einem öffentlichen Abo-Katalog ableiten.

Testen vom Paket-Root: `node --test starter/platform-core/tests/*.test.mjs starter/xbox/tests/*.test.mjs`. Der Starter darf erst nach PS5-Abnahme und gezielter Migration in das echte Repository integriert werden.
