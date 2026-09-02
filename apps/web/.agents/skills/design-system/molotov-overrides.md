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

## 2. Color — tokens (override total de la paleta base)

Base oscura. Negro como fondo, off-white como texto. Azul Molotov como acento
puntual, **nunca inundatorio**.

```
/* Núcleo */
--color-bg:            #000000;  /* negro puro: fondo base */
--color-bg-elevated:   #0A0A0B;  /* casi negro: cards y superficies elevadas */
--color-fg:            #F5F4ED;  /* off-white: texto primario */
--color-fg-muted:      rgba(245, 244, 237, 0.64);  /* texto secundario */
--color-fg-subtle:     rgba(245, 244, 237, 0.40);  /* labels, metadata */
--color-border:        rgba(245, 244, 237, 0.12);  /* hairlines, divisores */

/* Acento Molotov — azul de la llama del logo oficial (ver nota abajo) */
--color-accent:          #0178DE;  /* azul llama: fills, bordes, focus, dots, underlines */
--color-accent-on-dark:  #0178DE;  /* mismo hex: pasa AA sobre #000 (4.74:1), no necesita tint */
--color-accent-hover:    #3493E5;  /* estado hover de elementos accent (tint +20% blanco) */

/* Semánticos funcionales (heredados de la base, sólo para estados de sistema) */
--color-success: #16A34A;
--color-warning: #D97706;
--color-danger:  #DC2626;
```

**Reglas de color:**

