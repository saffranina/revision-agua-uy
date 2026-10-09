# Contexto para Claude

## La usuaria y cómo hablarle
- Es investigadora en Uruguay. No es programadora: explica en pasos cortos, sin jerga.
- Escríbele en **castellano neutro con «tú»**. **Nunca uses voseo rioplatense** (nada de «vos», «tenés», «querés»).
- **Nunca le digas que pare, que descanse ni que se vaya a dormir.** Ella marca el ritmo.
- **Nunca le pidas las claves** de la página ni las escribas en el repositorio. Las claves están solo en el Apps Script y en un documento privado de su Drive.
- Trabaja muchas veces desde el celular o desde la compu del trabajo: lo que le pidas hacer en Apps Script tiene que ser concreto («busca X con Ctrl+F y pega esto debajo»).
- Cuando dice «no toques nada, es una pregunta», solo responde: no cambies código.

## La revisión
Revisión con método de revisión sistemática (PRISMA 2020), aunque informal: **contaminantes del agua de consumo humano y salud humana en Uruguay**.
- **Agua:** la que se bebe en el punto de consumo (canilla, red de OSE, pozos, aljibes). No agua recreativa.
- **Salud humana**, no animal. **Solo estudios de Uruguay.**
- **Interés principal:** cianobacterias/cianotoxinas y agrotóxicos.
- **Interés secundario:** trihalometanos, sodio y cloruros (crisis hídrica 2023), nitratos, metales (arsénico, plomo), microplásticos.
- **Foco agregado:** cadena «agua de canilla / punto de consumo» (tap water, household water, point-of-use, well water…) con todos los contaminantes.
- **Hallazgo hasta ahora:** mucha investigación sobre contaminantes en el agua de Uruguay y muy poca sobre efectos en la salud humana (brecha de evidencia). Lo más sólido: estudio *Salud Ambiental Montevideo* (arsénico y plomo en niños; el agua del hogar no fue la fuente principal). Se sugirió presentarlo como mapeo de evidencia / revisión de alcance. A la tutora le gustó.
- Etapa actual: **una sola revisora** (ella, con la clave de administración: cribado directo). El doble ciego (Revisor 1 y 2) está implementado para una revisión formal futura.

## Cómo está armada la página
- **Página:** GitHub Pages de este repositorio (`saffranina/revision-agua-uy`), JavaScript sin frameworks, scripts clásicos que comparten variables globales.
- **Motor:** Google Apps Script (`apps-script/Codigo.gs`) pegado dentro de la planilla «Registro revisión agua potable y salud UY». Hace de API JSON sobre Google Sheets. La URL del motor está en `config.js`.
- **Hojas:** Busquedas, Referencias (más de 10.000 filas), Historial, Protocolo, Extraccion, Sesgo, Grade, Comentarios, Decisiones (privada).
- **Archivos principales:**
  - `app.js`: núcleo (datos, roles, búsquedas, referencias, cribado, fila de guardado, PRISMA).
  - `importar.js`: RIS, PubMed, XML de PubMed, XML de la BVS (Solr), Dublin Core, RSS/Atom, BibTeX, CSV; PubMed por link.
  - `autocompletar.js`: DOI, PMID, ISBN y título (OpenAlex, Crossref, PubMed, Google Books, Open Library).
  - `cadenas.js`: cadenas de búsqueda (principal, secundario, agua de canilla; con y sin MeSH/DeCS).
  - `buscador.js`: pestaña «Buscar (beta)» (PubMed, LILACS, SciELO Uruguay, Europe PMC, OpenAlex, Colibri).
  - `herramientas.js`: PDFs abiertos en lote, posibles duplicados, búsqueda manual y literatura gris.
  - `estudios.js`: protocolo, extracción, ROBINS-E, mapa de evidencia, GRADE.
  - `autoextraccion.js`: «✨ Completar automáticamente» la extracción (patrones sobre el resumen y el texto completo de Europe PMC).
  - `extras.js`: inicio, checklist PRISMA, comentarios, paquete de reproducibilidad, fila sin conexión.
- **Referencias:** de a 50 por página, selección de varios, auto-cribado por palabras en el título (con sugerencias), por «sin Uruguay» y por «sin agua».
- **Fila de guardado del cribado:** las decisiones se guardan en `localStorage` («colaCrib») y se suben en orden. Con el motor actualizado van en lote (`guardarVarias`, 50 por pedido). `podarCola`/`vigente` impiden que una decisión vieja haga retroceder un artículo (por ejemplo, de Incluida a A texto completo).

## Al cambiar código
- Sube la versión `?v=` en todos los `<script>` de `index.html` y el nombre de caché en `sw.js`. Agrega archivos nuevos a `ARCHIVOS` en `sw.js`.
- Antes de subir, prueba con Playwright y respuestas simuladas (el entorno no llega a las bases ni al motor).
- Ojo con declarar `let`/`const` que `show()` u otro código usa al cargar: ya rompió la página una vez (variable usada antes de existir).
- `estudios.js` ya declara `normal`: no repitas nombres globales.
- **Cambios en el motor:** ella tiene que pegarlos en Apps Script y publicar con **Implementar → Administrar implementaciones → ✏️ → Nueva versión** (nunca «Nueva implementación», porque cambia la URL; si cambia, hay que actualizar `config.js`). Si el cambio es chico, dale solo las líneas a pegar, o déjaselas en un documento de su Drive.

## Pendiente
- Confirmar que pegó en el motor `guardarVarias` y las líneas de Historial de búsquedas (están en el repositorio y en el documento «Motor: cambios para pegar» de su Drive).
- Seguir el cribado (búsqueda de LILACS de unos 9000 registros, mal armada pero se decidió conservarla).
- Extracción de los estudios incluidos (unos 5).
- Posible borrador del informe como mapeo de evidencia.
