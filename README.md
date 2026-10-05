# Revisión sistemática: agua potable y salud en Uruguay

Página web para registrar las búsquedas bibliográficas, las referencias y el cribado PRISMA de la revisión.

- **Cualquiera** puede ver los registros desde la página, sin cuenta.
- **Solo quien tiene la clave** puede agregar o editar.
- Todos los datos se guardan solos en una **planilla de Google Sheets**, y los PDF en **Google Drive** con nombre automático (`R004_Gonzalez_2019_Nitratos-agua-consumo-rural.pdf`).
- Las fechas se registran solas: cuándo se cargó cada referencia, cuándo se cribó, cada cambio de estado y cuándo se guardó el PDF.

## Cómo está armado

| Parte | Dónde está |
|---|---|
| Página web | Este repositorio, publicado con GitHub Pages |
| Datos | Planilla «Registro revisión agua potable y salud UY» en Drive (hojas *Busquedas*, *Referencias* e *Historial*) |
| PDF | Carpeta de Drive «2 - PDFs ordenados» |
| Motor que conecta la página con la planilla | `apps-script/Codigo.gs` (se pega dentro de la planilla) |

## Puesta en marcha (una sola vez)

Es más cómodo desde una computadora, pero se puede hacer desde el navegador del celular en modo «Sitio de escritorio».

### 1. Pegar el motor en la planilla

1. Abre la planilla **Registro revisión agua potable y salud UY** en tu Drive.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que aparece y pega todo el contenido de [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
4. En la línea `const CLAVE = 'cambia-esta-clave';` pon una clave tuya (la vas a usar para editar desde la página).
5. Guarda (ícono del disquete).

### 2. Preparar la planilla y dar permisos

1. Arriba, en el selector de funciones, elige **prepararPlanilla** y toca **Ejecutar**.
2. Google te pide permisos: **Revisar permisos → tu cuenta → Configuración avanzada → Ir a … (no seguro) → Permitir**. Es tu propio código; el aviso sale porque Google no lo revisó.
3. Vuelve a la planilla: ahora tiene las hojas *Busquedas*, *Referencias* e *Historial*.

### 3. Publicar el motor

1. En Apps Script: **Implementar → Nueva implementación**.
2. Tipo (ícono de engranaje): **Aplicación web**.
3. *Ejecutar como*: **Yo**. *Quién tiene acceso*: **Cualquier usuario**.
4. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).

> «Cualquier usuario» solo deja **leer** los registros. Para escribir hace falta la clave.

### 4. Conectar la página

Pega esa URL en [`config.js`](config.js):

```js
window.API_URL = "https://script.google.com/macros/s/……/exec";
```

(O pásale la URL a Claude y lo hace.)

### 5. Activar GitHub Pages

En el repositorio: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**. En un par de minutos la página queda en `https://<tu-usuario>.github.io/<repositorio>/`.

### 6. Entrar al modo edición

En la página toca **🔒 Solo lectura**, escribe tu clave y listo. Queda guardada en ese dispositivo (hazlo una vez en el celular y otra en la compu).

## Cribado doble ciego (Revisor 1, 2 y 3)

En `Codigo.gs`, además de `CLAVE` (administración), cada revisor tiene su clave:

```js
const REVISORES = {
  'Revisor 1': 'clave-del-revisor-1',
  'Revisor 2': 'clave-del-revisor-2',
  'Revisor 3': 'clave-del-revisor-3',
};
```

- **Administración** (`CLAVE`): registra búsquedas, importa, edita y borra. Puede ser la misma clave que la del Revisor 1.
- **Revisor 1 y Revisor 2**: criban a ciegas las dos fases. Cada uno ve solo sus decisiones y cuánto avanzó el otro, nunca qué decidió.
- **Revisor 3**: no criba; resuelve conflictos.
- Si los dos coinciden, el artículo avanza solo. Si no, aparece en **⚖️ Conflictos** (solo cuando los dos decidieron) y se resuelve por **consenso entre Revisor 1 y 2** o por **decisión del Revisor 3**; queda registrado cuál.
- Las decisiones individuales se guardan en la hoja *Decisiones* y **no** se muestran en la página pública. En la pestaña PRISMA se publica solo el acuerdo (kappa de Cohen).
- Cada revisor entra en la página con «🔒 Solo lectura» y su clave. Pasa cada clave en privado.

## Si cambias el código de Apps Script

Si el código nuevo usa permisos nuevos, antes de implementar ejecuta otra vez **prepararPlanilla** y acepta los permisos.

Después de editar `Codigo.gs`: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. La URL no cambia.

## Cadenas de búsqueda

- [`docs/cadenas-de-busqueda.md`](docs/cadenas-de-busqueda.md): cadenas para cada base, enfocadas en estudios de Uruguay.
- [`docs/literatura-uruguaya.md`](docs/literatura-uruguaya.md): Latindex, revistas uruguayas para revisar a mano, repositorios no indexados y primeros candidatos encontrados.

## Uso diario

Pestañas: **Inicio · Protocolo · Búsquedas · Referencias · Estudios · PRISMA · Exportar**.

