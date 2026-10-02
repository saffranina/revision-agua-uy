# Cadenas de búsqueda: cianobacterias y agrotóxicos en el agua de consumo humano y salud humana en Uruguay

**Alcance**
- **Agua:** de consumo humano, la que sale de la canilla (red pública de OSE) u otras fuentes para beber (pozos, aljibes). **No** agua recreativa.
- **Exposición:** cianobacterias y cianotoxinas, y agrotóxicos (plaguicidas). *(Hay un tercer contaminante pendiente de definir: cuando se defina, se agrega como otro bloque con `OR` dentro de la exposición.)*
- **Desenlace:** salud **humana** (no animal).
- **Lugar:** solo estudios realizados en Uruguay.

**Estrategia:** tres bloques unidos con `AND`:

1. **Agua de consumo** (español, inglés, portugués).
2. **Exposición:** cianobacterias/cianotoxinas `OR` agrotóxicos.
3. **Uruguay** (país, capital, departamentos inconfundibles y afiliación de los autores).

A propósito no se agrega un bloque de "salud humana": la literatura uruguaya es acotada y filtrar por desenlace en la búsqueda haría perder estudios. Lo animal, lo recreativo y lo solo ambiental se excluyen en el cribado (están en los criterios del protocolo y se resaltan en rojo al cribar).

Registra cada búsqueda en la página (pestaña **Búsquedas**): pega el link de los resultados y toca **Completar**.

---

## PubMed / MEDLINE

```
("Drinking Water"[Mesh] OR "Water Supply"[Mesh] OR "Water Purification"[Mesh]
 OR "drinking water"[tiab] OR "tap water"[tiab] OR "potable water"[tiab]
 OR "water supply"[tiab] OR "public water"[tiab] OR "well water"[tiab]
 OR "agua potable"[tiab] OR "agua de consumo"[tiab] OR "agua de bebida"[tiab])
AND
("Cyanobacteria"[Mesh] OR "Microcystins"[Mesh] OR "Marine Toxins"[Mesh] OR "Harmful Algal Bloom"[Mesh]
 OR cyanobacteri*[tiab] OR cyanotoxin*[tiab] OR microcystin*[tiab] OR saxitoxin*[tiab]
 OR cylindrospermopsin*[tiab] OR anatoxin*[tiab] OR "algal bloom*"[tiab]
 OR "Pesticides"[Mesh] OR "Herbicides"[Mesh] OR "Insecticides"[Mesh] OR "Agrochemicals"[Mesh]
 OR pesticide*[tiab] OR herbicide*[tiab] OR agrochemical*[tiab] OR glyphosate[tiab]
 OR atrazine[tiab] OR chlorpyrifos[tiab] OR "2,4-D"[tiab] OR endosulfan[tiab] OR imidacloprid[tiab]
 OR plaguicida*[tiab] OR agrotoxico*[tiab] OR agroquimico*[tiab])
AND
("Uruguay"[Mesh] OR urugua*[tiab] OR urugua*[ad] OR "Montevideo"[tiab] OR "Montevideo"[ad]
 OR "Canelones"[tiab] OR "Paysandu"[tiab] OR "Tacuarembo"[tiab] OR "Treinta y Tres"[tiab]
 OR "Cerro Largo"[tiab] OR "Maldonado"[tiab] OR "Lavalleja"[tiab] OR "Soriano"[tiab]
 OR "Santa Lucia"[tiab] OR "Rio Negro"[tiab] OR "Laguna del Sauce"[tiab])
```

- `[ad]` busca en la **afiliación** de los autores: aparecen los estudios de equipos uruguayos aunque el resumen no diga "Uruguay".
- Se agregan las cuencas que abastecen de agua potable (río **Santa Lucía**, **Laguna del Sauce**, río **Negro**), donde se concentran las floraciones de cianobacterias.
- En la página: con el link de PubMed, «Traer artículos de PubMed» carga todo sin archivo.

## BVS / LILACS

En https://pesquisa.bvsalud.org/portal/ (búsqueda avanzada):

