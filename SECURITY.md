# Sicherheit

## Sicherheitsmodell

Die Web-Oberfläche erhält nur drei eng begrenzte Rust-Befehle:

1. bis zu 32 vom Nutzer ausgewählte Ordner schreibgeschützt einlesen;
2. eine STL-, 3MF- oder OBJ-Datei innerhalb genau dieses Ordners für Vorschau und Viewer lesen;
3. ausgewählte, slicer-kompatible Dateien an OrcaSlicer, Bambu Studio oder PrusaSlicer übergeben.

Vor dem Lesen eines Modells wird der kanonische Pfad geprüft. Pfadtraversierung außerhalb der Archivordner, symbolische Links, nicht unterstützte Dateitypen und Modelle über 512 MB werden blockiert. Verschachtelt ausgewählte Quellen werden zusammengeführt, damit Dateien nicht doppelt erfasst werden. Der Scan überspringt versteckte Einträge und ist insgesamt auf 200.000 Dateien begrenzt.

Der Slicer-Start akzeptiert keine frei wählbaren Programme oder Shell-Befehle. Zulässig sind ausschließlich die fest hinterlegten Ziele OrcaSlicer, Bambu Studio und PrusaSlicer sowie höchstens 100 Dateien pro Aufruf. Jede Datei wird erneut kanonisch gegen die im Rust-Kern gespeicherten Bibliotheksordner geprüft; fremde Pfade und für den gewählten Slicer nicht unterstützte Formate werden blockiert.

Die Content Security Policy sperrt fremde Skripte, Frames und Plugins. Abhängigkeiten werden lokal gebündelt. Nur der native Updater stellt beim Start eine ausgehende Verbindung zum offiziellen GitHub-Release-Endpunkt her; Bibliotheksdaten, Pfade und Modelle sind daran nicht beteiligt.

Update-Pakete werden auf den nativen GitHub-Runnern erzeugt und mit dem Tauri-Updaterschlüssel signiert. Der öffentliche Prüfschlüssel ist in der App eingebettet. Der passwortgeschützte private Schlüssel und sein Passwort dürfen ausschließlich als getrennte GitHub-Actions-Secrets sowie in einer sicheren lokalen Sicherung liegen und werden niemals ins Repository, in Logs oder in Release-Artefakte geschrieben. `latest.json` enthält nur Versionsangaben, öffentliche Download-Adressen und die jeweilige Paketsignatur. Eine gültige Signatur ist vor jeder Installation zwingend erforderlich.

## Schwachstellen melden

Bitte keine Sicherheitslücke mit realen privaten Archivdaten in ein öffentliches Issue kopieren. Bis ein privater Meldekanal im GitHub-Repository eingerichtet ist, kann eine minimale Reproduktion ohne persönliche Daten verwendet werden.

## Release-Härtung

- Abhängigkeiten regelmäßig prüfen und Lockfiles einchecken
- Produktionsartefakte auf nativen, aktuellen GitHub-Runnern bauen
- öffentliche Artefakte mit GitHub-Herkunftsnachweisen versehen
- Updater-Pakete signieren und den privaten Schlüssel getrennt vom Repository sichern
- macOS-Builds mit Developer ID signieren und notarisieren
- Windows-Installer mit einem vertrauenswürdigen Zertifikat signieren
- Repository-Secrets niemals in Dateien, Logs oder Artefakte schreiben
