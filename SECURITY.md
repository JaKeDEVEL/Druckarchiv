# Sicherheit

## Sicherheitsmodell

Die Web-Oberfläche erhält nur zwei eng begrenzte Rust-Befehle:

1. bis zu 32 vom Nutzer ausgewählte Ordner schreibgeschützt einlesen;
2. eine STL-/3MF-Datei innerhalb genau dieses Ordners für den Viewer lesen.

Vor dem Lesen eines Modells wird der kanonische Pfad geprüft. Pfadtraversierung außerhalb der Archivordner, symbolische Links, nicht unterstützte Dateitypen und Modelle über 512 MB werden blockiert. Verschachtelt ausgewählte Quellen werden zusammengeführt, damit Dateien nicht doppelt erfasst werden. Der Scan überspringt versteckte Einträge und ist insgesamt auf 200.000 Dateien begrenzt.

Die Content Security Policy sperrt fremde Skripte, Frames, Plugins und externe Verbindungen. Abhängigkeiten werden lokal gebündelt.

## Schwachstellen melden

Bitte keine Sicherheitslücke mit realen privaten Archivdaten in ein öffentliches Issue kopieren. Bis ein privater Meldekanal im GitHub-Repository eingerichtet ist, kann eine minimale Reproduktion ohne persönliche Daten verwendet werden.

## Release-Härtung

- Abhängigkeiten regelmäßig prüfen und Lockfiles einchecken
- Produktionsartefakte auf nativen, aktuellen GitHub-Runnern bauen
- öffentliche Artefakte mit GitHub-Herkunftsnachweisen versehen
- macOS-Builds mit Developer ID signieren und notarisieren
- Windows-Installer mit einem vertrauenswürdigen Zertifikat signieren
- Repository-Secrets niemals in Dateien, Logs oder Artefakte schreiben
