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

### `build-atlas.js`: atlas de gráficos

Reconstruye desde la ROM **todos** los gráficos del juego en un único atlas y es lo que usa el motor
(ya no hay PNG sueltos por hoja):

```
node tools/build-atlas.js                    # escribe assets/images/atlas.png y atlas.js
node tools/build-atlas.js --debug <carpeta>  # además vuelca el atlas y todos los metatiles para revisarlos
```

`atlas.js` define `ATLAS = { image, sheets }`: la imagen embebida y, por hoja, su lugar en el atlas
(`x, y, w, h`) y el tamaño de celda (`tw, th`). `loadAtlas()` en `game.js` recorta cada hoja y la
registra como tileset con el mismo nombre, así los sprites se definen con (columna, fila) como siempre.

| Hoja | Contenido |
|---|---|
| `Overworld_Tiles` | Bloques, pregunta, caños, mástil y bandera, nubes, colina, arbustos; filas 6 a 9: hongos, flor, estrella y moneda que salta |
| `Underground_Tiles`, `Castle_Tiles`, `Water_Tiles` | Las filas 0 a 5 de la anterior con la paleta de cada área |
| `Player_{Mario,Luigi}_Tiles` / `_Big_Tiles` / `_Grow_Tiles` | Cuadros chico (16x16), grande (16x32) y de crecimiento |
| `Player_{Mario,Luigi}_Fire_Tiles` | Cuadros del jugador de fuego |
| `Enemy_Short_Tiles`, `Enemy_Tall_Tiles` | Goomba, caparazones, koopas, paratroopas y plantas piraña |
| `Fireball_Spin_Tiles`, `Fireball_Explosion_Tiles` | Bola de fuego y su explosión |
| `UI_Tiles` | Moneda del marcador e ícono de hongo del menú |
| `Title_Image` | Cartel del título (la pantalla se guarda en el CHR como escrituras al nametable) |

Cómo se arma cada cosa: los metatiles del fondo salen de `Palette0_MTiles` ... `Palette3_MTiles` con la
paleta de fondo de cada área (`GroundPaletteData`, etc.); los cuadros de Mario, de `PlayerGraphicsTable`
con los colores de `PlayerColors`; los de los enemigos, de `EnemyGraphicsTable` con las paletas de sprites
del área. El original guarda a los personajes mirando a la derecha: los que el juego muestra mirando a la
izquierda se espejan, y cuando los dos tiles de una fila son iguales el derecho va espejado, como en el
hardware. El bloque de pregunta y la moneda del fondo tienen tres cuadros por la rotación de color de
`ColorRotatePalette`; la flor y la estrella, cuatro, uno por paleta de sprites.

Para mover o agregar un sprite hay que cambiar las coordenadas en la hoja y en las definiciones de
`defineWorldSprites()` (`mario.js`) o de `init()` (`game.js`).

## Cómo se conectan con el motor

`mario.js` decide qué hace y cómo se dibuja cada número de metatile con tablas al principio del
archivo: `METATILE_SPRITE` (sprite), `BLOCK_ITEM` (qué entrega al golpearlo desde abajo) y los
conjuntos de bloques sólidos, ocultos y en primer plano. Un metatile que figura en un nivel pero no
en esas tablas se dibuja como bloque duro si es sólido.

El motor lee las coordenadas de cada sprite en las hojas de `atlas.js` (ver `build-atlas.js`).

## Qué no cubre

Plataformas móviles (quedan como filas fijas de bloques duros), Bowser (se reemplaza por un Koopa
rojo), el Buzzy Beetle y el Spiny (se reemplazan por Goombas), el Hammer Bro (por un Koopa rojo),
Lakitu, los cheep-cheep voladores de los puentes, enredaderas y estrellas en ladrillos (dan un
hongo). Los niveles de nubes (que se entran por enredadera) no se generan, y sus caños quedan como
decoración. Los laberintos con bucle de los castillos (4-4, 7-4, 8-4) no vuelven a Mario atrás si se
equivoca.

Sí están, con la lógica del original simplificada: Bloober, cheep-cheep, Podoboo, barras de fuego
(corta y larga, en los dos sentidos y velocidades), Bullet Bills disparados por los cañones, plantas
piraña y paratroopas.

La escenografía de fondo (nubes, colinas, arbustos, árboles, vallas, castillo y agua) sale de los datos
del nivel (`scenery`) y se dibuja fija en el mapa; sólo el menú usa un fondo con parallax propio.