- **Inicio**: «¿Qué sigue?» (el próximo paso de la revisión), números clave, barras de avance, gráficos de artículos por año y de incluidos por exposición y una guía rápida con glosario. Cada pestaña tiene además un «📖 ¿Qué es esto?».
- **Cribado inteligente**: al cribar, «🧠 Más probables primero» ordena los pendientes según las palabras del protocolo y el chequeo de Uruguay y, desde que hay 5 que pasaron y 5 excluidos, según lo que aprende de las decisiones (clasificador bayesiano en el navegador). Solo ordena: todos se criban igual.
- **Comentarios** privados entre revisoras en cada artículo (ficha, cribado y conflictos).
- **Mapa de evidencia** (exposición × efecto en salud) con las categorías marcadas en la extracción, y **tabla GRADE** (resumen de hallazgos con certeza alta, moderada, baja o muy baja; sugiere la certeza y se descarga para Word).
- **Checklist PRISMA 2020**: los 27 ítems, lo que la página ya genera para cada uno y la página del manuscrito; se descarga para Word.
- **Paquete de reproducibilidad** (Exportar): un .zip con protocolo, búsquedas, referencias, historial, decisiones, comentarios, extracción, riesgo de sesgo, GRADE, diagrama, texto de métodos y checklist.
- **Sin conexión**: la página abre sin internet y las decisiones de cribado se guardan en el dispositivo hasta que vuelve la conexión.

- **Protocolo**: pregunta PECO, criterios de inclusión y exclusión, diseños elegibles, PROSPERO, herramienta de riesgo de sesgo y palabras para resaltar. Los criterios se ven mientras se criba.
- **Método de cada búsqueda**: «Bases de datos y registros» u «Otros métodos» (repositorios, sitios web, búsqueda manual, rastreo de citas). Define en qué columna del diagrama PRISMA cuenta.
- **Cribado**: *Pasa*, *Quizás* (pasa a texto completo y queda registrado), *Excluir*, *Duplicado*; en texto completo, *Incluir*, *Excluir* o *No se consiguió* (texto completo no recuperado, como pide PRISMA). Las palabras del protocolo se resaltan en verde (a favor) y rojo (en contra).
- **Estudios**: para cada incluido, extracción de datos con formulario estándar (la verifica otra persona) y riesgo de sesgo con ROBINS-E (7 dominios y juicio global). Semáforo de riesgo de sesgo, tabla de características y mapa esquemático de Uruguay por departamento.
- **PRISMA**: diagrama de flujo PRISMA 2020 oficial (dos columnas) descargable en PNG o SVG, kappa por fase, texto de métodos y resultados listo para copiar, y tabla de estrategias de búsqueda (PRISMA-S) para el anexo en Word o CSV.
- **Rastreo de citas**: en una nueva búsqueda, «🔁 Rastreo de citas de los estudios incluidos» trae con OpenAlex las referencias de cada incluido y los artículos que lo citan, con el chequeo de Uruguay (por defecto carga solo los relacionados con Uruguay).
- **Actualizar una búsqueda**: abre una búsqueda y toca «🔄 Actualizar esta búsqueda». La repite hoy (PubMed y Colibri solos; las demás adjuntando el archivo) y carga solo los artículos nuevos.

- **Búsquedas**: base, fecha, cadena exacta, filtros y número de resultados.
- **🔍 Cadenas de búsqueda** (desplegable en Búsquedas): las cadenas del protocolo para cada base (PubMed con MeSH, BVS/LILACS con DeCS, SciELO, Scopus, Web of Science, Google Scholar), principales y secundarias, con «📋 Copiar» y «🔎 Abrir en…».
- **Hilos RSS/Atom**: en una búsqueda, «Traer desde un hilo de sindicación» acepta el link de un hilo RSS/Atom o de un XML en línea (lo baja el motor). Con un link de búsqueda de Colibri arma solo el hilo de resultados. También se puede adjuntar el hilo guardado como archivo.
- **Cribar**: en Referencias toca «▶ Cribar». Muestra un artículo por vez con título, autores, resumen y el chequeo de Uruguay. Fase 1 (título y resumen): *Pasa*, *Excluir* (con motivo) o *Duplicado*. Fase 2 (texto completo): *Incluir* o *Excluir*. Cada decisión se guarda sola con su fecha; *Deshacer* vuelve atrás. En la compu: teclas S, N, D, → y ←.
- **Completar una búsqueda sola**: en «Nueva búsqueda» pega el link de la página de resultados (PubMed, BVS/LILACS, SciELO, Colibri, Google Scholar, Scopus…) y toca «Completar»: saca la base, la cadena y los filtros. Si además adjuntas el archivo de resultados, cuenta cuántos hay y al guardar carga todos los artículos. Con un link de PubMed no hace falta archivo: «Traer artículos de PubMed» los baja directamente. El link queda guardado en la búsqueda.
- **Importar resultados**: abre una búsqueda guardada y elige el archivo exportado de la base (PubMed: *Save → Format: PubMed*; LILACS/BVS, Scopus, Web of Science, SciELO: *RIS* (recomendado); también BibTeX, CSV y XML de PubMed o de repositorios como Colibri). Se cargan todos los artículos como «Pendiente de cribado», con los duplicados ya marcados y el chequeo de Uruguay hecho.
- **Completar solo**: en una referencia nueva pega el DOI, el PMID o el link y toca «Completar». Busca en OpenAlex, Crossref y PubMed y llena título, autores, año, revista, DOI, link y resumen. Además avisa si hay autores con afiliación en Uruguay o si el artículo menciona Uruguay, y si existe un PDF de acceso abierto lo guarda solo en Drive.
- **Referencias**: título, autores, año, revista, DOI, link de la fuente, resumen, estado del cribado, motivo de exclusión, exposición y notas. El código (`R001`, `R002`…) se asigna solo.
- **PDF**: «Subir PDF» lo guarda en Drive con el nombre automático. Si el PDF pesa más de 30 MB, guárdalo en Drive y pega el link.
- **PRISMA**: el diagrama de flujo se calcula solo.
- **Exportar**: CSV (Excel, R) y RIS (Zotero, Mendeley, Rayyan).
