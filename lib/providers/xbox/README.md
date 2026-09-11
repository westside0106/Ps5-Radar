# Xbox starter – keine Live-Pipeline

Dieser Adapter ist absichtlich unabhängig vom bestehenden PS5-Repository. Er kann verifizierte Xbox-DE-Beobachtungen normalisieren, lehnt fremde Plattformen ab und liefert ohne echten Collector einen explizit unvollständigen Snapshot. `collectXboxSnapshot()` ist nicht implementiert und wirft einen eindeutigen Fehler. Es gibt keine erfundenen Live-Spiele, Preise oder Abo-Tiers.

Die Fixture unter `fixtures/synthetic.json` ist rein synthetisch. Sie darf niemals in einen echten Radar, Preisverlauf oder Katalog übernommen werden. Codex soll zunächst die aktuellen offiziellen Xbox-/Microsoft-Quellen und ihre zulässigen Zugriffswege prüfen, dann einen separaten Provider und erst danach den UI-Switcher auf echte Daten schalten. Game Pass für Xbox-Konsole, PC und Cloud getrennt behandeln. EA Play und Ubisoft+ nur bei explizit bestätigter Plattform-/Tier-Berechtigung einbeziehen.

Tests: `node --test starter/platform-core/tests/*.test.mjs starter/xbox/tests/*.test.mjs` vom Paket-Hauptverzeichnis. Es werden keine externen Pakete oder API-Keys benötigt.
