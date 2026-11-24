# PS5-Radar · manueller PS-Store-Regionalvergleich (DE / GB / US / PL)

## Quelle
- Konzept für gemeinsames Produkt-/Konzept-Matching: [enviGit/ps-catch](https://github.com/enviGit/ps-catch) (MIT); das Repo enthält einen Python-Scraper über Sonys öffentliche GraphQL-Storeoberfläche, aber **keinen direkt abrufbaren freien Datenfeed**.
- Die nun angebundene, dokumentierte JSON-API stammt aus dem eigenständigen Open-Source-Projekt [imbbloh/ps-prices](https://github.com/imbbloh/ps-prices) und dem dort im README angegebenen Hosting `https://ps-prices-api.onrender.com/prices`. Das Projekt führt regionale Store-Abfragen selbst durch. **Kein offizielles Sony-API-Produkt oder von Sony zertifizierter Preisfeed.**
- Verfügbarkeit der Drittanbieter-Instanz und Antworten aus der **authentifizierten Vercel-Produktionslaufzeit** sind separat zu prüfen. Das lokal/CI gemockte Antwortformat ist validiert, aber eine erfolgreiche Live-Antwort des öffentlichen Render-Dienstes kann nicht garantiert werden.

## Bedienung
1. **Meine PlayStation → Spiel auswählen → Spielzeit, FPS & Store-Abgleich → Store-Preise nach Region prüfen**.
2. Optional einen offiziellen Store-Konzept- oder Produktlink für genau diese Edition angeben. Ausschließlich Links auf `https://store.playstation.com` mit zulässiger Region und `/concept/<Ziffern>` bzw. `/product/<Produktkennung>` dürfen als Identität verwendet werden; ungültige Links werden ignoriert, dann wird nur der sichtbare Titel gesucht.
3. **VIER REGIONEN VERGLEICHEN** startet einmalig die externe Suche. Kein Abruf beim Öffnen des Profils, kein täglicher Cron, keine Preishistorie oder Konto-Wishlist auf dem Drittserver.
4. Die Daten werden für **DE/EUR, GB/GBP, US/USD, PL/PLN** in jeweils eigener Währung gezeigt, inklusive ausgewiesener Rabatte und Store-Link. **Keine** FX-Konvertierung und deshalb kein künstlicher Länderrang nach vermeintlichem Gesamtpreis. Filter „Nur Regionen mit Preisnachlass“ ist rein clientseitig.
5. `suspect`, `redirected`, `foreign`, `adjusted`, falsche Währung, externe Store-Links, falscher Länderpfad, unzulässige Zahlen oder fehlende Rückmeldung werden **nicht** als belastbarer Preis angezeigt. Auch angebliche Gratisangebote müssen unabhängig auf der Produktseite verifiziert werden.
6. Selbst bei passender Sony-`conceptId` muss die **Edition separat bestätigt** werden, da eine Konzeptseite Standard/Deluxe und teilweise andere Angebote bündelt. Auch Titel-Suchen (selbst exakt) brauchen diese Prüfung.

## Technische/Sicherheitsgrenzen
- `GET /mein-playstation/api/region-prices?title=<Titel>&storeUrl=<optionaler-Store-Link>`: ausschließlich mit Radar-Session, `Cache-Control: private, no-store`.
- Nur der **ausgewählte Spieletitel** beziehungsweise die bewusst angegebene Store-Konzept-/Produkt-ID wird an den Drittanbieter übermittelt – keine PSN-Kontokennung, keine OAuth-Daten, keine ganze Spielebibliothek und keine privaten Notizen.
- Server nutzt festen Provider-Host, blockiert Redirects und begrenzt die Antwort auf 350 KB sowie die Antwortzeit auf 42 Sekunden. Vercel-Route maximal 60 Sekunden. Eine warm laufende Instanz kann erfolgreiche Daten 15 Minuten cachen; der Provider selbst kann ebenfalls cachen. Abgelehnte/ungültige Anfragen bleiben explizit **nicht verfügbar**.
- Reale Länderpreise können je nach PSN-Konto, Abo, Rabatt-Personalisierung, regionaler Berechtigung, Steuern und Kaufseite differieren. Eine Weiterleitung zu einem anderen Store oder eine falsche Währung ist **kein** vergleichbarer Preis.
- Die Ergebnisse lösen **niemals** den bestehenden privaten EUR-Preisalarm aus. Der Preisalarm bleibt ausschließlich an eigene verifizierte Radar-Messwerte gebunden. Es werden keine neuen Datenbanktabellen, Token, Vercel-Crons oder Userrechte benötigt.

## Tests
`scripts/test-psn-region-prices.mjs` prüft Store-Link-Validierung, feste Domain, dezidierte Währungen, 0/fehlende/beschädigte Preise, regionale Weiterleitungen, Preisnachlass, Editionskonflikte, Netzfehler, begrenzte Antwort und keine Sony-Daten. Browser-Smoke testet den privaten Endpunkt, die mobile Darstellung, den Rabattfilter und den direkten offiziellen DE-Store-Link.

## Noch nicht implementiert
Die komplette `ps-catch`-Datenpipeline einschließlich periodischer neuer Titel, persönlicher Wishlists und länderübergreifender Preisverlauf-Datenbank ist **nicht** eingebunden. Dazu sind ein eigener regionenweiser Datenimport, Versions- und Angebots-ID-Matching, Speicherung und Rechtekontrolle nötig. Diese Erweiterung ist ein **manueller Vergleich**, keine kontinuierliche Live-Preisüberwachung. 