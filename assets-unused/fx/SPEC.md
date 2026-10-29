# FX spec (Diseño) — Web cablea, Diseño solo toca public/fx/

Todo: solo `transform`/`opacity`; desactivar con `prefers-reduced-motion: reduce`; nada bloquea el primer paint.

## 1. Intro overlay (1.2s, una vez por sesión, skip con tecla/clic/tap)
- Overlay fijo `--bg`, z-index alto, `aria-hidden`.
- 0–300ms: `moon.svg` (96px, pixelado: `image-rendering: pixelated`) opacity 0→1 + translateY 8px→0.
- 200–900ms: "CRISTIAN VARGAS" en Pixelify 28px `--text`, reveal por letra (steps(15)); cursor bloque `--accent` parpadeando `steps(2)` 400ms.
- 900–1200ms: overlay opacity 1→0, luego `display:none`. sessionStorage `introSeen=1`.

## 2. Parallax hero (≈480px alto detrás del hero)
- Capas absolutas, `background-size: cover`, anclar abajo: `layer-sky.svg` (0.1), `layer-castle.svg` (0.25), `layer-fog.svg` (0.4) × scrollY → translateY.
- Desktop `pointer:fine`: mouse ±8px X en castle, ±14px en fog (lerp 0.08).
- Máscara: `mask-image: linear-gradient(#000 60%, transparent)` para que muera antes de la tabla. Opacidad general 0.55 para que el texto del hero mantenga contraste AA.

## 3. Bestiary hover (fila / tarjeta)
- Hover (o IntersectionObserver 60% en mobile, una vez): shake `translateX 0,-2,2,-1,0` 180ms.
- Barra HP: `::after` blanco flash opacity 1→0 120ms; luego `scaleX` desde 1 hasta valor real (transform-origin left) 300ms `steps(6)`.
- Sprite por clase en el borde derecho de la fila, 32px, opacity 0→1: sqli→`sprites/sqli.svg`, XSS→`xss.svg`, SSRF→`ssrf.svg`, auth bypass→`authbypass.svg`.

## Cursor
- `pointer:fine` solo: `cursor: url(/fx/cursor-whip.svg) 0 0, auto;` en body; links mantienen `pointer`.

## Kill count (hero, debajo del rol)
- JetBrains Mono 13px `--accent`, separador ` · ` en `--muted`. Generado en build.
