# Architektur und Ausbauplan

## Komponenten

```text
Nativer Ordnerdialog
        │ bis zu 32 freigegebene Pfade
        ▼
Rust-Kern ── schreibgeschützter Scan ──► Archivdaten im Arbeitsspeicher
        │                                      │
        │ geprüfter Modellzugriff              ▼
        └──────────────────────────────► HTML/CSS-Oberfläche
                                               │
                                               ▼
                                      Three.js / WebGL Viewer
```

Die Oberfläche läuft in Tauri über den nativen WebView des Betriebssystems. Rust übernimmt ausschließlich privilegierte Dateisystemoperationen. Das Frontend bekommt keinen allgemeinen Dateisystemzugriff. Jede Datei trägt den Index ihres kanonisch geprüften Ursprungsordners; verschachtelte oder doppelte Quellen werden vor dem Scan zusammengeführt.

Formatwahl und Ausschlussregeln filtern die eingelesenen Metadaten im Frontend. Dadurch gelten sie identisch für KPI-Zahlen, Projektkarten, Einzeldateien und Projektinhalte. Nur Ordnerpfade und Regeln werden lokal persistiert, niemals Inventardaten oder Modelldateien.

## Vorschauen ohne Blender

Der interaktive Viewer und die Rastervorschaubilder sind Blender-unabhängig. Große Ergebnismengen werden auf 25 oder 50 Einträge pro Seite begrenzt; nur die aktuelle Seite erzeugt DOM-Karten und Preview-Aufträge. Sichtbare STL-, 3MF- und OBJ-Dateien werden mit begrenzter Parallelität in einem kleinen Offscreen-WebGL-Renderer geladen; ein Fortschrittsindikator macht diese zweite Phase sichtbar. Doppelte gleichzeitige Modellanfragen werden zusammengeführt und alte Warteschlangen beim Ansichtswechsel verworfen. Die Geometrie wird über ihre Bounding Sphere zentriert und mit Sicherheitsrand eingepasst, damit lange oder flache Modelle nicht abgeschnitten werden. Die aktuelle Sitzung hält höchstens 240 Vorschaubilder im Arbeitsspeicher; Dateien über 64 MB und defekte Geometrie behalten einen neutralen Platzhalter. Nutzer können automatische Karten-Vorschauen abschalten, ohne den interaktiven Viewer zu deaktivieren.

Ein späterer persistenter App-Cache kann Pfad, Größe und Änderungszeit als Schlüssel verwenden. Blender bleibt eine optionale spätere „Studio-Qualität“ und ist für den Standardbetrieb nicht erforderlich.

## Lokalisierung

`src/i18n.js` erkennt beim ersten Start die Systemsprache, verwaltet Fallback, Pluralformen sowie lokalisierte Zahlen und Datumswerte. Die eigentlichen Texte liegen getrennt unter `src/locales/de.js` und `src/locales/en.js`. Ein manueller Sprachwechsel wird ausschließlich lokal gespeichert. Statische HTML-Texte verwenden `data-i18n`-Attribute; dynamische Karten, Dialoge, Status- und Fehlermeldungen greifen auf dieselbe Übersetzungsfunktion zu.

## Paketierung

- macOS: nativer Build auf `macos-latest`, Ausgabe als DMG; Release später signiert und notarisert
- Windows: nativer Build auf `windows-latest`, Ausgabe als NSIS-Setup für den aktuellen Benutzer
- Quellcode: identisch, plattformspezifisch sind nur Build und Signatur

## Datenschutzgrenze

`_druckarchiv_app` ist die einzige veröffentlichbare Quelle. Der übergeordnete private Archivordner, die generierte HTML-Übersicht, `_uebersicht/inventory.json`, Vorschaubilder und Modellordner gehören ausdrücklich nicht in das Repository. Der Privacy-Check erzwingt diese Grenze zusätzlich.
