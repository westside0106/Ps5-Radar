# PS5-Radar · iPhone-Push über ntfy (November 2026)

## Zweck
Bei einer bestätigten wiederholten Quellenstörung und bei anschließender Wiederherstellung übernimmt der bereits laufende private **09:00-UTC-Quellen-Cron** den Versand von bis zu fünf noch nicht bestätigten Meldungen an ntfy. Die Meldungen bleiben weiterhin dauerhaft in der privaten Radar-Historie. Der Preisalarm-Cron, der PSN-Uploader und andere Jobs werden nicht verändert.

## Aktivierung
In **Vercel → Projekt playstation-radar-private → Settings → Environment Variables**:
- `NTFY_TOPIC`: ein kryptografisch zufälliges Topic mit 24–64 Zeichen aus A–Z, a–z, Zahlen, Unterstrich und Bindestrich. Nur in Production setzen; **niemals in Git committen**.
- `NTFY_SERVER_URL` (optional): vollständiger HTTPS-Root des ntfy-Servers, ohne Pfad, Query, Credentials oder Port. Standard `https://ntfy.sh`.
- `NTFY_AUTH_TOKEN` (optional): persönlicher ntfy-API-Token bei einem Server mit Zugangskontrolle, nur im serverseitigen Environment.
- Nach Änderungen an Vercel-Umgebungsvariablen ist ein **neues Production-Deployment** erforderlich. Ohne ein gültiges Topic läuft der Quellen-Cron weiter und speichert Meldungen ohne Versand.

Im Radar **Quellen → NTFY-PUSH** den Topic-Namen ausschließlich nach Anmeldung anzeigen lassen, in der iOS-ntfy-App den Server und Topic abonnieren und mit **Test-Push senden** prüfen. Der Test ist datenbankgestützt auf einmal pro zehn Minuten begrenzt. HTTP-Annahme durch ntfy beweist **keinen** tatsächlichen Empfang auf dem iPhone.

## Sicherheit / Grenzen
- ntfy.sh ist ein öffentlicher Topic-Dienst. Wer das Topic kennt, kann Nachrichten mitlesen oder selbst veröffentlichen. Ein langer, zufälliger Topic-Name minimiert das Erraten, bietet aber keine echte ACL. Bei höheren Sicherheitsanforderungen ntfy mit Authentifizierung und Zugriffskontrolle betreiben.
- Es verlassen ausschließlich **generische Providerkennungen, Statuswechsel und ein Link auf das private Radar** den Server. Keine PSN-Spielzeiten, keine Trophäen, keine Quelldiagnose-Texte, keine Zugangsdaten.
- Der Testversand wird durch Session-Cookie, Same-Origin-Header und serverseitige Rate-Begrenzung geschützt.
- Der neue private `radar_source_push_control`-Datensatz und vier Zustellfelder in `radar_source_health_events` besitzen RLS ohne anonyme/autorisierte Data-API-Rechte. Die Migration ist `supabase/source-health-ntfy-push.sql`.
- Jede Meldung wird unter einem zeitlich begrenzten Lease reserviert. Eine erst nach erfolgreich bestätigtem ntfy-HTTP-Status als versendet markierte Meldung wird nicht erneut gesendet. Bei unterbrochener Quittierung sind **seltene Doppelzustellungen** technisch möglich (At-least-once, keine perfekte Exactly-once-Garantie).
- Fehlgeschlagene Zustellungen werden beim **nächsten täglichen Cron** erneut versucht (nach Ablauf des 10-Minuten-Lease); sie werden nicht sofort neu gepusht. Die Prüfungen erfolgen nicht in Echtzeit.
- Die historischen Meldungen werden nicht nachträglich durch Einrichtung eines neuen Topics verändert. Noch nicht versendete Ereignisse **werden** beim nächsten Jobversuch nachgesendet. Es gibt keine künstliche rückwirkende Push-Simulation.

## Tests
`npm run test:psn` umfasst Konfigurations- und Sicherheitstests, generische Nachrichten, HTTP-/API-Fehler, Idempotenz-Leases, Lesebestätigungen und Test-Cooldown. Das bestehende mobile Browser-Suite-Szenario testet den geschützten Versandweg auf Chromium/WebKit.
