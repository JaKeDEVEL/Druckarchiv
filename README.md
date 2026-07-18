# Druckarchiv

Druckarchiv ist eine lokale Desktop-App zum Ordnen, Filtern und Betrachten von 3D-Druck-Dateien. Man wählt einen Archivordner aus; die App liest dessen Struktur lokal ein und zeigt Projekte, Einzeldateien und Dateitypen als direkt anklickbare Kennzahlen.

## Aktueller Stand

- nativer Ordnerdialog unter macOS und Windows
- rekursiver, schreibgeschützter Archivscan ohne Verfolgung symbolischer Links
- KPI-Filter für Projekte, Dateien, STL, 3MF, CAD, G-Code und Sonstige
- Raster- und Listenansicht
- interaktiver STL-/3MF-Viewer mit Drehen, Zoomen und Verschieben
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

Der drehbare Viewer rendert STL und 3MF direkt mit Three.js/WebGL. Das ist offlinefähig und benötigt Blender nicht. Statische Vorschaubilder werden in einer nächsten Ausbaustufe aus derselben Geometrie lokal erzeugt und im App-Cache abgelegt. Eine vorhandene Blender-Installation kann später optional als „Studio-Render“-Provider verwendet werden, ohne den Standardbetrieb zu beeinflussen.

## Veröffentlichung

Der Workflow `installer-preview.yml` erzeugt herunterladbare Build-Artefakte. Für eine öffentliche, warnungsfreie Verteilung werden anschließend Plattform-Zertifikate als verschlüsselte Repository-Secrets ergänzt:

- macOS: Apple Developer ID plus Notarisierung
- Windows: Code-Signing-Zertifikat

Ohne diese privaten Schlüssel bleiben lokale/ad-hoc Builds möglich, Betriebssysteme können beim Öffnen aber zusätzliche Warnungen anzeigen.

Weitere Details: [Architektur](docs/ARCHITECTURE.md), [Datenschutz](PRIVACY.md), [Sicherheit](SECURITY.md).

