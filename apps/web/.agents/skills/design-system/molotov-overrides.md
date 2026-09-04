# Molotov · Overrides del sistema de diseño

> **Precedencia:** este documento manda sobre `SKILL.md` (la guía de diseño base).
> Donde haya conflicto entre la guía base y estos overrides, gana este archivo.
> Lo que no esté acá se hereda de la base (grid 8pt, WCAG 2.2 AA, estados de
> componente, workflow de autoría).
>
> Prosa en español (Argentina). Identificadores de tokens, nombres de fuentes y
> código, en inglés.

---

## 1. Contexto y objetivos

Molotov es un marketplace de arte digital con estética **editorial / galería,
anti-cripto-bro**. La guía de diseño base aporta la estructura
(grids, jerarquía, ritmo de espaciado), pero su paleta es **clara** y sus fuentes
son otras. Estos overrides reorientan el sistema a una **base oscura** con
tipografía display de carácter y un acento azul muy puntual.

Cambios respecto de la base que hay que tener presentes:

- La base es light (`surface #FFFFFF`, `text #111827`). **Acá el fondo es oscuro
  por default.** Cualquier mención a "surface blanco" de la base se ignora.
- Fuentes de la base (Gelasio / Ubuntu Mono) → **reemplazadas** (ver §3).
- Escala tipográfica de la base topa en 40px → **se extiende hacia arriba** para
  el hero (ver §3).

---

## 2. Color — tokens reales (shippeados en `apps/web/app/globals.css`)

> **Nota (2026-09):** igual que en §3, esta sección documentaba una paleta
> (`--color-bg`, `--color-accent-on-dark`, etc.) que nunca se implementó con
> esos nombres ni esos valores. Reescrita para reflejar los tokens reales de
> `:root` en `globals.css` — la cadena manda.

Base oscura. Negro casi puro como fondo, off-white como texto. Azul Molotov
como acento puntual, **nunca inundatorio**.

```
/* Núcleo (apps/web/app/globals.css:68-77) */
--black:      #0A0A0A;  /* fondo base (no #000000 puro) */
--carbon:     #141414;  /* superficies elevadas: cards, watermarks */
--ember:      #222222;  /* bordes, dividers, skeletons de loading */
--smoke:      #8E8E8E;  /* texto/labels mudos — el más usado de los dos */
--ash:        #A8A8A8;  /* texto secundario, un tono más claro que smoke */
--offwhite:   #F5F4ED;  /* texto primario */

/* Acento Molotov */
--blue:       #1564FF;  /* fills, bordes, focus, dots, underlines */
--blue-deep:  #0D3FA8;  /* extremo oscuro de gradientes placeholder (cards) */
--blue-light: #4A8AFF;  /* estado hover del acento */
--blue-muted: #1A3060;  /* definido en globals.css; sin uso detectado en componentes hoy */
```

No hay tokens `--color-success/warning/danger` en el código — si se necesitan
estados semánticos de sistema, quedan por definir.

**Reglas de color:**

- El acento `--blue` **debe** usarse de forma puntual: underlines, dots, focus
  rings, fills de botón primario, bordes activos. No pintar bloques grandes ni
  fondos enteros con él.
