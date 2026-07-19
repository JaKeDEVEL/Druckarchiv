# Druckarchiv

Druckarchiv ist eine lokale Desktop-App zum Ordnen, Filtern und Betrachten von 3D-Druck-Dateien. Man wählt einen oder mehrere Archivordner aus; die App liest deren Struktur lokal ein und zeigt Projekte, Einzeldateien und Dateitypen als direkt anklickbare Kennzahlen.

<p align="center">
  <img src="assets/brand/druckarchiv-promo-square.png" width="720" alt="Druckarchiv – lokale 3D-Druck-Bibliothek für macOS und Windows" />
</p>

## Aktueller Stand

- mehrere Bibliotheksordner über den nativen Ordnerdialog unter macOS und Windows
- rekursiver, schreibgeschützter Archivscan ohne Verfolgung symbolischer Links
- einfache Standardauswahl für STL, 3MF, OBJ und G-Code; weitere Mesh-, CAD- und Referenzformate sind Opt-in
- Ausschlüsse nach Endung, Dateiname oder relativem Pfad mit Platzhaltern
- dynamische KPI-Filter: Neben Projekten und Dateien erscheinen nur die in der Verwaltung aktivierten Formatgruppen
- Raster- und Listenansicht mit allen Dateien aus sämtlichen Unterordnern
- speicherschonende Pagination mit wahlweise 25 oder 50 Einträgen pro Seite
- lokal und verzögert erzeugte Modell-Thumbnails mit sichtbarem Ladefortschritt; in der Verwaltung abschaltbar
- interaktiver STL-/3MF-/OBJ-Viewer mit Drehen, Zoomen und Verschieben – auch direkt aus Projektordnern
- deutsche und englische Oberfläche mit Systemsprache, manuellem Wechsel und lokal gespeichertem Sprachwunsch
- keine Telemetrie, kein Benutzerkonto und kein Upload
- Blender ist **keine Voraussetzung**

Die App-Basis ist bewusst von einem realen Archiv getrennt. Dieses Repository enthält keine Modelle, Dateinamen, absoluten Benutzerpfade, Vorschaubilder oder Inventardaten.

## Einblick

Alle Aufnahmen verwenden ausschließlich synthetische Demodaten und enthalten keine privaten Dateinamen oder Pfade.

### Projektübersicht

![Druckarchiv Projektübersicht](docs/screenshots/projektuebersicht.png)

### Alle Dateien

![Druckarchiv Dateiansicht](docs/screenshots/dateiansicht.png)

### Bibliothek verwalten

![Druckarchiv Bibliotheksverwaltung](docs/screenshots/bibliothek-verwalten.png)

## Vorschau-Strategie

Der drehbare Viewer und die Karten-Thumbnails rendern STL, 3MF und OBJ direkt mit Three.js/WebGL. Das ist offlinefähig und benötigt Blender nicht. Einträge erscheinen gestaffelt, damit KPI- und Ansichtswechsel sofort reagieren. Thumbnails werden erst erzeugt, wenn eine Karte in die Nähe des sichtbaren Bereichs kommt; identische Anfragen werden zusammengeführt, höchstens zwei Modelle parallel verarbeitet und sehr große Modelle übersprungen. In „Bibliothek verwalten“ können automatische Vorschaubilder vollständig abgeschaltet werden. Eine vorhandene Blender-Installation kann später optional als „Studio-Render“-Provider verwendet werden, ohne den Standardbetrieb zu beeinflussen.

Weitere Informationen: [Datenschutz](PRIVACY.md), [Sicherheit](SECURITY.md).

## Projekt unterstützen

Druckarchiv ist kostenlos nutzbar. Wenn dir das Projekt hilft und du seine Weiterentwicklung unterstützen möchtest, kannst du mir über PayPal einen Kaffee spendieren:

[☕ Druckarchiv über PayPal unterstützen](https://paypal.me/jkehl)

Vielen Dank – jede Unterstützung hilft dabei, Druckarchiv weiterzuentwickeln und die Installer für macOS und Windows bereitzustellen.

## Lizenz

Druckarchiv ist kostenlos für unveränderte, nichtkommerzielle Nutzung. Es ist bewusst **keine Open-Source-Software**. Änderungen, abgeleitete Werke, kommerzielle Nutzung sowie das Kopieren oder erneute Veröffentlichen auf anderen Plattformen sind ohne vorherige schriftliche Erlaubnis nicht gestattet. Ein Link auf das offizielle Repository oder den offiziellen Download darf geteilt werden.

Die vollständigen Bedingungen stehen in der Datei [LICENSE](LICENSE). Eingebundene Bibliotheken wie Tauri und Three.js behalten ihre eigenen Lizenzen; die Einschränkungen der Druckarchiv-Lizenz ändern deren Rechte nicht.