```
(mh:"Agua Potable" OR mh:"Abastecimiento de Agua" OR mh:"Purificación del Agua"
 OR tw:"agua potable" OR tw:"agua de consumo" OR tw:"agua de bebida" OR tw:"agua de canilla"
 OR tw:"abastecimiento de agua" OR tw:"agua de pozo" OR tw:"drinking water" OR tw:"água potável")
AND
(mh:Cianobacterias OR mh:Microcistinas OR mh:"Floraciones de Algas Nocivas"
 OR tw:cianobacteria* OR tw:cianotoxina* OR tw:microcistina* OR tw:saxitoxina* OR tw:cyanobacteri*
 OR mh:Plaguicidas OR mh:Herbicidas OR mh:Agroquímicos
 OR tw:plaguicida* OR tw:agrotoxico* OR tw:agroquimico* OR tw:pesticida* OR tw:herbicida*
 OR tw:glifosato OR tw:atrazina OR tw:clorpirifos OR tw:agrotóxico*)
AND
(mh:Uruguay OR tw:urugua* OR tw:Montevideo OR tw:Canelones OR tw:Paysandu
 OR tw:Tacuarembo OR tw:"Santa Lucia" OR tw:"Laguna del Sauce")
```

Después aplica el filtro **Base de datos: LILACS** (y anota cuántos salen en "todas las bases"). Exporta en **RIS**.

## SciELO

En https://search.scielo.org/ (todas las colecciones):

```
("agua potable" OR "agua de consumo" OR "agua de bebida" OR "drinking water" OR "água potável")
AND (cianobacteria* OR cianotoxina* OR microcistina* OR cyanobacteri* OR plaguicida* OR agrotoxico*
 OR agroquimico* OR pesticida* OR glifosato OR atrazina)
AND (uruguay OR montevideo)
```

Segunda búsqueda: colección **SciELO Uruguay** sin el bloque de Uruguay. Exporta en **RIS**.

## Scopus (vía Timbó)

```
TITLE-ABS-KEY("drinking water" OR "tap water" OR "potable water" OR "water supply" OR "well water" OR "agua potable")
AND TITLE-ABS-KEY(cyanobacteri* OR cyanotoxin* OR microcystin* OR saxitoxin* OR cylindrospermopsin*
 OR "algal bloom*" OR pesticide* OR herbicide* OR agrochemical* OR glyphosate OR atrazine OR chlorpyrifos)
AND (TITLE-ABS-KEY(urugua* OR montevideo OR canelones OR paysandu OR tacuarembo OR "santa lucia"
 OR "laguna del sauce") OR AFFILCOUNTRY(uruguay))
```

## Web of Science (vía Timbó)

```
TS=("drinking water" OR "tap water" OR "potable water" OR "water supply" OR "well water" OR "agua potable")
AND TS=(cyanobacteri* OR cyanotoxin* OR microcystin* OR saxitoxin* OR "algal bloom*"
 OR pesticide* OR herbicide* OR agrochemical* OR glyphosate OR atrazine OR chlorpyrifos)
AND (TS=(urugua* OR montevideo OR canelones OR paysandu OR "santa lucia" OR "laguna del sauce") OR CU=Uruguay)
```

## Google Scholar (complementaria)

Cadenas cortas (revisa las primeras 200 o 300 entradas y anota cuántas):

```
"agua potable" cianobacterias Uruguay salud
"agua potable" agrotóxicos OR plaguicidas Uruguay salud
"drinking water" cyanobacteria OR pesticides Uruguay health
```

## Repositorios y literatura gris uruguaya (otros métodos)

- **Colibri (UdelaR)**: `cianobacterias agua potable`, `agrotóxicos agua`, `plaguicidas agua potable`, `glifosato agua` (en la página: con el link de Colibri se arma solo el hilo de resultados).
- **OSE**: informes de calidad de agua y de monitoreo de cianobacterias (Santa Lucía, Laguna del Sauce).
- **MSP**: alertas y protocolos por floraciones de cianobacterias e intoxicaciones por plaguicidas; **CIAT** (Centro de Información y Asesoramiento Toxicológico).
- **Ministerio de Ambiente / DINACEA**, **URSEA**, **INIA**, **Facultad de Ciencias (Sección Limnología)**, **Facultad de Química**.
- **Revista Médica del Uruguay**, **Anales de la Facultad de Medicina**, **Archivos de Pediatría del Uruguay**, **INNOTEC**, **Agrociencia Uruguay**: búsqueda manual si no están completas en LILACS/SciELO.
- **Rastreo de citas** de los estudios incluidos (en la página: «🔁 Rastreo de citas»).