- El acento `--color-accent` (#0178DE) **must** usarse de forma puntual:
  underlines, dots, focus rings, fills de botón primario, bordes activos. No
  pintar bloques grandes ni fondos enteros con él.
- **Contraste del acento como texto:** #0178DE sobre #000000 da **4.74:1**, que
  **sí pasa WCAG AA** para texto normal (≥4.5:1). Por eso:
  - `--color-accent-on-dark` es el **mismo hex** que `--color-accent` (no hace
    falta un tint más claro como antes). Usarlo para links y palabras resaltadas
    sobre fondo oscuro (H1, "2,5%", "Royalty 10%", "vivir de su obra"). ✅
  - El margen es ajustado (4.74:1): para texto **muy** chico sobre negro,
    preferir `--color-fg`; el acento queda para palabras o números destacados.

> **Nota — cambio de acento (Paso 5.7):** el acento pasó de `#2D43FF` (azul
> provisional) a **`#0178DE`**, muestreado del azul de la llama del logo oficial
> (`apps/web/public/brand/logo_sinfondo.png`, promedio de ~23k px del centro de
> la llama). Unifica la identidad: el color del sistema ahora sale de la marca,
> no de un valor inventado. Hover `#3493E5` (canon +20% blanco). El antiguo
> `#5B6CFF` (tint accent-on-dark) y `#4B5EFF` (hover) quedan obsoletos.

- **Prohibido** todo gradiente purple→pink o variantes (cliché de marketplaces
  NFT). Si se usa gradiente, que sea monocromo sutil (negro→casi-negro) o
  basado en el acento azul a baja opacidad.
- Don't: `background: linear-gradient(#7C3AED, #EC4899)` ← prohibido.

---

## 3. Tipografía — tokens (override de fuentes y escala)

> **Nota (2026-09):** esta sección documentaba Fraunces/Geist/Geist Mono como
> intención previa a la implementación. El código shippeado usa otra familia
> (ver abajo) — la cadena manda, se corrige acá para dejar de divergir. El
> resto de este documento (§1–2, §4–8: tokens de color `--color-bg`,
> `--color-accent-on-dark`, etc.) sigue siendo un doc de intención anterior a
> la implementación real y **no** se corrigió en esta pasada — es un trabajo
> aparte, más grande que un ajuste de tipografía.

```
--font-display: "Syne", sans-serif;      /* apps/web/app/layout.tsx */
--font-body:    "DM Sans", sans-serif;
--font-mono:    "Space Mono", ui-monospace, monospace;
```

- **Display = Syne** (Google Fonts, pesos 600/700/800).
- **Body = DM Sans** (pesos 300/400/500/600).
- **Mono = Space Mono** (pesos 400/700): usado en todo el sitio para
  **precios, direcciones de wallet, hashes, basis points y como idioma de
  labels/badges en mayúsculas** — no solo para datos on-chain.
- **Prohibido** usar Inter, Roboto o Arial en cualquier contexto.

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

- **Fondo base oscuro** siempre: `--color-bg` (#000000) o `--color-bg-elevated`
  (#0A0A0B) para zonas/cards.
- **Grain / noise overlay** permitido y recomendado, sutil: `opacity ~0.04`,
  `position: fixed`, `pointer-events: none`, por encima del fondo y debajo del
  contenido. Implementación sugerida: SVG `feTurbulence` (no imagen rasterizada
  pesada). Respetar `prefers-reduced-motion` si el grain anima.
- **Layout:** asimetría deliberada, **negative space generoso**, y
  **grid-breaking** en hero y secciones de manifiesto (elementos que rompen la
  columna). Mantener el baseline grid de 8pt de la base para el ritmo vertical.
- **Cards de obra:** foto/media **grande arriba**, info **abajo** (artista,
  título, precio dual XLM+USD en `--font-mono`, badge de royalty). El media es
  el protagonista; la metadata es secundaria y discreta (`--color-fg-muted`/
  `--color-fg-subtle`).

---

## 5. Accesibilidad (acceptance criteria, sobre base oscura)

- Mantener **WCAG 2.2 AA**. Texto normal ≥4.5:1, texto grande ≥3:1.
  - `--color-fg` sobre `--color-bg`: ✅ alto contraste.
  - Acento como texto sobre oscuro → usar `--color-accent-on-dark` (§2).
- **Focus visible** sobre fondo oscuro: ring de 2px con `--color-accent` +
  `outline-offset: 2px`. Si el elemento ya es azul, usar `--color-fg` para el
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
- El acento (#0178DE) como texto **muy** chico sobre negro (margen AA ajustado,
  4.74:1); para texto fino usar `--color-fg`.
- Acento azul inundando bloques grandes o fondos.
- Reintroducir el viejo #2D43FF / #5B6CFF / #4B5EFF (obsoletos desde Paso 5.7).
- Lenguaje cripto-bro o emojis de cohete/fuego/dinero/gemas.

---

## 8. QA checklist (ejecutable en code review)

- [ ] Fondo oscuro (`--color-bg`/`--color-bg-elevated`); no hay surfaces blancas.
- [ ] Sólo Fraunces / Geist / Geist Mono; no aparece Inter/Roboto/Arial.
- [ ] Precios, wallets, hashes y bps van en `--font-mono`.
- [ ] El acento azul es puntual; texto de acento sobre oscuro usa
      `--color-accent-on-dark`.
- [ ] No hay gradientes purple-pink.
- [ ] Contraste verificado (≥4.5:1 normal / ≥3:1 grande).
- [ ] Focus visible en todos los interactivos; touch targets ≥44px.
- [ ] Copy en es-AR, sin jerga cripto-bro ni emojis prohibidos.
- [ ] Grain overlay ≤4% opacity y respeta reduced-motion.
- [ ] Cards de obra: media grande arriba, metadata discreta abajo.

---

## 9. Watchpoints a revisar en el Paso 5 (landing renderizada)

No bloquean; revisar cuando se vea la landing en pantalla.

- **`--color-bg` en #000000 puro:** defendible (matchea lo agresivo/contrastado de
  "Molotov"), pero el negro absoluto puede sentirse áspero en OLED. Muchos dark
  themes modernos warman el negro (Vercel ~#0A0A0A, Linear similar). Si al ver la
  landing se siente demasiado duro, considerar bajar `--color-bg` también a
  `#0A0A0B` (ajuste de 5 min). Por ahora se mantiene #000000.
- ~~`--text-base` en 18px...~~ **Resuelto (2026-09):** no se implementó un
  token custom de 18px — el body copy usa `text-base` (16px, default de
  Tailwind) y los subtítulos `text-xl` (20px). Ver §3.