- **Contraste del acento como texto — hallazgo, no resuelto acá:** `--blue`
  (#1564FF) sobre `--black` (#0A0A0A) da **~4.05:1**. Pasa WCAG AA para texto
  **grande** (≥3:1) pero **no pasa** para texto normal (necesita ≥4.5:1). El
  código de hoy sí usa `--blue` como color de texto a tamaños chicos (ej.
  `text-[11px]` en precios/precios destacados) — es un gap de accesibilidad
  real, no cubierto por este doc-sync. Para texto chico sobre `--black`,
  preferir `--offwhite`; `--blue` como texto queda mejor reservado a números o
  palabras destacadas en tamaños ≥18px, o a fills/bordes en vez de texto.
- **Inconsistencia detectada, no corregida acá:** `components/buy-button.tsx`
  usa el hover `#3493E5` hardcodeado en vez de `var(--blue-light)`
  (`#4A8AFF`) — mismo rol, valor distinto al resto del sitio.
- **Divergencia más grande, no corregida acá:** `apps/web/app/my-work/[tokenId]/page.tsx`
  todavía usa una paleta y tipografía previas por completo (`#0178DE`/`#3493E5`
  hardcodeados, `var(--font-geist-mono)` — variable que no existe en
  `layout.tsx`, así que ese texto cae al font body en vez de mono). Es la única
  página que quedó en el sistema de diseño anterior; una migración a los
  tokens de arriba es un cambio de UI en código real, más grande que este
  doc-sync — señalado para una pasada aparte.
- **Prohibido** todo gradiente purple→pink o variantes (cliché de marketplaces
  NFT). Si se usa gradiente, que sea monocromo sutil (negro→casi-negro) o
  basado en el acento azul a baja opacidad.
- Don't: `background: linear-gradient(#7C3AED, #EC4899)` ← prohibido.

---

## 3. Tipografía — tokens (override de fuentes y escala)

> **Nota (2026-09):** esta sección documentaba Fraunces/Geist/Geist Mono como
> intención previa a la implementación. El código shippeado usaba otra familia
> — la cadena manda, se corrigió acá para dejar de divergir. El resto de este
> documento (§1–2, §4–8: tokens de color `--color-bg`, `--color-accent-on-dark`,
> etc.) sigue siendo un doc de intención anterior a la implementación real y
> **no** se corrigió en esa pasada — es un trabajo aparte, más grande que un
> ajuste de tipografía.
>
> **Actualización (pasada de "ablandar el lenguaje visual"):** Fraunces volvió,
> pero no como reemplazo de Syne — como una **segunda voz, solo editorial**
> (ver más abajo). La divergencia que esta nota señalaba está resuelta: ya no
> es "intención sin implementar", es una decisión activa con un rol acotado.

```
--font-display:  "Syne", sans-serif;      /* apps/web/app/layout.tsx */
--font-body:     "DM Sans", sans-serif;
--font-mono:     "Space Mono", ui-monospace, monospace;
--font-editorial: "Fraunces", serif;      /* solo editorial, ver abajo */
```

- **Display = Syne** (Google Fonts, pesos 600/700/800). Voz de UI: nav, botones,
  headline principal, labels.
- **Body = DM Sans** (pesos 300/400/500/600).
- **Mono = Space Mono** (pesos 400/700): **precios, direcciones de wallet,
  hashes, basis points**. También labels/badges en mayúsculas, pero con
  criterio — ver el ajuste de densidad más abajo.
- **Editorial = Fraunces** (pesos 400/500/600, variable, con itálica): **segunda
  voz, exclusivamente para momentos editoriales** — el cuerpo del manifiesto
  (`manifesto.tsx`) y un acento puntual dentro del headline del hero (la
  palabra "paga"/"pays", en itálica azul, `hero-carousel.tsx`). **Nunca** en
  chrome de UI: nav, botones, CTAs y labels siguen en Syne/DM Sans/Space Mono
  sin excepción. La idea es una voz curatorial ocasional, no un segundo
  sistema tipográfico paralelo.
- **Prohibido** usar Inter, Roboto o Arial en cualquier contexto.

**Densidad del mono-mayúsculas cerca de la obra:** el patrón label/valor en
mono-mayúsculas-tracked es la voz de todo el sitio (nav, footer, badges,
CTAs) y sigue así — **pero** se aflojó específicamente donde competía con la
obra: la caption de `artwork-card.tsx` (ya no tiene una regla horizontal
separando título de precio, tracking más suave) y las filas de datos de
`token-view.tsx` (label más chico y más apagado, mismo criterio). En esos dos
lugares puntuales el objetivo es que se lea como un pie de foto, no como una
fila de tabla. En nav/footer/CTAs no cambió nada.

**Escala tipográfica:** no hay tokens `--text-*` custom en `globals.css` — se
usa la escala default de Tailwind. Para **body copy legible** (párrafos,
bajadas, descripciones), usar `text-base` (16px) en vez de un valor arbitrario
`text-[15px]`/`text-[16px]`; para **subtítulos** (encabezados de sección,
etc.), `text-xl` (20px). Esto resuelve el watchpoint de §9 (18px sentía grande
en mobile) fijando la base en el estándar de 16px en vez de un token custom.
Esto **no** aplica a los labels mono en mayúsculas (`text-[9px]`–`text-[11px]`
tracking ancho) — son un idioma tipográfico distinto (UI/metadata), no body
copy, y quedan como están.

---

## 4. Background, textura y layout

- **Fondo base oscuro** siempre: `--black` (#0A0A0A) o `--carbon` (#141414)
  para zonas/cards elevadas.
- **Grain / noise overlay** permitido y recomendado, sutil: `opacity ~0.04`,
  `position: fixed`, `pointer-events: none`, por encima del fondo y debajo del
  contenido. Implementación sugerida: SVG `feTurbulence` (no imagen rasterizada
  pesada). Respetar `prefers-reduced-motion` si el grain anima.
- **Layout:** asimetría deliberada, **negative space generoso**, y
  **grid-breaking** en hero y secciones de manifiesto (elementos que rompen la
  columna). Mantener el baseline grid de 8pt de la base para el ritmo vertical.
- **Cards de obra:** foto/media **grande arriba**, info **abajo** (artista,
  título, precio dual XLM+USD en `--font-mono`, badge de royalty). El media es
  el protagonista; la metadata es secundaria y discreta (`--smoke`/`--ash`).
- **Bordes: `border-radius: 0` por default en todo (`globals.css`, `* { }`)** —
  es la mirada de galería para cards, imágenes y frames, y se mantiene.
  `rounded-soft` (`--radius-soft`, 4px) es la **única** excepción: chrome
  interactivo puntual — botones/CTAs, el input de búsqueda, badges/pills. Nunca
  en cards, imágenes o cualquier contenedor de layout. Una clase propia del
  componente ya gana sobre el reset universal, así que no hace falta pelear
  con `!important` para optar por el radius suave en un elemento puntual.
- **Grilla del catálogo:** por default uniforme (`grid-cols-1 sm:grid-cols-2
lg:grid-cols-3`), pero el primer ítem puede ser "destacado" —
  `ArtworkCard`'s prop `featured` (imagen más ancha 16:11, título más grande)
  combinada con `sm:col-span-2` en el contenedor de grilla del padre. Usado hoy
  en la sección de tendencias de home y en `/works`, siempre sobre el mismo
  orden ya existente (en venta → vendidas → más nuevas), nunca como curaduría
  inventada. No agregar más de un ítem destacado por grilla sin una razón real
  para hacerlo — la idea es una excepción ocasional, no un segundo patrón de
  grilla.
- **Placeholder sin imagen:** `ArtworkPlaceholder` (`components/artwork-placeholder.tsx`)
  — ícono de "imagen rota" + label mono discreto, monocromo. Es el único
  tratamiento para un token sin imagen real; no hay watermark de token ID en
  ningún lado (se sacó: leía como decoración cripto-tech, no como contenido).

---

## 5. Accesibilidad (acceptance criteria, sobre base oscura)

- Mantener **WCAG 2.2 AA**. Texto normal ≥4.5:1, texto grande ≥3:1.
  - `--offwhite` sobre `--black`: ✅ alto contraste.
  - `--blue` como texto sobre `--black` sólo pasa AA en tamaño grande
    (~4.05:1, ver el hallazgo en §2) — no lo uses como color de texto chico.
- **Focus visible** sobre fondo oscuro: ring de 2px con `--blue` +
  `outline-offset: 2px`. Si el elemento ya es azul, usar `--offwhite` para el
  ring. Nunca eliminar el focus.
- Touch targets ≥44px. Soporte `prefers-reduced-motion` para marquee, hero
  motion y grain animado. Semántica HTML antes que ARIA.

---

## 6. Contenido y tono

- Idioma por default: **español de Argentina**. Tono editorial, curatorial,
  sobrio, latinoamericano.
- **Prohibido** el vocabulario cripto-bro: `moonshot`, `diamond hands`, `to the
moon`, `WAGMI`, `GM`, `ape in` (y equivalentes).
- **Sin emojis** de cohete, fuego, dinero o gemas en copy de producción.
- Do: "El ingreso vuelve _hacia_ el artista." / "Regalías inmutables, grabadas
  on-chain."
- Don't: "🚀 WAGMI fam, esta obra va to the moon 💎🙌".

---

## 7. Anti-patterns (prohibido)

- Gradientes purple→pink o cualquier paleta "NFT genérica".
- Fondos claros / surfaces blancas heredadas de la base.
- Inter, Roboto o Arial.
- El acento (`--blue`, #1564FF) como texto chico sobre negro (~4.05:1, no pasa
  AA normal); para texto fino usar `--offwhite`.
- Acento azul inundando bloques grandes o fondos.
- Redondear cards, imágenes o cualquier contenedor de layout — `rounded-soft`
  es solo para chrome interactivo puntual (ver §4). Todo redondeado convierte
  a Molotov en un SaaS genérico, que es exactamente lo que la base oscura +
  bordes duros evita.
- Fraunces fuera de un momento editorial (manifiesto, el acento del hero) —
  usarlo en nav, botones, CTAs o labels lo convierte en un segundo sistema de
  UI en vez de una voz curatorial ocasional.
- Watermark de token ID (u otro dato interno) como decoración de card —
  ver `ArtworkPlaceholder` en §4 para el tratamiento correcto de "sin imagen".
- **Nota:** este documento antes marcaba `#2D43FF`/`#5B6CFF`/`#4B5EFF` como
  "obsoletos" y `#0178DE` como el acento vigente — ninguno de los dos es
  exacto: el acento real shippeado es `--blue` (#1564FF, ver §2), y `#2D43FF`
  sigue en uso hoy en `providers/privy-provider.tsx` (color del modal de
  Privy) — no está removido. Encontrado al sincronizar este doc, no corregido
  acá (ver §2).
- Lenguaje cripto-bro o emojis de cohete/fuego/dinero/gemas.

---

## 8. QA checklist (ejecutable en code review)

- [ ] Fondo oscuro (`--black`/`--carbon`); no hay surfaces blancas.
- [ ] Syne / DM Sans / Space Mono para UI; Fraunces solo en manifiesto y el
      acento del headline del hero — nunca en nav, botones, CTAs o labels. No
      aparece Inter/Roboto/Arial.
- [ ] Precios, wallets, hashes y bps van en `--font-mono`.
- [ ] El acento azul (`--blue`) es puntual; no se usa como texto en tamaños
      chicos (no pasa AA normal, ver §2).
- [ ] No hay gradientes purple-pink.
- [ ] Cards, imágenes y contenedores de layout sin `border-radius` (0 por
      default); `rounded-soft` solo en botones, inputs y badges/pills.
- [ ] Contraste verificado (≥4.5:1 normal / ≥3:1 grande).
- [ ] Focus visible en todos los interactivos; touch targets ≥44px.
- [ ] Copy en es-AR, sin jerga cripto-bro ni emojis prohibidos.
- [ ] Grain overlay ≤4% opacity y respeta reduced-motion.
- [ ] Cards de obra: media grande arriba, metadata discreta abajo, sin
      watermark de token ID.

---

## 9. Watchpoints a revisar en el Paso 5 (landing renderizada)

No bloquean; revisar cuando se vea la landing en pantalla.

- ~~`--color-bg` en #000000 puro...~~ **Resuelto, ya estaba así:** el fondo
  real (`--black` en `globals.css`) siempre fue `#0A0A0A`, no `#000000` puro —
  este watchpoint describía un valor que el código nunca tuvo. Ver §2.
- ~~`--text-base` en 18px...~~ **Resuelto (2026-09):** no se implementó un
  token custom de 18px — el body copy usa `text-base` (16px, default de
  Tailwind) y los subtítulos `text-xl` (20px). Ver §3.
