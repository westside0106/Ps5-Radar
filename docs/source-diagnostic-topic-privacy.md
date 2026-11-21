# PS5-Radar · Quellen-Triage und ntfy-Topic-Schutz

## IGDB-Fehler nachvollziehen
Bei IGDB wird ein Problem in der Live-Ansicht unter **Quellen → Datenquellen-Monitor** jetzt einer Phase zugeordnet:
- **Twitch-OAuth:** Die vorgeschaltete Token-Anforderung an Twitch funktioniert nicht. HTTP 401/403 spricht dafür, dass App-ID oder Client Secret abgelehnt werden. In Vercel Production `IGDB_CLIENT_ID` und `IGDB_CLIENT_SECRET` kontrollieren; nach Anpassungen neu deployen.
- **IGDB-Datenabfrage:** Token-Anforderung ist gelungen, die eigentliche IGDB-API antwortet jedoch mit Fehler oder unerwarteten Daten. Bei 401/403 App-ID und Token-Kompatibilität prüfen.
- **HTTP 429:** Rate-Limit statt bestätigtem kompletten Ausfall; einige Anfragen später erneut versuchen.
- **HTTP 5xx / Netzwerk-/Zeitlimit:** Anbieter- oder Netzwerkstörung, nicht automatisch ein Fehler der Zugangsdaten.
- Die Diagnose bleibt **credential-safe**: Nur Phase, HTTP-Status und generischer Hinweis werden an den Browser übertragen. Keine OAuth-Tokens, Client-Secrets oder rohen Anbieterantworten.

Ein einzelner roter IGDB-Status beweist **nicht**, ob die Credentials falsch oder der Anbieter vorübergehend nicht verfügbar ist. Erst die nächste authentifizierte Live-Diagnose nach dem Deployment liefert die präzisere Einordnung.

## Push-Test vs. automatische Meldung
Der auf dem iPhone erhaltene **ntfy-Test-Push** ist eine separate, manuell ausgelöste Testnachricht. Die im Sofortprüfungsfeld angezeigte Zahl **automatische ntfy-Meldungen** zählt nur neue bzw. nachgesendete Störungs-/Wiederherstellungshinweise. Daher ist **0 automatisch** bei erfolgreich angekommenem Test-Push korrekt.

## ntfy-Topic in Screenshots
Der Topic-Name wird im angemeldeten Dashboard ab jetzt **standardmäßig maskiert**. **TOPIC KOPIEREN** funktioniert ohne Anzeigen des Werts. **TOPIC ANZEIGEN** macht den Namen nur auf ausdrücklichen Klick sichtbar; **TOPIC VERBERGEN** verdeckt ihn wieder.

Die Maskierung verhindert versehentliche Veröffentlichung in regulären Screenshots. Sie ist keine serverseitige Verschlüsselung, keine echte ntfy-ACL und keine Widerrufsfunktion. Wenn ein Screenshot mit dem vollständigen Topic **öffentlich** weitergegeben wird, das Topic in Vercel Production rotieren und es in der iOS-ntfy-App neu abonnieren. Eine automatische Rotation ohne Neuabonnement wäre kontraproduktiv und wird deshalb nicht durchgeführt.

Die vorhandenen täglichen Quellenchecks, Preisalarme, ntfy-Abonnements und der PSN-Uploader bleiben unverändert. Testabdeckung: Node-Tests für OAuth-/API-Phasen, HTTP-Codes und Geheimnisfreiheit sowie mobile Chromium-/WebKit-Suites für das standardmäßig verdeckte Topic.
