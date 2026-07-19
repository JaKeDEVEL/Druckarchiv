# Druckarchiv

Druckarchiv ist eine lokale Desktop-App zum Ordnen, Filtern und Betrachten von 3D-Druck-Dateien. Man wählt einen oder mehrere Archivordner aus; die App liest deren Struktur lokal ein und zeigt Projekte, Einzeldateien und Dateitypen als direkt anklickbare Kennzahlen.

## Aktueller Stand

- mehrere Bibliotheksordner über den nativen Ordnerdialog unter macOS und Windows
- rekursiver, schreibgeschützter Archivscan ohne Verfolgung symbolischer Links
- einfache Standardauswahl für STL, 3MF, OBJ und G-Code; weitere Mesh-, CAD- und Referenzformate sind Opt-in
- Ausschlüsse nach Endung, Dateiname oder relativem Pfad mit Platzhaltern
- KPI-Filter für Projekte, Dateien, STL, 3MF, Mesh, CAD, G-Code und Sonstige
- Raster- und Listenansicht mit allen Dateien aus sämtlichen Unterordnern
- lokal und verzögert erzeugte Modell-Thumbnails mit sichtbarem Ladefortschritt; in der Verwaltung abschaltbar
- interaktiver STL-/3MF-/OBJ-Viewer mit Drehen, Zoomen und Verschieben – auch direkt aus Projektordnern
- keine Telemetrie, kein Benutzerkonto und kein Upload
- Blender ist **keine Voraussetzung**

Die App-Basis ist bewusst von einem realen Archiv getrennt. Dieses Repository enthält keine Modelle, Dateinamen, absoluten Benutzerpfade, Vorschaubilder oder Inventardaten.

## Lokale Entwicklung

Voraussetzungen: Node.js 22 oder neuer, Rust und die [Tauri-Systemvoraussetzungen](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

Sicherheits- und Buildprüfung:

```bash
npm run check
```

Lokales Installationspaket:

```bash
npm run build
```

Auf macOS entsteht ein `.app`/`.dmg`, auf Windows ein NSIS-Setup. Die GitHub-Actions-Workflows bauen beide Plattformen auf ihren nativen Runnern.

## Vorschau-Strategie

Der drehbare Viewer und die Karten-Thumbnails rendern STL, 3MF und OBJ direkt mit Three.js/WebGL. Das ist offlinefähig und benötigt Blender nicht. Einträge erscheinen gestaffelt, damit KPI- und Ansichtswechsel sofort reagieren. Thumbnails werden erst erzeugt, wenn eine Karte in die Nähe des sichtbaren Bereichs kommt; identische Anfragen werden zusammengeführt, höchstens zwei Modelle parallel verarbeitet und sehr große Modelle übersprungen. In „Bibliothek verwalten“ können automatische Vorschaubilder vollständig abgeschaltet werden. Eine vorhandene Blender-Installation kann später optional als „Studio-Render“-Provider verwendet werden, ohne den Standardbetrieb zu beeinflussen.

## Veröffentlichung

Ein Versions-Tag wie `v0.5.0` startet den Workflow `installer-preview.yml`. Er baut ein universelles macOS-DMG für Apple Silicon und Intel sowie ein Windows-x64-Setup, legt automatisch ein GitHub-Prerelease an und hängt beide Installer direkt an. Ein manueller Workflow-Lauf erzeugt nur 14 Tage verfügbare Actions-Artefakte und kein Release.

Für eine öffentliche, warnungsfreie Verteilung werden anschließend Plattform-Zertifikate als verschlüsselte Repository-Secrets ergänzt:

- macOS: Apple Developer ID plus Notarisierung
- Windows: Code-Signing-Zertifikat

Ohne diese privaten Schlüssel bleiben lokale/ad-hoc Builds möglich, Betriebssysteme können beim Öffnen aber zusätzliche Warnungen anzeigen.

Weitere Details: [Architektur](docs/ARCHITECTURE.md), [Datenschutz](PRIVACY.md), [Sicherheit](SECURITY.md).

## Lizenz

Druckarchiv ist kostenlos für unveränderte, nichtkommerzielle Nutzung. Es ist bewusst **keine Open-Source-Software**. Änderungen, abgeleitete Werke, kommerzielle Nutzung sowie das Kopieren oder erneute Veröffentlichen auf anderen Plattformen sind ohne vorherige schriftliche Erlaubnis nicht gestattet. Ein Link auf das offizielle Repository oder den offiziellen Download darf geteilt werden.

Die vollständigen Bedingungen stehen in der Datei [LICENSE](LICENSE). Eingebundene Bibliotheken wie Tauri und Three.js behalten ihre eigenen Lizenzen; die Einschränkungen der Druckarchiv-Lizenz ändern deren Rechte nicht.
