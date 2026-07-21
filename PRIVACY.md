# Datenschutz

Druckarchiv arbeitet lokal („local first“).

- Die ausgewählten Ordner werden nur auf dem Gerät gelesen.
- Ordnerpfade, Formatwahl, Ausschlussregeln und Favoriten werden ausschließlich im lokalen App-Speicher gesichert, damit die Bibliothek beim nächsten Start wiederhergestellt werden kann.
- Dateinamen, Modelle, Notizen und Statistiken werden nicht an einen Server übertragen.
- Es gibt keine Telemetrie, Werbung, Analyse-SDKs oder Benutzerkonten.
- Beim Start ruft der native Updater ausschließlich die öffentliche Versionsdatei des offiziellen GitHub-Releases ab. Erst nach Bestätigung eines angebotenen Updates wird das passende signierte Paket heruntergeladen. Bibliothekspfade, Dateinamen, Modelle, Favoriten und Statistiken werden dabei nicht übertragen.
- Die App startet keinen öffentlich erreichbaren Webserver.
- Der Viewer verwendet die mit der App gebündelte Three.js-Version und lädt keine Bibliotheken von einem CDN.
- Der App-Quellcode und die Build-Artefakte enthalten keine Daten aus dem Entwicklerarchiv.

Weitere optionale Online-Funktionen müssen standardmäßig deaktiviert, klar gekennzeichnet und vor ihrer Veröffentlichung in diesem Dokument ergänzt werden.
