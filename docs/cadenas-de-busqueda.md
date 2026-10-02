# Cadenas de búsqueda: agua potable de consumo y salud en Uruguay

Criterio central: **solo estudios realizados en Uruguay** (población, muestras o sistemas de agua uruguayos).

Estrategia: dos bloques unidos con `AND`.

1. **Agua de consumo** (sinónimos en inglés, español y portugués).
2. **Uruguay** (país, capital, departamentos inconfundibles y afiliación de los autores).

No se agrega un bloque de "salud" a propósito. La literatura uruguaya sobre el tema es acotada, y filtrar por desenlaces de salud en la búsqueda haría perder estudios relevantes (por ejemplo, calidad del agua con implicancias sanitarias). La salud se evalúa en el cribado.

> Fuera del bloque de búsqueda quedan departamentos cuyo nombre coincide con otros lugares o palabras comunes: Florida, Colonia, Salto, Rivera, Flores, Durazno, Rocha, Artigas, Río Negro, San José. Se cubren igual porque esos artículos casi siempre mencionan "Uruguay".

Registra cada búsqueda en la página (pestaña **Búsquedas**) con la fecha, la cadena exacta, los filtros y el número de resultados.

---

## PubMed / MEDLINE

```
("Drinking Water"[Mesh] OR "Water Supply"[Mesh] OR "Water Quality"[Mesh]
 OR "Water Pollution"[Mesh] OR "Water Microbiology"[Mesh] OR "Water Purification"[Mesh]
 OR "drinking water"[tiab] OR "tap water"[tiab] OR "potable water"[tiab]
 OR "water supply"[tiab] OR "water quality"[tiab] OR "well water"[tiab]
 OR "groundwater"[tiab] OR "water contamination"[tiab]
 OR "agua potable"[tiab] OR "agua de consumo"[tiab] OR "agua de bebida"[tiab])
AND
("Uruguay"[Mesh] OR urugua*[tiab] OR urugua*[ad] OR "Montevideo"[tiab] OR "Montevideo"[ad]
 OR "Canelones"[tiab] OR "Paysandu"[tiab] OR "Tacuarembo"[tiab] OR "Treinta y Tres"[tiab]
 OR "Cerro Largo"[tiab] OR "Maldonado"[tiab] OR "Lavalleja"[tiab] OR "Soriano"[tiab])
```

- `[ad]` busca en la **afiliación** de los autores: atrapa estudios de equipos uruguayos aunque el resumen no diga "Uruguay".
- Filtros sugeridos: ninguno de idioma ni de fecha (anótalo igual en "Filtros").

## BVS / LILACS

En https://pesquisa.bvsalud.org/portal/ (búsqueda avanzada):

```
(mh:"Agua Potable" OR mh:"Abastecimiento de Agua" OR mh:"Calidad del Agua"
 OR mh:"Contaminación del Agua" OR mh:"Microbiología del Agua"
 OR tw:"agua potable" OR tw:"agua de consumo" OR tw:"agua de bebida"
 OR tw:"abastecimiento de agua" OR tw:"calidad del agua" OR tw:"agua de pozo"
 OR tw:"drinking water" OR tw:"water quality" OR tw:"água potável")
AND
(mh:Uruguay OR tw:urugua* OR tw:Montevideo OR tw:Canelones OR tw:Paysandu
 OR tw:Tacuarembo OR tw:"Treinta y Tres" OR tw:"Cerro Largo" OR tw:Maldonado)
```

- Después aplica el filtro **Base de datos: LILACS** (y anota también cuántos salen en "todas las bases").
- Prueba aparte el filtro **País/Región como asunto: Uruguay** solo con el bloque de agua, y compara.

## SciELO

En https://search.scielo.org/ (todas las colecciones):

```
("agua potable" OR "agua de consumo" OR "agua de bebida" OR "calidad del agua"
 OR "abastecimiento de agua" OR "drinking water" OR "water quality" OR "água potável")
AND (uruguay OR montevideo)
```

Segunda búsqueda: colección **SciELO Uruguay** solo con el bloque de agua (sin `AND uruguay`).

## Scopus (vía Timbó)

```
TITLE-ABS-KEY("drinking water" OR "tap water" OR "potable water" OR "water supply"
 OR "water quality" OR "well water" OR groundwater OR "agua potable" OR "agua de consumo")
AND
(TITLE-ABS-KEY(urugua* OR montevideo OR canelones OR paysandu OR tacuarembo
 OR "treinta y tres" OR "cerro largo" OR maldonado) OR AFFILCOUNTRY(uruguay))
```

## Web of Science (vía Timbó)

```
TS=("drinking water" OR "tap water" OR "potable water" OR "water supply"
 OR "water quality" OR "well water" OR groundwater OR "agua potable")
AND (TS=(urugua* OR montevideo OR canelones OR paysandu OR tacuarembo
 OR "treinta y tres" OR "cerro largo" OR maldonado) OR CU=Uruguay)
```

## Google Scholar (complementaria)

Google Scholar acepta cadenas cortas. Revisa las primeras 200 o 300 entradas y anota cuántas revisaste.

```
"agua potable" OR "agua de consumo" Uruguay salud
"drinking water" Uruguay health
```

## Repositorios y literatura gris uruguaya

- **Colibri (UdelaR)**: `agua potable`, `calidad del agua`, `agua de consumo` (todo es uruguayo).
- **Biblioteca del MSP**, **OSE** (informes de calidad de agua), **URSEA**, **Ministerio de Ambiente / DINACEA**, **DINAGUA**, **INIA**.
- **Revista Médica del Uruguay**, **Anales de la Facultad de Medicina**, **Archivos de Pediatría del Uruguay**: búsqueda manual en sus sitios si no están completas en LILACS/SciELO.
- **Rastreo de referencias** de los estudios incluidos.
