# PlayStation-Trophäenmodelle

Die Trophäen-Zentrale nutzt einen bei Bedarf geladenen Three.js-Viewer.

Vier vom Nutzer bereitgestellte Original-GLB-Dateien gehören hierher:

| Dateiname | Rang |
|---|---|
| `platinum.glb` | Platin |
| `gold.glb` | Gold |
| `silver.glb` | Silber |
| `bronze.glb` | Bronze / Roségold |

Die Dateien werden **nicht** durch generische Modelle ersetzt. Bis die GLBs veröffentlicht sind, rendert der Viewer ein einfaches prozedurales Three.js-Trophäenmodell. Es ist **nicht** identisch mit den vier bereitgestellten Originalmodellen. Die Originaldateien liegen in der separat erzeugten Asset-ZIP `PlayStation-Radar-3D-Trophaeen-Assets.zip` bereit.

Im Browser werden die Modelle erst beim Öffnen eines Rangs geladen. Es wird höchstens ein WebGL-Canvas gleichzeitig verwendet.
