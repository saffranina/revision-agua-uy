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

## Si cambias el código de Apps Script

Después de editar `Codigo.gs`: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. La URL no cambia.

## Cadenas de búsqueda

- [`docs/cadenas-de-busqueda.md`](docs/cadenas-de-busqueda.md): cadenas para cada base, enfocadas en estudios de Uruguay.
- [`docs/literatura-uruguaya.md`](docs/literatura-uruguaya.md): Latindex, revistas uruguayas para revisar a mano, repositorios no indexados y primeros candidatos encontrados.

## Uso diario

- **Búsquedas**: base, fecha, cadena exacta, filtros y número de resultados.
- **Cribar**: en Referencias toca «▶ Cribar». Muestra un artículo por vez con título, autores, resumen y el chequeo de Uruguay. Fase 1 (título y resumen): *Pasa*, *Excluir* (con motivo) o *Duplicado*. Fase 2 (texto completo): *Incluir* o *Excluir*. Cada decisión se guarda sola con su fecha; *Deshacer* vuelve atrás. En la compu: teclas S, N, D, → y ←.
- **Completar una búsqueda sola**: en «Nueva búsqueda» pega el link de la página de resultados (PubMed, BVS/LILACS, SciELO, Colibri, Google Scholar, Scopus…) y toca «Completar»: saca la base, la cadena y los filtros. Si además adjuntas el archivo de resultados, cuenta cuántos hay y al guardar carga todos los artículos. Con un link de PubMed no hace falta archivo: «Traer artículos de PubMed» los baja directamente. El link queda guardado en la búsqueda.
- **Importar resultados**: abre una búsqueda guardada y elige el archivo exportado de la base (PubMed: *Save → Format: PubMed*; LILACS/BVS, Scopus, Web of Science, SciELO: *RIS*; también XML de PubMed o de repositorios como Colibri). Se cargan todos los artículos como «Pendiente de cribado», con los duplicados ya marcados y el chequeo de Uruguay hecho.
- **Completar solo**: en una referencia nueva pega el DOI, el PMID o el link y toca «Completar». Busca en OpenAlex, Crossref y PubMed y llena título, autores, año, revista, DOI, link y resumen. Además avisa si hay autores con afiliación en Uruguay o si el artículo menciona Uruguay, y si existe un PDF de acceso abierto lo guarda solo en Drive.
- **Referencias**: título, autores, año, revista, DOI, link de la fuente, resumen, estado del cribado, motivo de exclusión, exposición y notas. El código (`R001`, `R002`…) se asigna solo.
- **PDF**: «Subir PDF» lo guarda en Drive con el nombre automático. Si el PDF pesa más de 30 MB, guárdalo en Drive y pega el link.
- **PRISMA**: el diagrama de flujo se calcula solo.
- **Exportar**: CSV (Excel, R) y RIS (Zotero, Mendeley, Rayyan).
