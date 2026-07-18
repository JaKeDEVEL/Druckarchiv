# Architektur und Ausbauplan

## Komponenten

```text
Nativer Ordnerdialog
        │ vom Nutzer freigegebener Pfad
        ▼
Rust-Kern ── schreibgeschützter Scan ──► Archivdaten im Arbeitsspeicher
        │                                      │
        │ geprüfter Modellzugriff              ▼
        └──────────────────────────────► HTML/CSS-Oberfläche
                                               │
                                               ▼
                                      Three.js / WebGL Viewer
```

Die Oberfläche läuft in Tauri über den nativen WebView des Betriebssystems. Rust übernimmt ausschließlich privilegierte Dateisystemoperationen. Das Frontend bekommt keinen allgemeinen Dateisystemzugriff.

## Vorschauen ohne Blender

Der interaktive Viewer ist bereits Blender-unabhängig. Für Rastervorschaubilder ist folgender Ausbau vorgesehen:

1. sichtbare STL-/3MF-Dateien in einem kleinen Offscreen-WebGL-Renderer laden;
2. Geometrie über ihre Bounding Box zentrieren und mit Sicherheitsrand einpassen;
3. PNG/WebP nur in den privaten App-Cache schreiben, Schlüssel aus Pfad, Größe und Änderungszeit;
4. defekte Geometrie durch einen neutralen Dateityp-Platzhalter ersetzen;
5. optional: Blender automatisch erkennen und als explizite „Studio-Qualität“ anbieten.

Damit bleibt der Download klein und der Standard-Viewer funktioniert auf jedem unterstützten Rechner.

## Paketierung

- macOS: nativer Build auf `macos-latest`, Ausgabe als DMG; Release später signiert und notarisert
- Windows: nativer Build auf `windows-latest`, Ausgabe als NSIS-Setup für den aktuellen Benutzer
- Quellcode: identisch, plattformspezifisch sind nur Build und Signatur

## Datenschutzgrenze

`_druckarchiv_app` ist die einzige veröffentlichbare Quelle. Der übergeordnete private Archivordner, die generierte HTML-Übersicht, `_uebersicht/inventory.json`, Vorschaubilder und Modellordner gehören ausdrücklich nicht in das Repository. Der Privacy-Check erzwingt diese Grenze zusätzlich.

