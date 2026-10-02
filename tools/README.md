# Herramientas

Scripts de Node (sin dependencias) que generan los niveles y los gráficos del juego a partir de
los datos originales de Super Mario Bros. Se corren a mano; el juego no los necesita para
ejecutarse, sólo los archivos que producen.

## Qué necesitan

Dos archivos locales que **no se versionan** (están en `.gitignore`):

| Archivo | Para qué | De dónde sale |
|---|---|---|
| `tools/smbdis.asm` | Desensamblado del juego: datos de niveles, metatiles y paletas | `src/smbdis.asm` de [abnuo/smbdis-dasm](https://github.com/abnuo/smbdis-dasm) |
| `tools/smb.nes` | ROM, de la que se leen los gráficos (CHR) | Tu propia copia del juego |

Probado con Node 20.

## Qué hace cada script

### `smb-levels.js`: niveles

Reproduce el algoritmo de `DecodeAreaData` / `ProcessAreaData` del juego original y genera
`levels_smb.js` con los 8 mundos (1-1 a 8-4) y sus subniveles; `index.html` lo carga después de
`assets.js`.

```
node tools/smb-levels.js --out levels_smb.js     # genera el archivo
node tools/smb-levels.js --ascii                 # además dibuja cada nivel en texto
```

Imprime al final un informe de lo que el motor no tiene y se reemplazó o se descartó.

Qué hay en el archivo generado, por nivel:

- `map`: grilla de **números de metatile originales** (0 = vacío), fila por fila. Hay dos filas
  vacías arriba: la pantalla del NES muestra 13 filas de nivel y el mapa del juego tiene 15.
  Sólo figuran los metatiles que el original guarda en su búfer de bloques (los de decoración,
  como nubes o arbustos, no: el juego dibuja su propio fondo).
- `enemies`: lista `{ type, color, x, y }`, con `x`, `y` en celdas. Las plantas piraña van sobre
  la boca del caño.
- `warps`: caños que llevan a otro nivel (ver más abajo).
- `type`: 0 exterior, 1 subterráneo, 2 agua, 3 castillo. `night: true` pinta el cielo de negro.
  `hidden: true` marca los subniveles, que no aparecen en el selector de mundos.

**Niveles.** Salen solos de las tablas `World1Areas` ... `World8Areas` del desensamblado: cada área
se llama como indica el comentario de su etiqueta (`;level 1-3/5-3` sirve para el 1-3 y el 5-3). Los
enemigos marcados como "difíciles" sólo se incluyen a partir del 5-3, como en el original.

**Subniveles.** Las salas de bonus del original son una sola área larga con varias salas, una por
página de entrada. Cada subnivel (`1-1b`, `4-2b`, ...) es una ventana de dos páginas de esa área, y
la letra distingue las salas de un mismo nivel. La zona de atajos del 4-2 se genera completa como
`4-2w`. Los `warps` salen de los objetos de "fila 0e" de los datos de enemigos, asociados al caño
más cercano: `down` se entra parado sobre la boca y apretando abajo, `right` caminando contra la
boca de un caño lateral. `spawn` dice dónde aparece Mario (`up` sale de un caño, `drop` cae) y
`then` reemplaza el `nextWorld` del destino, que es como el final del 1-2 encadena con el 1-3.

**Zonas de atajos.** Los tres caños de la zona (1-2 y 4-2) llevan al mundo que dice
`WarpZoneNumbers`, según estén a la izquierda, al centro o a la derecha de la pantalla; esos warps
tienen `spawn: { start: true }` y arrancan el nivel desde el principio.

### `smb-chr.js`: gráficos de la ROM

Lee los tiles de 8×8 del CHR-ROM y los vuelca a PNG. Sirve de biblioteca para los demás scripts y,
solo, para inspeccionar las dos tablas de patrones:

```
node tools/smb-chr.js <carpeta>      # escribe chr_bank0.png (sprites) y chr_bank1.png (fondo)
```

### `build-castle-tileset.js`: tileset de castillo

Genera `assets/images/tileset_castle.png` y la constante `castleTileset` de `assets.js`. Toma las
definiciones de metatiles del desensamblado y la paleta `CastlePaletteData`, y las dibuja con las
coordenadas del tileset exterior; lo que no cambia con la paleta (bloques de pregunta, monedas,
nubes) se copia de esa hoja.

```
node tools/build-castle-tileset.js
```

Para otra área (agua, por ejemplo) habría que cambiar `CastlePaletteData` por la paleta del área,
ajustar `LAYOUT` (qué metatile va en cada celda) y el nombre de la hoja de salida.

## Cómo se conectan con el motor

`mario.js` decide qué hace y cómo se dibuja cada número de metatile con tablas al principio del
archivo: `METATILE_SPRITE` (sprite), `BLOCK_ITEM` (qué entrega al golpearlo desde abajo) y los
conjuntos de bloques sólidos, ocultos y en primer plano. Un metatile que figura en un nivel pero no
en esas tablas se dibuja como bloque duro si es sólido.

El motor lee las coordenadas de cada sprite en las hojas de `assets.js`. Las hojas del exterior y
del subterráneo no se generan con estos scripts: son las que ya tenía el juego.

## Qué no cubre

Plataformas móviles (quedan como filas fijas de bloques duros), barras de fuego, peces, Bullet Bill,
Bowser (se reemplaza por un Koopa rojo), enredaderas y estrellas en ladrillos (dan un hongo).
Los niveles de agua (2-2 y 7-2) se generan, pero el motor no tiene natación; las salas de agua y los
niveles de nubes (que se entran por enredadera) no se generan, y sus caños quedan como decoración.
Los laberintos con bucle de los castillos (4-4, 7-4, 8-4) no vuelven a Mario atrás si se equivoca.
Los fondos (nubes, colinas, arbustos) los dibuja el motor con parallax propio.
