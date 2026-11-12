// La Fonda — Platanus Hack 26
// Cocina cooperativa dieciochera para 1 o 2 jugadores: anticuchos y choripanes.
// Etapa 2: menu de modo, choripan con pebre, variantes y el curado de cada chef.

const W = 800, H = 600;
const TS = 48, GX = 40, GY = 108, COLS = 15, ROWS = 10;
const RONDA = 180;      // segundos por ronda
const CORTE = 1.5;      // segundos manteniendo B2 para cortar
const ASADO = 5;        // segundos hasta quedar listo
const QUEMA = 10;       // segundos totales hasta quemarse
const MAXT = 5;         // tickets simultaneos
// ritmo del copete (compadre y barril)
const CP_PRIMERO = 40;  // s hasta que aparece el compadre por primera vez
const CP_INI = 48;      // s entre apariciones en los dos primeros tercios
const CP_FIN = 15;      // s entre apariciones en el ultimo tercio
const CP_TERCIO = 2 / 3; // fraccion de la ronda desde la que aparece seguido
const TENT_INI = 25;    // 1P: s de ocio del ayudante antes de ir al barril (inicio; terminar una tarea lo reinicia)
const TENT_FIN = 12;    // 1P: lo mismo al final de la ronda
// curado por etapa (sobrio, alegre, curado, muy curado): velocidad al caminar y al cortar
const VEL_CU = [1, 0.92, 0.82, 0.7];
const CORTE_CU = [1, 0.9, 0.78, 0.62];
const HUMO_T = 3;       // s que dura algo quemado antes de deshacerse
const QUEMA_PEN = 5;    // puntos que se pierden cuando se deshace
const KEYS = { 1: 'la-fonda-top5-1p', 2: 'la-fonda-top5' };
const MAX_HIGH_SCORES = 5;
const NAME_LEN = 3;

// Cocina 15x10: ingredientes atras, parrilla y armado al centro, entrega al frente.
// '.' piso, '#' meson, A meson de armado, T tabla, G parrilla, V entrega,
// cajones: P palitos, C carne, R pimenton, O cebolla, Z chorizo, N pan, E pebre;
// K barril de vino (tentacion en 1P)
const MAPA = [
  '#PCORTT##ZNE###',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#...AAGGGAA...#',
  '#.............#',
  '#.............#',
  '#.............#',
  '######VVV###K##',
];
const CAJ = { P: 'a', C: 'm', R: 'p', O: 'o', Z: 'z', N: 'n', E: 'e' };
const BARRIL = [12, 8]; // celda de piso frente al barril
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ===== RECETAS =====
// tk.r: 'a' anticucho (tk.p pimenton, tk.o cebolla) o 'c' choripan (tk.e pebre); tk.v = es variante
const PTS = 20, EXTRA = 5;

const LETTER_GRID = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z', 'Ñ', '-'],
  ['BORRAR', 'LISTO'],
];

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) KEYBOARD_TO_ARCADE[normalizeIncomingKey(key)] = arcadeCode;
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#140f1c',
  pixelArt: true,
  render: { preserveDrawingBuffer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: { create, update },
});

// ===== ATLAS (recortado de ref/hoja_sprites.png, 28 colores) =====
// (el PNG va en arrancar: '/' se guarda como '-' para no parecer URL)
// a0-a2 fondera de frente/costado, a3-a5 de espaldas; b* fondero; ingredientes y choripan
const FR = {a0:[0,0,26,37],a1:[27,0,24,37],a2:[52,0,24,37],a3:[77,0,24,37],a4:[102,0,24,37],a5:[127,0,24,37],b0:[0,38,25,33],b1:[26,38,25,33],b2:[52,38,24,33],b3:[77,38,24,33],b4:[102,38,24,33],b5:[127,38,25,33],mr:[0,72,18,13],zr:[19,72,18,12],or:[38,72,14,14],pr:[53,72,15,17],eb:[69,72,17,14],nr:[87,72,17,12],ch:[105,72,25,16],ha:[6,5,18,17],hb:[4,40,18,17]};
// mejillas del curado (pixel del sprite frontal) por chef
const MEJ = [[[13, 18], [20, 18]], [[11, 14], [19, 14]]];
const PAL = {
  k: 0x2a1610, W: 0xf6f0e2, R: 0xd8262a, r: 0x8e1820, H: 0x1c1424, S: 0xf4c196, c: 0xf0a088, e: 0x1c1424,
  J: 0x2a3c6c, N: 0x4a2c1c, G: 0x1f6a30, g: 0x2f8a40, Q: 0x1f7a24, m: 0x5e2012, T: 0xf0d098, t: 0x8a5a2a,
};
// compadre con la botella de vino
const PQ = ['...HHHH......', '..HHHHHH...g.', '..SSSSSS...G.', '..SeSSeS..GGG', '..cSSSSc..GWG', '...SmmS...GWG',
  '.rRRRRRrSSGGG', 'rRRRRRRR..QQQ', 'S.rRRRRr.....', '..JJJJJJ.....', '..JJ..JJ.....', '..NN..NN.....'];
// cubitos del anticucho: 1 luz, 2 medio, 3 sombra, 4 detalle; por estado crudo/asado/quemado
const CUBO = ['1124', '1422', '2223', '2233'];
// tinte del chorizo: crudo, asado, quemado
const ZT = [0xffffff, 0xd09070, 0x5a4a4a];
const QUEMADO = [0x5a4c4c, 0x322a2a, 0x181212, 0x8a7a70];
const CUBOS = {
  m: [[0xd88a6a, 0xa8452c, 0x5e2012, 0xf2c4b0], [0xc0783e, 0x88441e, 0x4e2410, 0xf6cc80]],
  p: [[0xa8f070, 0x3cc43a, 0x1f7a24, 0xe0ffb0], [0x8ca844, 0x52722a, 0x2c4416, 0xe8e488]],
  o: [[0xf2e0f6, 0xa050c0, 0x5e2478, 0xffffff], [0xe6b4bc, 0xa46a7c, 0x5c3448, 0xf8e0c4]],
};

// contorno oscuro de 1 px alrededor de lo opaco
function borde(r) {
  const at = (x, y) => (r[y - 1] || '')[x - 1] || '.', o = [];
  for (let y = 0; y < r.length + 2; y++) {
    let l = '';
    for (let x = 0; x < r[0].length + 2; x++) {
      const c = at(x, y);
      l += c !== '.' ? c : (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)) !== '....' ? 'k' : '.';
    }
    o.push(l);
  }
  return o;
}

function tex(s, key, rows, sc, pal, nb) {
  if (!nb) rows = borde(rows);
  const g = s.add.graphics();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') g.fillStyle(pal[row[x]], 1).fillRect(x * sc, y * sc, sc, sc);
  });
  g.generateTexture(key, rows[0].length * sc, rows.length * sc);
  g.destroy();
}

function crearTexturas(s) {
  const at = s.textures.get('at');
  for (const k in FR) at.add(k, 0, ...FR[k]);
  tex(s, 'pq', PQ, 4, PAL);
  // palito en diagonal
  const st = [];
  for (let y = 0; y < 20; y++) {
    let l = '';
    for (let x = 0; x < 21; x++) l += x === 19 - y ? 'T' : x === 20 - y ? 't' : '.';
    st.push(l);
  }
  tex(s, 'stk', st, 2, PAL);
  for (const k in CUBOS) [...CUBOS[k], QUEMADO].forEach((c, e) => tex(s, 'q' + k + e, CUBO, 3, { k: 0x2a1610, 1: c[0], 2: c[1], 3: c[2], 4: c[3] }));
}

// ===== ESCENA =====
function create() {
  const s = this;
  s.textures.once('addtexture', () => arrancar(s));
  s.textures.addBase64('at', 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAKAAAABZCAMAAACOjN-OAAAAAXNSR0IB2cksfwAAAFFQTFRFAAAABgQHGRUa+LNb6TM1-MJ5+-n2LSkt02cuQWCK5Yo-2ikp+uGw97l9apofuR8hnEwtMztORj0uK0d4tmVEfxsYcmt9kqW951nloZaXrCa3kellEgAAABt0Uk5TAP----------------------------------xGlyNQAADPBJREFUeJztW4uSo7gOjczLGAgQSNLp---Qq4ffNtMztY+qrbreqe0eHyQdy7JsC+Z2+w81kPYvAJfGf8mul1Y85pH+CgBVVVYadBK-D4QnFMLHeJRPWdnXOKYMnc7PG4UyZb0fElT6SQBqAmPpBP9E27ZIkP9kPBhBAFuCQGt6C7SpWtAWuBgSW6kD4wVDsDTe49HSbxkiDMeEiCPejxmA-LSlgcpiCWgdj+nV14H+1b+rEWpZHEWwMcLYTBMQqMPkGfY5DwuwICQSvn-6HaAkSDzWFX-38W0JegUZEHj4aIPVUpcHwgLiIbVa9K25E5zAWicY65RmDUYEa4AbduhHD4oyMbdCMdYAxNYnq3-datkGyMY8OQbY1jYjOFlscoB0kNoJW4t+hzDFrhHih0QSChv123mKVVmCJFJmITQ8qXWy7JQCHKGnTkZWZsHUndZp8iQUCTkgsreuE0zJkBzBCceRjdV5luIgS3T4LIRmkKByfmbqlrdQ9wAxnCbfG02xMzit8Y7iXEtDRZkIeAaPV7YggDuwuxU3OJsGfwwWFNuafvJvytOAQFoeiqfDxQpjEcD9SgCIVUkkp0BEUJO2gbV12MA-xMQUtMIdmuAnJqW0DIuAmwdUQl1BAbBSVQXiEXmGdrjyXLd08XxRp9Z33apkHgVoMZxEbEmA0DKJ0K+uAHhUNmo7HeihBT3YkKccxDJaa+eUWwy0WqLz9AKpuSScMoJdDaDnlyLJEMGJ3W4WIqj9hFmfyxrCzscjAUgQ+xuYg1aIzdFY47nwDQf8qDkQg70kiMFnY9M0FICd1p1l6GQBCRKmOhm3D5bJAtB5lw+RPZyQZXHBHAOwQaegJI4El5LgMLDPB2WY37yQRRAeCA1WlEFPcPBT0oR+5hERQczagzw0rYkiAnENXBHEAYspFRFUniAvb7sWgjlHcKlNJMvUCXZXBLsKQWuIB0wal6ULPCwq6ccJW0AyY9MEB2YB3ywO8RLyA+alGpsoUU6xS8YgS4ieiDJAlJAbSJKxawa6aKk6CiLY5RKWX2RCEpZyWW4pkkxgMY6SeqNHIh5j3B8AFFKphDWXpqV0TBkQvJCoKqz1Ix6OQasakXEcqwxHAUplDPZHbUw8qqrEmALpI3hpGkc15nuhSK4Kj9OvfA+HD12k+j291AVvjP2cSwjwRl01kf36Wgfwwt0MrzmiIYXO88TB6WTyeWo+MNq9Pze3rXhuGvHYlLnq9XrtGsYzA9AvGwu0Fy68SQRKQM3wiV3YEMFTTccYrVYxp09ot-GdMaRAlyMVTlkisZAIDnQax08yTR87JNR24ULg3AJK9uVE69MFSFcQpCZpPSHYCMGJ80ws0bm57NJ0h8A0rdOqmEadIB5iFo62vtcJQdq99r2mFdQ+SLcq5rif5-frBUs+pB2bQnXZWCks++394rNUnSAwv8-rg2sljzUkeBzIMcuhbG2Hpctzl1vdB52OogWkhCAqy4goWvE9W67lQacU1DiWaeMmM7+zFwsRYN+OOXB4TeVqJYKliXE-KgKZLD9wjHmWGkZyH6nNAPTR4cQS4M3uO0pVr5EGhP0flfTvLCDZ9pLfWwZwjO93EjfD8CZhVPJOeQwDayV7aeYc9rdVlYiwKhpS1o+alBe4SoR0pGEhStRDppXTCB2kHo9E7TBIPsYDTwQoL4ExM0QHeFK1s40DbUQSdIZkm6SqPPF7a48BZC99ZFp5kfITJcEb7f4JAAwoMZwTtMc40hVJOJ+w7UedIKARS3AYUheClR5gyKZyGEQtQA5AwigAjmAiEQQGYnq9HVvpytK7XQF-LHGrAXAF-L-9zc3tlL8NwKXEjyK-bzx+wF7cIEfwMk8t2yaBLkxNTQKh5kSs6WoirK3clUgV2bjM1GKrEBbazC81B64XmeTWGmldl+nqIiDjbUwFiB-hB4RKF7maAR4aXelToPHmsjxjjMey-qbp6kAXA-lrF8cDrWzYTls9glir5gYBQQlRuZ2+PyIYMaQTus1HaX8YbNTf-DJ2navQWeomzsZrJYT4xAf0yQhaO5+nPrfGIY-Ynlg028bTfWOHhX6tt41+BTESjWg7mW3l4PR4cFlGa4PSJ3rlpnk-hSdHmcYg0RrP-mjyJgBeDubGevfc-DWD58HQ0f6k6WCn3KxfEMAubQgRwPWfptmkmSJ0Kag7lCIGrsyG5kS2OY0AFjnBsusaYxIRR88YDpTt3OzK6kQC6TwtB0YaY1WJAA196wIQ8+s6ZmDn0kcB1Qsb8qgFkKqLQQY80oT7HgIhmrApG7OwNSZaVM4GAvh8F0tEFTvHr7F+oAuxiVYYr32yzVUTQ3+TWMeYoVkFW65YmlC-dCkzCndgCQKIosH-Tt+PwLNrcol8fWimwRWLjoyF8qXQkEoQdpNmT9DR46tKfKbykRDP-C3tc0VciHYjG40VgsRjQ1uzFKgbXyQihJkvdLv8wKIdQQKY93JmBD1HqawndyABOkN3qahofIt5zyVBwale2-BtEKNrCtmYJ74xi629Rg6RcplmGZO8eQFfS0uvl1bEKPYDZADZoVJtfSvBR1wGlAJhLMtVOwEgAZTLjuk27QnGtdcgIpXmuUowKw4kOv1u3CUXXannLTaFZ1pd-l6yOb4g6N505GcSL8B77fWJ+un4pTs5VdcbRyQTsXX34tDCGWHJTzoSTBURqQwaPhyVFdZIeKmbkzpvUZ3l5aVNVynMA+cGs2SFAlyl+oHpvahwkA2tjFnyTS56gq-FShVFTqoF4FXmWSQAFHlxdaaSGOzCg5yf7d3LvVa5uvEv+I2nKjMlVz2I+lkCr9erV+PrVRBUrxnbh+olqciAIh93HYyBz-6YZy40XxBcxnHfTxJV6VVRdU+0s9EIswIC1RrePdHMXv-BQwjmRRHS8fp8PpBebBGYYWaB-bVd3NsxjnC0RHBPP8ihBbztjw0G-tolAhok+CEWTR44YJSzlxxMMclZgnvaj-uHCLxMflDwNGgjPIngm2iE9x5Sn9y2YTimdg4A7RP7jgR7PvAlhUNjBrE3GD5SBSOgdmSolElEoHsKQYWHrqbKEOy5HX1P76LnQPDBC58QfvEeEdw4XGdO8U2cmIDPMBRRzD0arFs4ChIRfgMjAibT5a2JozhdUoAEpY2k4cG+gou2GLtfDHyQSEuvEL3Ja+I37qycKzEJQamRkGloisujHZx1k7QoQOybJ2WRdOOynVBcBJ2iITsUDLwIbX8OWF0XWx1EBIsXJYcjmAGBRpHWBNiHYg-k3lwkGdLVVocpwfLL35OMgWDST1Vhcsh+QK5s3xVrykUO7KDuPEFygZksHJeJUOqrySGzgsT9w3Ec6Gz6LC4nyNV1XLJHumXQswTsWQanMj0LkKorgkodshPtKuOhRnldO6g9jZvHfkD1O5KBS6n2KJ72U0chQkVSEthLXRFBqm2qW14vvVFlkzps9TOsHirJ4pIsBCg3SbgCIVG8xATzYi2ubAnRiwqrYoLMg7+dKAjSTk78UnNyts-LtmCfRIJQFIcHtpGKcJYA+XFB0B1AbkWs-QCU-Tl01V8At1LgP9auz2J-QUPNJ9Vk8TvKqzKUn8Jm9UtClRQF8qkDpM+48sLF9aNOz33RmXOIvq0sCd0Ty3ej73eIn26kHmjCbZWY8cmF-3-xarNCD2b7Ad+chTt9Yrk69d-fqS-uwTnQ9-dpm1b6AhgcGTN3jqF0NQ0xI25E83fnmbzH3yT2OUP7YloIwvfX3CNFB90VEiSPCb+21fdpXad1ki9-yVdzY0s1crFnftKY2v1+b4uvQWv87OeyUzTHMrhpmpG6fC0K3-P87r-6b1ss5cnEjHenaYYemODn-pzaCYghSPVa+DFBz4-JtY-72t7baf2RIUef1vwp7zRbNi37dOavV6Xn8-X11ff918w+hHt-p4b8yIc4wYDMtJ7MKgTlDYB4j6uLQlDK2Xq7P1f6VPS5Ptef+Clw3x+j+XVlOuhUPdmvUNen+O+b6SFJmmWentky5NRLF5npOU2w4u8nFcCs87TRK9d0qAdXRXtX9-bZtgpVr8-nzzGI+uw3sUxP+E1KPj1eLT8hiBS-eJJxVHfb2IWIbxtftoA+V9iYsm6k8IhtlQo1va-AQJ-uCucFnUf0uvknhgDryp-Xa+EnEfbkvzyfq6-EffMUz0IQKgTp45Wt36iSyzq0Dm8GRIfB1fzkUYvvkN3sFvivGIpEq6OPw6VviyaACPIc9zYGA0FxsRDk5sYkldH46sEjZ89hjM5Ug08Ld9c+XONP17225CnMMui-r+86wYhhVENMVbqaMKVdYWd+h59T9XMsfPW4hN185QRJSUyvoqARrzE3t77-1rNLPIySYP1gEIuHOr9h5+mfvfIXyHqCf2CDw9Jka+efarxVPf7USojC4h9q-QPtXzn9-g8IPpn3vIUSUgAAAABJRU5ErkJggg=='.replace(/-/g, '/'));
}

function arrancar(s) {
  s.ph = 'title';
  s.modo = 1;
  s.act = 0;
  s.hs = { 1: [], 2: [] };
  s.saveStatus = '';
  s.ne = { letters: [], row: 0, col: 0, cd: 0, last: '0,0' };
  crearTexturas(s);
  dibujarFonda(s);
  crearTiles(s);
  crearJugadores(s);
  crearHud(s);
  s.luz = s.add.graphics().setDepth(2);
  s.fxB = s.add.graphics().setDepth(1);
  s.fx = s.add.graphics().setDepth(30);
  s.fxT = s.add.graphics().setDepth(42);
  s.cp = { on: 0, x: 0, y: 0, t: 0 };
  s.cpS = s.add.image(0, 0, 'pq').setOrigin(0.5, 1).setAlpha(0);
  crearTitulo(s);
  crearPausa(s);
  crearFin(s);
  createControls(s);
  nuevoEstado(s);

  for (const m of [1, 2]) {
    loadHighScores(KEYS[m])
      .then((hs) => { s.hs[m] = hs; refrescarTop(s); })
      .catch(() => { s.saveStatus = 'Sin almacenamiento: no se guardan puntajes.'; });
  }
  refrescarTop(s);
}

function update(time, delta) {
  const s = this;
  if (!s.controls) return;
  const dt = Math.min(delta, 50) / 1000;
  s.now = time;
  if (s.ph === 'title') {
    s.tituloBlink.setColor(Math.sin(time / 200) > 0 ? '#ffe066' : '#ffffff').setScale(Math.sin(time / 200) > 0 ? 1 : 0.94);
    s.chefsT.forEach((c, i) => c.setFrame('ab'[i] + (Math.floor(time / 260 + i) % 2 + 1)));
    if (consume(s, ['P1_U', 'P1_D', 'P1_L', 'P1_R', 'P2_U', 'P2_D', 'P2_L', 'P2_R'])) {
      s.modo = 3 - s.modo;
      dibSel(s);
      refrescarTop(s);
      snd(s, 'click');
    }
    if (consume(s, ['START1', 'START2', 'P1_1', 'P2_1'])) iniciar(s);
  } else if (s.ph === 'play') {
    if (consume(s, ['START1', 'START2'])) {
      s.ph = 'pause';
      s.pausa.setVisible(true);
    } else jugar(s, dt);
  } else if (s.ph === 'pause') {
    if (consume(s, ['START1', 'START2'])) {
      s.ph = 'play';
      s.pausa.setVisible(false);
    }
  } else if (s.ph === 'end') {
    nombreInput(s, time);
  } else if (s.ph === 'saved') {
    if (consume(s, ['START1', 'START2', 'P1_1', 'P2_1'])) volverTitulo(s);
  }
  musica(s);
  render(s, dt);
  for (const k in s.controls.pressed) s.controls.pressed[k] = false;
}

// ===== ESCENOGRAFIA (se pinta una vez a una RenderTexture) =====
const hs = (a) => { const v = Math.sin(a * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };

function estrella(g, x, y, r, col) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r;
    p.push({ x: x + Math.cos(a) * q, y: y + Math.sin(a) * q });
  }
  g.fillStyle(col, 1).fillPoints(p, true);
}

function bandera(g, x, y, w, h) {
  g.fillStyle(0x1a1020, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(0xf4eee0, 1).fillRect(x, y, w, h / 2);
  g.fillStyle(0xd8262a, 1).fillRect(x, y + h / 2, w, h / 2);
  g.fillStyle(0x2456c8, 1).fillRect(x, y, h / 2, h / 2);
  estrella(g, x + h / 4, y + h / 4, h / 6, 0xffffff);
}

function caja(g, x, y, w, h, fill, line, r, lw, a) {
  g.fillStyle(fill, a == null ? 1 : a).fillRoundedRect(x, y, w, h, r || 6);
  if (line != null) g.lineStyle(lw || 3, line, 1).strokeRoundedRect(x, y, w, h, r || 6);
  return g;
}

function esPiso(c, r) { return r >= 0 && r < ROWS && c >= 0 && c < COLS && MAPA[r][c] === '.'; }

// meson en 3/4: plano superior claro + cara frontal oscura si hay piso (o borde) adelante
function meson(g, c, r, top) {
  const x = GX + c * TS, y = GY + r * TS, front = r === ROWS - 1 || esPiso(c, r + 1), ht = front ? 34 : 48;
  g.fillStyle(top || 0xd09a60, 1).fillRect(x, y, TS, ht);
  g.fillStyle(0xeec890, 1).fillRect(x, y, TS, 3);
  for (let i = 0; i < 2; i++) g.fillStyle(0xb88250, 1).fillRect(x + 4 + hs(c * 9 + r + i) * 24, y + 10 + i * 12, 10 + hs(r * 3 + c + i) * 14, 1);
  g.fillStyle(0xa87040, 1).fillRect(x + TS - 1, y, 1, ht);
  if (front) {
    g.fillStyle(0x2e1608, 1).fillRect(x, y + 34, TS, 2);
    g.fillStyle(0x56301a, 1).fillRect(x, y + 36, TS, 12);
    g.fillStyle(0x3e2010, 1).fillRect(x + 15, y + 37, 1, 11).fillRect(x + 31, y + 37, 1, 11).fillRect(x, y + 47, TS, 1);
    if (r < ROWS - 1) g.fillStyle(0x000000, 0.35).fillRect(x, y + 48, TS, 7);
  }
  if (esPiso(c + 1, r)) g.fillStyle(0x000000, 0.25).fillRect(x + TS, y + 3, 5, 45);
  g.fillStyle(0x2e1608, 1);
  if (esPiso(c - 1, r)) g.fillRect(x, y, 2, TS);
  if (esPiso(c + 1, r)) g.fillRect(x + TS - 2, y, 2, TS);
  if (esPiso(c, r - 1)) g.fillRect(x, y, TS, 2);
}

// cajon de madera (el ingrediente se estampa encima)
function cajon(g, x, y) {
  g.fillStyle(0x000000, 0.3).fillRect(x + 6, y + 6, 38, 30);
  caja(g, x + 3, y + 2, 42, 32, 0x8a5430, 0x2a1408, 2, 2);
  g.fillStyle(0x3a1e0e, 1).fillRect(x + 6, y + 5, 36, 21);
  g.fillStyle(0x6a3a1c, 1).fillRect(x + 4, y + 27, 40, 6);
  g.fillStyle(0xa86a3a, 1).fillRect(x + 4, y + 27, 40, 1);
}

function dibujarFonda(s) {
  const rt = s.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(0);
  const g = s.add.graphics();
  g.fillStyle(0x16121f, 1).fillRect(0, 0, W, H);
  // franja superior: tablero oscuro donde cuelgan las comandas (separado de la cocina)
  for (let x = 0; x < W; x += 24) {
    g.fillStyle(x % 48 ? 0x2a1b12 : 0x2e1e14, 1).fillRect(x, 0, 24, 96);
    g.fillStyle(0x1a100a, 1).fillRect(x, 0, 1, 96);
  }
  g.lineStyle(2, 0xb8a080, 1).lineBetween(0, 8, 584, 8);
  // fleco del toldo a rayas
  for (let i = 0; i < 37; i++) {
    const cx = i * 22 + 11, red = i % 2 === 0;
    g.fillStyle(0x3a1414, 1).fillCircle(cx, 104, 11);
    g.fillStyle(red ? 0xd02a2e : 0xf4ece0, 1).fillCircle(cx, 103, 10).fillRect(cx - 11, 92, 22, 11);
    g.fillStyle(red ? 0xa01c22 : 0xd8ccb8, 1).fillRect(cx - 11, 92, 22, 3);
  }
  // piso de baldosas de greda apagadas (el plano de menor contraste)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const X = GX + c * TS, Y = GY + r * TS, v = hs(c * 7 + r * 13);
    g.fillStyle([0x7a5838, 0x76553a, 0x7e5c3c][Math.floor(v * 3)], 1).fillRect(X, Y, TS, TS);
    g.fillStyle(0x8a6644, 1).fillRect(X + 2, Y + 2, TS - 4, 2).fillRect(X + 2, Y + 2, 2, TS - 4);
    g.fillStyle(0x5e432a, 1).fillRect(X, Y + TS - 2, TS, 2).fillRect(X + TS - 2, Y, 2, TS);
    for (let i = 0; i < 3; i++) g.fillStyle(0x6a4c30, 1).fillRect(X + 6 + hs(v * 50 + i) * 34, Y + 8 + hs(v * 70 + i * 3) * 32, 2, 2);
  }
  // costados: afuera de noche y baranda
  for (const L of [0, 1]) {
    const X = (x, w) => (L ? W - x - w : x);
    g.fillStyle(0x1e1828, 1).fillRect(X(0, GX), GY, GX, H);
    g.fillStyle(0x6a4222, 1).fillRect(X(14, 8), GY, 8, H);
    g.fillStyle(0x8a5a30, 1).fillRect(X(14, 8), GY, 3, H);
  }
  // mesones y puestos
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = MAPA[r][c];
      if (ch === '.') continue;
      const x = GX + c * TS, y = GY + r * TS;
      if (ch === 'G') {
        // parrilla de ladrillo: rejilla y brasas se animan en render
        g.fillStyle(0x2a2a34, 1).fillRect(x, y, TS, 36);
        g.fillStyle(0x4a4a56, 1).fillRect(x, y, TS, 3);
        g.fillStyle(0x140a08, 1).fillRect(x + 4, y + 5, TS - 8, 26);
        // brasas fijas y rejilla (el titileo es un velo de color en render)
        for (let i = 0; i < 40; i++) g.fillStyle([0x4a1208, 0x8a2010, 0xc83818, 0xf06a1a, 0xffb040][Math.floor(hs(i + c * 40) ** 2 * 5)], 1).fillRect(x + 4 + (i % 10) * 4, y + 6 + Math.floor(i / 10) * 6, 4, 5);
        for (let i = 0; i < 5; i++) g.fillStyle(0x24242c, 1).fillRect(x + 2, y + 7 + i * 5, 44, 2).fillStyle(0x9a9aa8, 1).fillRect(x + 2, y + 6 + i * 5, 44, 1);
        g.fillStyle(0x7a3426, 1).fillRect(x, y + 36, TS, 12);
        g.fillStyle(0x4a1c14, 1);
        for (let i = 0; i < 3; i++) for (const d of [4, 20, 36]) g.fillRect(x, y + 36 + i * 4, TS, 1).fillRect(x + (i % 2) * 8 + d, y + 37 + i * 4, 1, 3);
        g.fillStyle(0x140a08, 1).fillRect(x + 8, y + 40, TS - 16, 7);
        g.fillStyle(0x000000, 0.35).fillRect(x, y + 48, TS, 7);
        g.fillStyle(0x16121a, 1);
        if (MAPA[r][c - 1] !== 'G') g.fillRect(x, y, 2, TS);
        if (MAPA[r][c + 1] !== 'G') g.fillRect(x + TS - 2, y, 2, TS);
        continue;
      }
      meson(g, c, r, ch === 'V' ? 0x8a8a96 : ch === 'A' ? 0xe2b47a : 0);
      if (ch === 'A') {
        // meson de armado: madera lisa clara con franja crema (distinto de la tabla de cortar)
        g.fillStyle(0xfff0c8, 1).fillRect(x, y + 26, TS, 5);
      } else if (ch === 'V') {
        // ventana de entrega: bandeja de acero bajo un marco con campana
        g.fillStyle(0xc8ccd8, 1).fillRect(x, y + 4, TS, 26);
        g.fillStyle(0xeef0f6, 1).fillRect(x, y + 4, TS, 3);
        g.fillStyle(0x9aa0b0, 1).fillRect(x, y + 27, TS, 3);
      } else if (ch === 'T') {
        // tabla de cortar con cuchillo
        g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 6, y + 7, 36, 24, 4);
        caja(g, x + 4, y + 4, 36, 24, 0xe6be82, 0x8a5a30, 4, 2);
        g.fillStyle(0xf4d49c, 1).fillRect(x + 7, y + 7, 30, 2);
        g.fillStyle(0x2a1610, 1).fillRect(x + 41, y + 3, 6, 18);
        g.fillStyle(0xd8dce4, 1).fillRect(x + 42, y + 4, 4, 12);
        g.fillStyle(0xffffff, 1).fillRect(x + 42, y + 4, 1, 12);
        g.fillStyle(0x5a3418, 1).fillRect(x + 42, y + 16, 4, 12);
      } else if (ch === 'E') {
        // pocillo de greda con pebre
        g.fillStyle(0x000000, 0.3).fillEllipse(x + 26, y + 30, 42, 10);
        g.fillStyle(0x2a1408, 1).fillEllipse(x + 24, y + 18, 44, 28);
        g.fillStyle(0xc0602e, 1).fillEllipse(x + 24, y + 18, 40, 24);
        g.fillStyle(0x7a3418, 1).fillEllipse(x + 24, y + 13, 36, 14);
        g.fillStyle(0x2f8a2a, 1).fillEllipse(x + 24, y + 13, 32, 10);
        for (let i = 0; i < 14; i++) g.fillStyle([0xe8262a, 0x9ae060, 0xf4ece0][i % 3], 1).fillRect(x + 11 + hs(i) * 24, y + 10 + hs(i * 3) * 6, 3, 2);
        g.fillStyle(0xe6be82, 1).fillRect(x + 30, y + 2, 4, 12);
      } else if (ch === 'K') {
        // barril de vino
        g.fillStyle(0x000000, 0.35).fillEllipse(x + 25, y + 36, 40, 8);
        caja(g, x + 8, y, 32, 36, 0x7a4a24, 0x2a1408, 7, 2);
        g.fillStyle(0x9a6436, 1).fillRect(x + 13, y + 3, 5, 30);
        g.fillStyle(0x3a3a44, 1).fillRect(x + 8, y + 7, 32, 3).fillRect(x + 8, y + 26, 32, 3);
        g.fillStyle(0x6a1020, 1).fillCircle(x + 24, y + 18, 5);
        g.fillStyle(0xa8a8b4, 1).fillRect(x + 22, y + 22, 4, 7);
      } else if (CAJ[ch]) {
        cajon(g, x, y);
        if (ch === 'P') for (let i = 0; i < 6; i++) {
          g.fillStyle(0x2a1610, 1).fillRect(x + 6, y + 6 + i * 3.5, 36, 3);
          g.fillStyle(i % 2 ? 0xd8b070 : 0xf0d098, 1).fillRect(x + 7, y + 6 + i * 3.5, 34, 2);
        }
      }
    }
  }
  // marco de la ventana de entrega: postes, travesano y campana
  const vx = GX + 6 * TS, vy = GY + 9 * TS;
  g.fillStyle(0x2e1608, 1).fillRect(vx - 6, vy - 14, 10, 50).fillRect(vx + 3 * TS - 4, vy - 14, 10, 50).fillRect(vx - 8, vy - 18, 3 * TS + 16, 8);
  g.fillStyle(0xa86a3a, 1).fillRect(vx - 4, vy - 12, 6, 46).fillRect(vx + 3 * TS - 2, vy - 12, 6, 46).fillRect(vx - 6, vy - 16, 3 * TS + 12, 4);
  g.fillStyle(0x2a1408, 1).fillCircle(vx + 3 * TS - 14, vy + 14, 9);
  g.fillStyle(0xf0c040, 1).fillCircle(vx + 3 * TS - 14, vy + 14, 7).fillRect(vx + 3 * TS - 16, vy + 4, 4, 4);
  g.fillStyle(0xfff0a0, 1).fillCircle(vx + 3 * TS - 16, vy + 12, 2);
  rt.draw(g);
  g.clear();
  // ingredientes apilados en los cajones
  // un icono grande por cajon (el mismo de las comandas): se lee sin etiqueta
  const ST = { C: 'mr', R: 'pr', O: 'or', Z: 'zr', N: 'nr' };
  for (let c = 0; c < COLS; c++) {
    const k = ST[MAPA[0][c]];
    if (k) rt.stamp('at', k, GX + c * TS + 24, GY + 17, { scale: 2 });
  }
  // publico en siluetas y vineta con dithering
  for (let i = 0; i < 34; i++) {
    const x = i * 24 + hs(i) * 14, y = 593 + hs(i * 5) * 6, rr = 8 + hs(i * 2) * 3;
    g.fillStyle([0x1e1a30, 0x26203a, 0x181426][i % 3], 1).fillEllipse(x, y + 12, rr * 3, 16).fillCircle(x, y, rr);
  }
  const BY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  g.fillStyle(0x0a0812, 1);
  for (let y = 108; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      const v = Math.max(1.15 - Math.min(x, W - 3 - x) / 32, 1 - (H - 3 - y) / 12);
      if (v > 0 && v * 16 > BY[((x / 3) % 4) + ((y / 3) % 4) * 4] + 0.5) g.fillRect(x, y, 3, 3);
    }
  }
  adornos(g);
  rt.draw(g);
  g.destroy();
  // placas de los puestos (se ocultan en el titulo)
  s.lbl = s.add.container(0, 0).setDepth(3);
  const P = (c, r, txt, dx, dy, col) => placa(s, s.lbl, GX + c * TS + 24 + (dx || 0), GY + r * TS + 42 + (dy || 0), txt, col);
  P(1, 0, 'PALITOS');
  P(5, 0, 'TABLA', 24);
  P(7, 5, 'PARRILLA');
  P(7, 9, '▼ ENTREGA ▼', 0, -56, '#ffe066');
  P(12, 9, 'VINO');
}

// guirnalda de ampolletas, banderines y banderas (encima de la vineta)
function adornos(g) {
  const amp = (x, y, i) => g.fillStyle(0xffc860, 0.18).fillCircle(x, y, 7).fillStyle(0x2a1a10, 1).fillRect(x - 2, y - 6, 4, 3).fillStyle(i % 2 ? 0xffb040 : 0xffe080, 1).fillCircle(x, y, 3);
  for (let i = 0; i < 24; i++) amp(12 + i * 24, 13 + Math.abs(Math.sin(i * 1.3)) * 3, i);
  for (const L of [0, 1]) {
    const X = (x, w) => (L ? W - x - w : x);
    for (let i = 0; i < 14; i++) {
      const y = 194 + i * 18, x = X(4, 0), d = L ? -1 : 1;
      if (i < 12) g.fillStyle([0xd8262a, 0xf4eee0, 0x2456c8][i % 3], 1).fillTriangle(x, y, x, y + 14, x + d * 14, y + 7);
      amp(X(31, 0), 130 + i * 30, i);
    }
    bandera(g, X(4, 24), 150, 24, 16);
    g.fillStyle(0x2a1a10, 1).fillRect(X(4, 24) + (L ? 23 : -1), 146, 2, 34);
  }
}

function placa(s, cont, x, y, txt, col, sz) {
  const t = s.add.text(x, y, txt, TXT(sz || 12, col || '#fff4dc')).setOrigin(0.5);
  const g = caja(s.add.graphics(), x - t.width / 2 - 3, y - 9, t.width + 6, 18, 0x15101e, 0x000000, 4, 1);
  cont.add([g, t]);
}

function crearTiles(s) {
  s.tl = [];
  s.tileMap = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = MAPA[r][c];
      if (ch === '.') continue;
      const t = { ch, c, r, x: GX + c * TS + TS / 2, y: GY + r * TS + TS / 2, it: null, smk: 0 };
      if ('#ATG'.includes(ch)) t.ic = s.add.container(t.x, t.y - 6).setDepth(20); // sobre los chefs: lo que hay en el meson siempre se lee
      s.tl.push(t);
      s.tileMap[c + ',' + r] = t;
    }
  }
}

function tileEn(s, x, y) {
  const c = Math.floor((x - GX) / TS), r = Math.floor((y - GY) / TS);
  return s.tileMap[c + ',' + r] || null;
}

function solido(x, y) {
  const c = Math.floor((x - GX) / TS), r = Math.floor((y - GY) / TS);
  return c < 0 || r < 0 || c >= COLS || r >= ROWS || MAPA[r][c] !== '.';
}

// siguiente celda de piso desde (c0,r0) hacia (c1,r1), por BFS
function paso(c0, r0, c1, r1) {
  const d = { [c1 + ',' + r1]: 0 }, q = [[c1, r1]];
  for (let i = 0; i < q.length; i++) {
    const [c, r] = q[i];
    for (const [a, b] of DIRS) {
      const n = c + a + ',' + (r + b);
      if (d[n] == null && esPiso(c + a, r + b)) { d[n] = d[c + ',' + r] + 1; q.push([c + a, r + b]); }
    }
  }
  let best = null, bd = 1e9;
  for (const [a, b] of DIRS) {
    const v = d[c0 + a + ',' + (r0 + b)];
    if (v != null && v < bd) { bd = v; best = [c0 + a, r0 + b]; }
  }
  return best;
}

// camina por el piso hacia el centro de la celda (tc,tr); true al llegar
function ir(e, tc, tr, v) {
  const c = Math.floor((e.x - GX) / TS), r = Math.floor((e.y - GY) / TS);
  let tx = GX + tc * TS + 24, ty = GY + tr * TS + 24;
  if (c !== tc || r !== tr) {
    const n = paso(c, r, tc, tr);
    if (n) {
      const cx = GX + c * TS + 24, cy = GY + r * TS + 24;
      tx = GX + n[0] * TS + 24;
      ty = GY + n[1] * TS + 24;
      if (n[0] !== c && Math.abs(e.y - cy) > 2) { tx = e.x; ty = cy; }
      else if (n[1] !== r && Math.abs(e.x - cx) > 2) { ty = e.y; tx = cx; }
    }
  }
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (d <= v) { e.x = tx; e.y = ty; } else { e.x += dx / d * v; e.y += dy / d * v; }
  return c === tc && r === tr && d <= v;
}

// ===== JUGADORES =====
function crearJugadores(s) {
  s.pl = [0, 1].map((i) => {
    const P = { i, k: null, col: i ? 0x3b82f6 : 0xef4444, h: null, fx: 0, fy: 1, x: 0, y: 0, chop: 0, wt: 0, pz: 0, cu: 0, ign: 0 };
    P.spr = s.add.image(0, 0, 'at', 'ab'[i] + 0).setOrigin(0.5, 1).setScale(2);
    P.bub = s.add.graphics().setDepth(24);
    caja(P.bub, -19, -16, 38, 32, 0xfff6e0, P.col, 10, 3).fillStyle(0xfff6e0, 1).fillTriangle(-5, 14, 5, 14, 0, 21);
    P.bub.lineStyle(3, P.col, 1).lineBetween(-5, 16, 0, 21).lineBetween(5, 16, 0, 21);
    P.hd = s.add.container(0, 0).setDepth(25);
    return P;
  });
}

function moverJugador(s, P, dt) {
  const c = s.controls.held, k = P.k;
  const dx = (c[k + '_R'] ? 1 : 0) - (c[k + '_L'] ? 1 : 0);
  const dy = (c[k + '_D'] ? 1 : 0) - (c[k + '_U'] ? 1 : 0);
  if (!dx && !dy) return;
  if (dx && !dy) { P.fx = dx; P.fy = 0; }
  else if (dy && !dx) { P.fx = 0; P.fy = dy; }
  else if (!(P.fx === dx && !P.fy) && !(P.fy === dy && !P.fx)) { P.fx = dx; P.fy = 0; }
  const v = 175 * dt * (dx && dy ? 0.7071 : 1) * VEL_CU[P.cu];
  let mx = dx * v, my = dy * v;
  // curado: desvio al caminar segun la etapa (nunca lo deja sin moverse)
  if (P.cu) {
    const w = Math.sin(s.now / 260 + P.i * 2) * [0, 0.15, 0.3, 0.5][P.cu] * v;
    if (!dy) my += w; else if (!dx) mx += w; else { mx += w; my -= w; }
  }
  if (mx && libre(s, P, P.x + mx, P.y)) P.x += mx;
  if (my && libre(s, P, P.x, P.y + my)) P.y += my;
}

// en 1P el chef activo pasa a traves del ayudante (el ayudante cede)
function libre(s, P, x, y) {
  const e = 11, o = s.pl[1 - P.i];
  if (solido(x - e, y - e) || solido(x + e, y - e) || solido(x - e, y + e) || solido(x + e, y + e)) return false;
  return (s.modo === 1 && P.k) || Math.hypot(x - o.x, y - o.y) >= 28 || Math.hypot(x - o.x, y - o.y) > Math.hypot(P.x - o.x, P.y - o.y);
}

function objetivo(s, P) {
  return tileEn(s, P.x + P.fx * 34, P.y + P.fy * 34);
}

function nuevo(k) {
  return k === 'a' ? { k, m: 0, p: 0, o: 0, st: 0, ck: 0 } : k === 'z' ? { k, st: 0, ck: 0 } : { k, cut: 0, pr: 0 };
}

function err(s, P, msg) {
  pop(s, P.x, P.y - 96, msg, '#ffb4b4', 13, 1);
  snd(s, 'err');
  return false;
}

const N_CHEF = (P) => (P.i ? 'El fondero' : 'La fondera');

function tomar(s, P) {
  const T = objetivo(s, P);
  if (!T) return;
  const h = P.h, ch = T.ch;
  if (ch === 'E' && h && h.k === 'c') return juntar(s, P, h, { k: 'e' }) && snd(s, 'arma');
  if (ch === 'E' && h && h.k === 'n') return err(s, P, 'Primero el chorizo');
  if (CAJ[ch]) {
    const k = CAJ[ch];
    if (!h) { P.h = nuevo(k); snd(s, 'pick'); return; }
    if (h.k === k && !h.cut && !h.ck && !(k === 'a' && (h.m || h.p || h.o))) { P.h = null; snd(s, 'drop'); return; }
    return err(s, P, '¡Tienes las manos ocupadas!');
  }
  if (ch === 'V') { if (h) entregar(s, P, T); return; }
  if (ch === 'K') return pop(s, T.x, T.y - 30, 'Después de la pega', '#ffd6e0');
  if (ch === 'G') {
    if (!h && T.it) { P.h = T.it; T.it = null; snd(s, 'pick'); return; }
    if (h && !T.it) {
      if (h.k !== 'a' && h.k !== 'z') return err(s, P, 'Eso no va a la parrilla');
      if (h.k === 'a' && !h.m) return err(s, P, '¡Le falta la carne!');
      T.it = h; P.h = null; snd(s, 'sizzle'); return;
    }
    return;
  }
  // mesones y tablas
  if (ch === 'T' && h && !T.it && !'mpo'.includes(h.k)) return err(s, P, 'La tabla es pa\' cortar');
  if (!h && T.it) { P.h = T.it; T.it = null; snd(s, 'pick'); return; }
  if (h && !T.it) { T.it = h; P.h = null; snd(s, 'drop'); return; }
  if (h && T.it) {
    // la base (palito, pan, choripan) se queda donde estaba; lo otro se le agrega
    const base = (x) => 'anc'.includes(x.k);
    if (base(T.it) && !base(h)) { const r = juntar(s, P, T.it, h); if (r) { T.it = r; P.h = null; snd(s, 'arma'); } }
    else if (base(h) && !base(T.it)) { const r = juntar(s, P, h, T.it); if (r) { P.h = r; T.it = null; snd(s, 'arma'); } }
    else err(s, P, 'No caben dos cosas ahí');
  }
}

// agrega x a la base b; devuelve la base resultante o false
function juntar(s, P, b, x) {
  if (b.k === 'a') {
    if (!'mpo'.includes(x.k)) return err(s, P, 'Eso no va en el palito');
    if (b.ck > 0) return err(s, P, 'Ya pasó por la parrilla');
    if (!x.cut) return err(s, P, '¡Córtalo primero!');
    if (b[x.k]) return err(s, P, '¡Ya tiene!');
    b[x.k] = 1;
    return b;
  }
  if (b.k === 'n') {
    if (x.k === 'e') return err(s, P, 'Primero el chorizo');
    if (x.k !== 'z') return err(s, P, 'Eso no va en el pan');
    if (!x.st) return err(s, P, '¡El chorizo está crudo!');
    if (x.st > 1) return err(s, P, '¡Quemado! Ya se deshace');
    return { k: 'c', e: 0, st: 1 };
  }
  if (x.k !== 'e') return err(s, P, 'El choripán ya está');
  if (b.e) return err(s, P, '¡Ya tiene pebre!');
  b.e = 1;
  return b;
}

function accion(s, P, dt, ia) {
  P.cut = false;
  if (!ia && !s.controls.held[P.k + '_2']) return;
  const T = objetivo(s, P);
  if (!T || T.ch !== 'T' || !T.it || !'mpo'.includes(T.it.k) || T.it.cut) return;
  P.cut = true;
  T.it.pr += dt / CORTE * CORTE_CU[P.cu];
  P.chop -= dt;
  if (P.chop <= 0) { P.chop = 0.22; snd(s, 'chop'); }
  if (T.it.pr >= 1) {
    T.it.cut = 1;
    T.it.pr = 0;
    snd(s, 'cortado');
    pop(s, T.x, T.y - 28, '¡Cortado!', '#c8f5a8');
  }
}

// ===== PEDIDOS =====
// primero anticucho completo, a los 30 s choripan, a los 60 s variantes
function elegirPedido(s) {
  const e = s.g.el, R = Math.random, va = e >= 60 && R() < 0.6;
  if (e >= 30 && R() < 0.45) return { r: 'c', e: va ? 0 : 1, v: va };
  const q = va ? [[1, 0], [0, 1], [1, 0], [0, 1], [0, 0]][Math.floor(R() * 5)] : [1, 1];
  return { r: 'a', p: q[0], o: q[1], v: va };
}

function calza(it, tk) {
  return tk.r === 'a' ? it.k === 'a' && it.st === 1 && it.m && !!it.p === !!tk.p && !!it.o === !!tk.o : it.k === 'c' && !!it.e === !!tk.e;
}

function nombre(it) {
  return it.k === 'a' ? 'anticucho ' + (it.p && it.o ? 'completo' : it.p ? 'sin cebolla' : it.o ? 'sin pimentón' : 'solo carne') : 'choripán ' + (it.e ? 'con' : 'sin') + ' pebre';
}

// comanda crema: franja de color por plato, icono grande, ingredientes en fila (lo que no lleva, tachado)
function nuevoTicket(s) {
  const f = s.g.el / RONDA, tk = elegirPedido(s), A = tk.r === 'a';
  tk.T = tk.t = (58 - 24 * f + (tk.v ? 8 : 0)) * (s.modo === 1 ? 1.2 : 1);
  const c = s.add.container(W, 6).setDepth(40);
  const g = s.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(3, 5, 104, 90, 8);
  caja(g, 0, 0, 104, 90, 0xfff4d8, 0x3a2416, 8, 3);
  g.fillStyle(A ? 0xc8282c : 0xe08a1c, 1).fillRect(3, 3, 98, 15);
  g.fillStyle(0xf2e2bc, 1).fillRoundedRect(5, 55, 94, 22, 5);
  c.add([g, s.add.text(52, 11, A ? 'ANTICUCHO' : 'CHORIPÁN', TXT(11, '#fffaf0')).setOrigin(0.5)]);
  const ic = s.add.container(52, 37);
  sync(s, ic, A ? { k: 'a', m: 1, p: tk.p, o: tk.o, st: 1 } : { k: 'c', e: tk.e });
  c.add(ic);
  const x = s.add.graphics();
  (A ? [['mr', 1], ['pr', tk.p], ['or', tk.o]] : [['zr', 1], ['nr', 1], ['eb', tk.e]]).forEach(([k, on], i) => {
    const X = 22 + i * 30;
    c.add(s.add.image(X, 66, 'at', k).setAlpha(on ? 1 : 0.45).setScale(1.2).setTint(k === 'zr' ? ZT[1] : 0xffffff));
    if (!on) for (const [w, col] of [[6, 0x3a2416], [3, 0xe02a2a]]) x.lineStyle(w, col, 1).lineBetween(X - 9, 58, X + 9, 74).lineBetween(X + 9, 58, X - 9, 74);
  });
  c.add(x);
  tk.c = c;
  s.g.tk.push(tk);
  snd(s, 'ticket');
}

function quitarTicket(s, tk) {
  s.g.tk.splice(s.g.tk.indexOf(tk), 1);
  s.tweens.add({ targets: tk.c, y: -100, alpha: 0, duration: 300, onComplete: () => tk.c.destroy() });
}

function entregar(s, P, T) {
  const h = P.h;
  if (h.k === 'z') return err(s, P, 'Falta el pan');
  if (h.k === 'n') return err(s, P, 'Falta el chorizo');
  if (h.k !== 'a' && h.k !== 'c') return err(s, P, 'Eso no se vende solo');
  if (h.k === 'a') {
    if (!h.m) return err(s, P, '¡Le falta la carne!');
    if (h.st === 0) return err(s, P, '¡Está crudo!');
    if (h.st === 2) return err(s, P, '¡Quemado! Ya se deshace');
  }
  const ok = s.g.tk.filter((tk) => calza(h, tk)).sort((a, b) => a.t - b.t)[0];
  if (!ok) {
    P.h = null;
    pop(s, T.x, T.y - 44, 'Sin pedido: 0 puntos', '#ffe066');
    return;
  }
  const tip = Math.round(15 * ok.t / ok.T);
  const pts = PTS + (ok.v ? EXTRA : 0) + tip;
  s.g.sc += pts;
  s.g.ok++;
  P.h = null;
  quitarTicket(s, ok);
  snd(s, 'ok');
  pop(s, T.x, T.y - 44, '+' + pts, '#ffe066', 22);
  if (tip > 0) pop(s, T.x, T.y - 18, 'propina +' + tip, '#c8f5a8');
  pop(s, 746, 60, '+' + pts, '#ffe066', 20);
  s.tweens.add({ targets: s.hudSc, scale: 1.3, duration: 120, yoyo: true });
}

// ===== RONDA =====
function nuevoEstado(s) {
  s.g = { el: 0, sc: 0, tk: [], nextT: 1, ok: 0, venc: 0, quem: 0, sz: 0, beep: 0, sec: -1, fase: 0, cpT: CP_PRIMERO, sorbos: 0, th: TENT_INI, cp1: 0 };
}

function iniciar(s) {
  if (s.g) s.g.tk.forEach((tk) => tk.c.destroy());
  nuevoEstado(s);
  s.tl.forEach((t) => { t.it = null; });
  s.act = 0;
  s.pl.forEach((P, i) => {
    Object.assign(P, { x: GX + (i ? 11 : 3) * TS + 24, y: GY + 6 * TS + 24, h: null, fx: 0, fy: -1, cu: 0, ign: 0, cut: false, wt: 0 });
    P.k = s.modo === 2 ? 'P' + (i + 1) : i ? null : 'P1';
  });
  s.cp.on = 0;
  s.tweens.killTweensOf(s.cpS);
  s.cpS.setAlpha(0);
  s.titulo.setVisible(false);
  s.fin.setVisible(false);
  s.lbl.setVisible(true);
  s.avQ = [];
  s.avT = 0;
  s.ph = 'play';
  snd(s, 'select');
  aviso(s, '¡A COCINAR!', '#ffe066');
  if (s.M) s.M.q = s.M.k = 0;
}

// 1 jugador: B3 cambia de chef
function cambiar(s) {
  const a = s.pl[s.act];
  a.k = null;
  a.cut = false;
  a.ign = 0;
  s.act = 1 - s.act;
  const b = s.pl[s.act];
  b.k = 'P1';
  b.ign = 0;
  snd(s, 'click');
}

function beber(s, P) {
  snd(s, 'glu');
  pop(s, P.x, P.y - 100, '¡Salud!', '#ffe066', 18);
  if (P.cu > 2) return;
  P.cu++;
  s.g.sorbos++;
  const n = N_CHEF(P), a = P.i ? 'o' : 'a';
  aviso(s, ['', n + ' se puso alegre...', '¡' + n + ' está curad' + a + '!', '¡' + n + ' está muy curad' + a + '!'][P.cu], '#ff9ad0');
}

function jugar(s, dt) {
  const g = s.g;
  g.el += dt;
  const f = Math.min(g.el / RONDA, 1);
  if (g.el >= RONDA) return terminar(s);
  if (!g.fase && g.el >= 30) { g.fase = 1; aviso(s, '¡Ahora piden choripán!', '#ffc860'); }
  if (g.fase === 1 && g.el >= 60) { g.fase = 2; aviso(s, '¡Ojo con las variantes!', '#e6b8ff'); }

  // pedidos: mas frecuentes y mas cortos con el tiempo
  g.nextT -= dt;
  if (!g.tk.length && g.nextT > 2) g.nextT = 2;
  if (g.nextT <= 0 && g.tk.length < MAXT) {
    nuevoTicket(s);
    g.nextT = (17 - 10 * f) * (s.modo === 1 ? 1.3 : 1) * (0.8 + Math.random() * 0.4);
  }
  for (const tk of g.tk.slice()) {
    tk.t -= dt;
    if (tk.t <= 0) {
      g.sc = Math.max(0, g.sc - 10);
      g.venc++;
      pop(s, tk.c.x + 52, 110, '-10 ¡Se fue enojado!', '#ffb4b4', 14, 1);
      snd(s, 'err');
      quitarTicket(s, tk);
    }
  }

  if (s.modo === 1 && consume(s, ['P1_3'])) cambiar(s);
  g.th = TENT_INI - (TENT_INI - TENT_FIN) * f;
  for (const P of s.pl) {
    const x0 = P.x, y0 = P.y;
    if (P.k) {
      moverJugador(s, P, dt);
      if (s.controls.pressed[P.k + '_1']) tomar(s, P);
      accion(s, P, dt);
    } else if (s.modo === 1) {
      ayudante(s, P, dt);
      const ax = P.x - x0, ay = P.y - y0;
      if (!P.cut && (ax || ay)) { P.fx = Math.abs(ax) > Math.abs(ay) ? Math.sign(ax) : 0; P.fy = P.fx ? 0 : Math.sign(ay); }
    }
    // lo quemado en la mano se deshace igual
    if (P.h && deshacer(s, P.h, P.x, P.y - 60, dt)) P.h = null;
    // caminata: 2 frames + nubecita de polvo
    if (P.x !== x0 || P.y !== y0) {
      P.wt += dt;
      P.pz -= dt;
      if (P.pz <= 0) { P.pz = 0.16; polvo(s, P.x - P.fx * 10, P.y + 12); }
    } else P.wt = 0;
  }
  compadre(s, dt, f);

  // parrilla
  let asando = 0, alerta = 0;
  for (const t of s.tl) {
    if (t.it && deshacer(s, t.it, t.x, t.y - 20, dt)) t.it = null;
    if (t.ch !== 'G' || !t.it) continue;
    const it = t.it;
    asando++;
    it.ck += dt;
    const st = it.ck < ASADO ? 0 : it.ck < QUEMA ? 1 : 2;
    if (st !== it.st) {
      it.st = st;
      if (st === 1) { snd(s, 'listo'); pop(s, t.x, t.y - 50, '¡Listo!', '#c8f5a8', 16); }
      else { snd(s, 'quema'); g.quem++; pop(s, t.x, t.y - 50, '¡Se quemó!', '#ffb4b4', 14, 1); }
    }
    const w = st === 1 && it.ck > QUEMA - 2.5;
    if (w) {
      alerta = 1;
      if (!it.av) { it.av = 1; aviso(s, '¡Se quema!', '#ff8c3a'); }
    }
    // humo solo cuando se esta quemando
    t.smk -= dt;
    if ((w || st === 2) && t.smk <= 0) {
      t.smk = st === 2 ? 0.06 : 0.14;
      humo(s, t.x + (Math.random() - 0.5) * 24, t.y - 10, st === 2 ? 0x2a2626 : 0x807a78);
    }
  }
  g.sz -= dt;
  if (asando && g.sz <= 0) { g.sz = 0.5 + Math.random() * 0.4; snd(s, 'sizzle'); }
  g.beep -= dt;
  if (alerta && g.beep <= 0) { g.beep = 0.4; snd(s, 'alarma'); }

  const left = Math.max(0, Math.ceil(RONDA - g.el));
  if (left !== g.sec) {
    g.sec = left;
    if (left <= 10 && left > 0) snd(s, 'tick');
    if (left === 10) aviso(s, '¡Últimos 10 segundos!', '#ff6b6b');
  }
}

// lo quemado dura HUMO_T s y se deshace en una nube de humo (resta puntos)
function deshacer(s, it, x, y, dt) {
  if (it.st !== 2 || (it.qt = (it.qt || 0) + dt) < HUMO_T) return false;
  for (let i = 0; i < 12; i++) humo(s, x + (Math.random() - 0.5) * 34, y + (Math.random() - 0.5) * 20, i % 2 ? 0x3a3636 : 0x8a8480);
  s.g.sc = Math.max(0, s.g.sc - QUEMA_PEN);
  snd(s, 'puf');
  pop(s, x, y - 20, '-' + QUEMA_PEN + ' ¡Puf!', '#ffb4b4', 15, 1);
  return true;
}

// celda de piso junto a la estacion T mas cercana a P: [c, r, fx, fy]
function junto(P, T) {
  let b = null, bd = 1e9;
  for (const [a, d] of DIRS) {
    const c = T.c + a, r = T.r + d, k = Math.abs(P.x - GX - c * TS - 24) + Math.abs(P.y - GY - r * TS - 24);
    if (esPiso(c, r) && k < bd) { bd = k; b = [c, r, -a, -d]; }
  }
  return b;
}

// 1P: el chef que no manejas ayuda solo. (a) corta lo crudo de las tablas, (b) saca de la
// parrilla lo que esta por quemarse y lo deja en un meson libre, (c) espera cerca de la parrilla.
// Si se aburre (ocio > g.th) se va al barril. Curado: mas lento y a veces se equivoca de camino.
function ayudante(s, P, dt) {
  const g = s.g, A = s.pl[s.act], v = 120 * dt * VEL_CU[P.cu], dA = Math.hypot(A.x - P.x, A.y - P.y);
  P.cut = false;
  // cede el paso: si el activo se le viene encima, se corre
  if (dA < 40) {
    const d = dA || 1, nx = P.x + (P.x - A.x) / d * v * 1.5, ny = P.y + (P.y - A.y) / d * v * 1.5;
    if (libre(s, P, nx, P.y)) P.x = nx;
    if (libre(s, P, P.x, ny)) P.y = ny;
    return;
  }
  // se equivoca de camino (curado)
  if (P.wrT > 0) { P.wrT -= dt; ir(P, P.wr[0], P.wr[1], v); return; }
  if (P.cu > 1 && Math.random() < dt * 0.12 * P.cu) {
    const c = Math.floor((P.x - GX) / TS), r = Math.floor((P.y - GY) / TS), n = DIRS.map(([a, b]) => [c + a, r + b]).filter(([a, b]) => esPiso(a, b));
    if (n.length) { P.wr = n[Math.floor(Math.random() * n.length)]; P.wrT = 0.9; return; }
  }
  const llegar = (T) => { const j = junto(P, T); if (j && ir(P, j[0], j[1], v)) { P.fx = j[2]; P.fy = j[3]; return true; } };
  if (P.ign > g.th) {
    if (ir(P, BARRIL[0], BARRIL[1], v)) { P.fx = 0; P.fy = 1; beber(s, P); P.ign = 0; }
    return;
  }
  let T;
  if (P.h && P.h.ia) {
    // (b) lleva lo rescatado a un meson libre (el mas cercano)
    T = s.tl.filter((t) => 'A#'.includes(t.ch) && !t.it && junto(P, t)).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
    if (T && llegar(T)) { P.h.ia = P.ign = 0; T.it = P.h; P.h = null; snd(s, 'drop'); }
    return;
  }
  // (a) cortar
  T = s.tl.find((t) => t.ch === 'T' && t.it && 'mpo'.includes(t.it.k) && !t.it.cut);
  if (T) { if (llegar(T)) { accion(s, P, dt, 1); if (T.it.cut) P.ign = 0; } return; }
  // (b) rescatar de la parrilla
  T = !P.h && s.tl.find((t) => t.ch === 'G' && t.it && t.it.st === 1 && t.it.ck > QUEMA - 3.5);
  if (T) {
    if (llegar(T)) { P.h = T.it; P.h.ia = 1; T.it = null; snd(s, 'pick'); pop(s, P.x, P.y - 96, '¡Salvado!', '#c8f5a8'); }
    return;
  }
  // (c) espera cerca de la parrilla, del lado contrario al activo
  P.ign += dt;
  if (ir(P, 7, A.y > GY + 5 * TS ? 4 : 6, v)) { P.fx = 0; P.fy = A.y > GY + 5 * TS ? 1 : -1; }
}

// El compadre con la botella: aparece lejos de los chefs y persigue al mas cercano.
// Si lo alcanza, ese chef toma un sorbo. Se puede esquivar; se aburre y se va.
function compadre(s, dt, f) {
  const g = s.g, C = s.cp;
  if (!C.on) {
    g.cpT -= dt;
    if (f >= CP_TERCIO) g.cpT = Math.min(g.cpT, CP_FIN);
    if (g.cpT > 0) return;
    const L = [];
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
      if (esPiso(c, r) && s.pl.every((P) => Math.abs(c - Math.floor((P.x - GX) / TS)) + Math.abs(r - Math.floor((P.y - GY) / TS)) > 5)) L.push([c, r]);
    }
    if (!L.length) return;
    const [c, r] = L[Math.floor(Math.random() * L.length)];
    Object.assign(C, { on: 1, x: GX + c * TS + 24, y: GY + r * TS + 24, t: 9 + 3 * f });
    s.tweens.killTweensOf(s.cpS);
    s.cpS.setAlpha(1);
    for (let i = 0; i < 6; i++) polvo(s, C.x + (Math.random() - 0.5) * 30, C.y + (Math.random() - 0.5) * 20);
    snd(s, 'compadre');
    if (!g.cp1) { g.cp1 = 1; aviso(s, '¡Ojo con el compadre!', '#ff9ad0'); }
    return;
  }
  C.t -= dt;
  const P = s.pl.slice().sort((a, b) => Math.hypot(a.x - C.x, a.y - C.y) - Math.hypot(b.x - C.x, b.y - C.y))[0];
  const x0 = C.x, v = (50 + 55 * f) * dt, pc = Math.floor((P.x - GX) / TS), pr = Math.floor((P.y - GY) / TS);
  if (pc === Math.floor((C.x - GX) / TS) && pr === Math.floor((C.y - GY) / TS)) {
    const d = Math.hypot(P.x - C.x, P.y - C.y) || 1;
    C.x += (P.x - C.x) / d * Math.min(v, d);
    C.y += (P.y - C.y) / d * Math.min(v, d);
  } else ir(C, pc, pr, v);
  if (C.x !== x0) C.fl = C.x < x0;
  if (Math.hypot(P.x - C.x, P.y - C.y) < 30) { beber(s, P); irse(s, f); }
  else if (C.t <= 0) { pop(s, C.x, C.y - 50, 'Se aburrió', '#d8d0e8'); irse(s, f); }
}

function irse(s, f) {
  s.cp.on = 0;
  s.g.cpT = (f < CP_TERCIO ? CP_INI : CP_FIN) * (0.8 + Math.random() * 0.4);
  s.tweens.add({ targets: s.cpS, alpha: 0, y: s.cpS.y - 24, duration: 450 });
}

function terminar(s) {
  s.ph = 'end';
  s.pl.forEach((P) => { P.cut = false; });
  s.finSc.setText(String(s.g.sc));
  s.finStats.setText('Entregados ' + s.g.ok + ' · Vencidos ' + s.g.venc + ' · Quemados ' + s.g.quem + ' · Sorbos ' + s.g.sorbos);
  s.ne = { letters: [], row: 0, col: 0, cd: 0, last: '0,0' };
  s.finNameLbl.setText(s.modo === 2 ? 'NOMBRE DE LA DUPLA' : 'TU NOMBRE DE FONDA');
  s.finStatus.setText(s.saveStatus || 'Anoten su nombre y elijan LISTO');
  refrescarNombre(s);
  refrescarTop(s);
  marcarLetra(s);
  s.fin.setVisible(true);
  s.av.setAlpha(0);
  s.avQ = [];
  snd(s, 'fin');
}

function volverTitulo(s) {
  s.fin.setVisible(false);
  s.g.tk.forEach((tk) => tk.c.destroy());
  nuevoEstado(s);
  refrescarTop(s);
  s.titulo.setVisible(true);
  s.lbl.setVisible(false);
  s.ph = 'title';
}

// ===== RENDER =====
function sync(s, cont, it) {
  const sig = it ? [it.k, it.cut, it.m, it.p, it.o, it.st, it.e].join('') : '';
  if (cont.sig === sig) return;
  cont.sig = sig;
  cont.removeAll(true);
  if (!it) return;
  const im = (x, y, k) => { const a = FR[k], o = s.add.image(x, y, a ? 'at' : k, a ? k : undefined).setScale(a ? 2 : 1); cont.add(o); return o; }, k = it.k;
  if ('mpo'.includes(k)) {
    if (!it.cut) im(0, 0, k + 'r');
    else [[-9, 5], [8, 6], [-1, -5]].forEach(([x, y]) => im(x, y, 'q' + k + 0));
    return;
  }
  if (k === 'z') return im(0, 0, 'zr').setTint(ZT[it.st]);
  if (k === 'n') return im(0, 0, 'nr');
  if (k === 'e') return im(0, 0, 'eb');
  if (k === 'c') {
    // con pebre: el choripan de la hoja; sin pebre: el chorizo asado tapa el aderezo
    im(0, 0, 'ch');
    if (!it.e) im(1, -2, 'zr').setScale(1.75, 1.4).setTint(ZT[1]);
    return;
  }
  im(0, 0, 'stk');
  const ks = [];
  if (it.m) ks.push('m');
  if (it.p) ks.push('p');
  if (it.o) ks.push('o');
  if (it.m) ks.push('m');
  if (it.p) ks.push('p');
  ks.forEach((q, i) => im(-12 + i * 6, 11 - i * 6, 'q' + q + it.st));
}

function barra(g, x, y, w, f, col) {
  g.fillStyle(0x1a1020, 1).fillRoundedRect(x - 2, y - 2, w + 4, 10, 3);
  g.fillStyle(0x4a3a3a, 1).fillRect(x, y, w, 6);
  const v = w * Math.max(0, Math.min(1, f));
  g.fillStyle(col, 1).fillRect(x, y, v, 6);
  g.fillStyle(0xffffff, 0.35).fillRect(x, y, v, 2);
}

// verde -> amarillo -> rojo
function colorTiempo(f) {
  return f > 0.5 ? (Math.round(80 + 350 * (1 - f)) << 16) | 0xc83c : (0xe8 << 16) | (Math.round(40 + 340 * f) << 8) | 0x3c;
}

// copa de vino chiquita (indicador de tentacion)
function copa(g, x, y) {
  g.fillStyle(0x1a1020, 1).fillTriangle(x - 7, y - 8, x + 7, y - 8, x, y + 3).fillRect(x - 2, y, 4, 8).fillRect(x - 5, y + 6, 10, 3);
  g.fillStyle(0xf4eee0, 1).fillTriangle(x - 5, y - 7, x + 5, y - 7, x, y + 1).fillRect(x - 3, y + 7, 6, 1);
  g.fillStyle(0xb01830, 1).fillTriangle(x - 3, y - 4, x + 3, y - 4, x, y);
}

function render(s, dt) {
  const fx = s.fx, b = s.fxB, L = s.luz, t = s.now || 0, g = s.g;
  fx.clear();
  b.clear();
  L.clear();
  s.fxT.clear();
  const jugando = s.ph === 'play' || s.ph === 'pause';
  if (s.ph === 'play') avisos(s, dt);
  // parrillas: titileo simple de las brasas
  L.fillStyle(0xff8a2a, 0.12 + 0.08 * Math.sin(t / 180)).fillRect(GX + 6 * TS + 4, GY + 5 * TS + 5, 3 * TS - 8, 26);
  for (const T of s.tl) {
    if (!T.ic) continue;
    sync(s, T.ic, T.it);
    const it = T.it;
    if (!it) continue;
    b.fillStyle(0x000000, 0.25).fillEllipse(T.x + 2, T.y + 8, 30, 8);
    if (it.st === 2 && T.ch !== 'G' && Math.random() < dt * 5) humo(s, T.x + (Math.random() - 0.5) * 16, T.y - 12, 0x3a3636);
    if (!jugando) continue;
    if (T.ch === 'T' && !it.cut && it.pr > 0) barra(fx, T.x - 18, T.y - 36, 36, it.pr, 0xffd23a);
    if (T.ch === 'G') {
      // una sola barra por espacio, sobre el espacio: amarillo asando, verde listo -> rojo quemandose
      const bx = T.x - 21, by = T.y - 36;
      if (it.st < 2) {
        const warn = it.st && it.ck > QUEMA - 2.5, blink = warn && Math.sin(t / 70) > 0;
        barra(fx, bx, by, 30, it.ck / QUEMA, !it.st ? 0xffd23a : blink ? 0xff2222 : colorTiempo(1 - (it.ck - ASADO) / (QUEMA - ASADO)));
        fx.fillStyle(0xffffff, 1).fillRect(bx + 15, by - 2, 1, 10);
        if (it.st) {
          fx.fillStyle(0x1a1020, 1).fillCircle(T.x + 18, by + 3, 9);
          fx.fillStyle(0x22c55e, 1).fillCircle(T.x + 18, by + 3, 7);
          fx.lineStyle(3, 0xffffff, 1).lineBetween(T.x + 14, by + 3, T.x + 17, by + 6).lineBetween(T.x + 17, by + 6, T.x + 22, by);
        }
        if (blink) fx.lineStyle(3, 0xff2222, 1).strokeRoundedRect(T.x - 23, T.y - 23, 46, 40, 5);
      } else if (Math.sin(t / 90) > 0) {
        fx.fillStyle(0x1a1020, 1).fillCircle(T.x, by + 2, 10);
        fx.fillStyle(0xff2222, 1).fillCircle(T.x, by + 2, 8);
        fx.fillStyle(0xffffff, 1).fillRect(T.x - 1, by - 3, 3, 7).fillRect(T.x - 1, by + 6, 3, 2);
      }
    }
  }
  // flechas sobre la ENTREGA cuando alguien lleva un plato listo
  if (jugando && s.pl.some((P) => P.h && (P.h.k === 'c' || (P.h.k === 'a' && P.h.st === 1)))) {
    const y = GY + 9 * TS - 34 + Math.abs(Math.sin(t / 150)) * 6;
    for (let c = 6; c < 9; c++) {
      const x = GX + c * TS + 24;
      fx.fillStyle(0x1a1020, 1).fillTriangle(x - 11, y - 7, x + 11, y - 7, x, y + 7);
      fx.fillStyle(0xffe066, 1).fillTriangle(x - 7, y - 5, x + 7, y - 5, x, y + 3);
    }
  }
  for (const P of s.pl) {
    const mv = P.wt > 0 && jugando, act = !!P.k, cu = P.cu, back = P.fy < 0, st = Math.floor(P.wt / 0.13) % 2;
    if (P.fx) P.fl = P.fx < 0;
    const bob = mv ? -Math.abs(Math.sin(t / 65)) * 3 : 0;
    const chop = P.cut ? Math.sin(t / 40) * 2 : 0;
    // cuadros: frente 0 quieto, 1-2 caminando; espalda 4 quieto, 3/5 caminando.
    // muy curado: cambia de pie aunque este quieto (tambaleo por cuadros, sin rotar)
    const pie = mv ? st : cu > 2 ? Math.floor(t / 280) % 2 : -1;
    const fr = back ? (pie < 0 ? 4 : 3 + pie * 2) : pie < 0 ? 0 : 1 + pie;
    const sx = cu > 1 ? Math.round(Math.sin(t / 230 + P.i * 2) * (cu > 2 ? 4 : 2)) : 0;
    const X = Math.round(P.x + chop + sx), Y = Math.round(P.y + 14 + bob);
    P.spr.setFrame('ab'[P.i] + fr).setPosition(X, Y).setDepth(10 + P.y / 1000).setFlipX(!!P.fl).setVisible(jugando)
      .setTint(cu > 2 ? 0xffd0c8 : 0xffffff);
    const w = P.spr.frame.width, top = Y - P.spr.frame.height * 2, hy = top - 20;
    P.bub.setPosition(P.x, hy).setVisible(jugando && !!P.h);
    P.hd.setPosition(P.x, hy).setVisible(jugando);
    sync(s, P.hd, P.h);
    if (!jugando) continue;
    if (P.h && P.h.st === 2 && Math.random() < dt * 5) humo(s, P.x + (Math.random() - 0.5) * 16, hy - 16, 0x3a3636);
    const px = (q) => X - w + (P.fl ? w - 2 - q : q) * 2;
    // curado: mejillas rojas y burbujitas
    if (cu && !back) for (const [mx, my] of MEJ[P.i]) fx.fillStyle([0, 0xff7070, 0xff3838, 0xe81010][cu], 0.9).fillRect(px(mx), top + my * 2, 4, 4);
    if (cu > 1) for (let k = 0; k < 3; k++) {
      const q = (t / 900 + k / 3) % 1;
      fx.lineStyle(2, 0xffffff, 1 - q).strokeCircle(P.x + 20 + Math.sin(q * 6 + k) * 4, top + 6 - q * 24, 2 + q * 3);
    }
    // sombra de contacto + anillo del jugador (brillante si es el que manejas)
    b.fillStyle(0x000000, 0.35).fillEllipse(P.x, P.y + 13, 46, 15);
    if (act) {
      if (s.modo === 1) b.lineStyle(3, P.col, 0.3 + 0.4 * Math.sin(t / 110)).strokeEllipse(P.x, P.y + 13, 60, 24);
      b.lineStyle(5, P.col, 1).strokeEllipse(P.x, P.y + 13, 46, 16);
      const T = objetivo(s, P);
      if (T) {
        b.lineStyle(3, P.col, 0.55 + 0.45 * Math.sin(t / 120)).strokeRoundedRect(T.x - 22, T.y - 22, 44, 36, 5);
        const ax = P.x + P.fx * 28, ay = P.y + 6 + P.fy * 22;
        b.fillStyle(P.col, 1).fillTriangle(ax - P.fy * 6, ay - P.fx * 6, ax + P.fy * 6, ay + P.fx * 6, ax + P.fx * 8, ay + P.fy * 8);
      }
      if (s.modo === 1) {
        const ay = (P.h ? hy - 24 : top - 2) + Math.sin(t / 120) * 3;
        fx.fillStyle(0x1a1020, 1).fillTriangle(P.x - 12, ay - 14, P.x + 12, ay - 14, P.x, ay + 3);
        fx.fillStyle(P.col, 1).fillTriangle(P.x - 8, ay - 12, P.x + 8, ay - 12, P.x, ay - 2);
      }
    } else {
      b.lineStyle(2, P.col, 0.45).strokeEllipse(P.x, P.y + 13, 46, 16);
      // tentacion: "!" y copa cuando se esta por ir (o ya va) al barril
      if (P.ign > g.th - 3 && (P.ign > g.th || Math.sin(t / 90) > 0)) {
        const ix = P.x + 24, iy = top + 6;
        fx.fillStyle(0x1a1020, 1).fillCircle(ix, iy, 12);
        fx.fillStyle(0xe8262a, 1).fillCircle(ix, iy, 10);
        fx.fillStyle(0xffffff, 1).fillRect(ix - 1.5, iy - 7, 3, 9).fillRect(ix - 1.5, iy + 4, 3, 3);
        copa(fx, ix + 20, iy);
      }
    }
  }
  // compadre: camina meneandose con la botella
  const C = s.cp;
  if (C.on) s.cpS.setPosition(C.x, C.y + 18 - Math.abs(Math.sin(t / 110)) * 3).setAngle(Math.sin(t / 130) * 8).setFlipX(!!C.fl).setDepth(10 + C.y / 1000);
  s.cpS.setVisible(jugando);
  if (C.on && jugando) b.fillStyle(0x000000, 0.35).fillEllipse(C.x, C.y + 16, 44, 12);
  // tickets y HUD
  if (g) {
    g.tk.forEach((tk, i) => {
      tk.c.x += (6 + i * 112 - tk.c.x) * 0.2;
      const f = tk.t / tk.T;
      tk.c.angle = f < 0.25 ? Math.sin(t / 40) * 2 : 0;
      if (jugando) barra(s.fxT, tk.c.x + 8, tk.c.y + 80, 88, f, colorTiempo(f));
    });
    const left = Math.max(0, Math.ceil(RONDA - g.el));
    s.hudT.setText(Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'));
    const tc = left <= 10 && Math.sin(t / 100) > 0 ? '#ff4d4d' : left <= 30 ? '#ffb627' : '#ffffff';
    if (s.hudT.style.color !== tc) s.hudT.setColor(tc);
    s.hudSc.setText(String(g.sc));
    if (jugando) {
      barra(s.fxT, 600, 47, 182, 1 - g.el / RONDA, colorTiempo(1 - g.el / RONDA));
      // retrato (cabeza del sprite, se pone colorada) + copa y 4 segmentos que se llenan de vino
      s.pl.forEach((P, i) => {
        const X = 596 + i * 100, F = s.fxT, n = [0, 1, 2, 4][P.cu];
        s.ret[i].setTint([0xffffff, 0xffffff, 0xffe0d8, 0xffc0b0][P.cu]);
        if (P.cu) for (const [mx, my] of MEJ[i]) F.fillStyle([0, 0xff7070, 0xff3838, 0xe81010][P.cu], 0.9).fillRect(X - 2 + (mx - (i ? 4 : 6)) * 2, 60 + (my - (i ? 2 : 5)) * 2, 4, 4);
        F.lineStyle(s.modo === 1 && P.k ? 4 : 3, P.col, 1).strokeRoundedRect(X - 2, 60, 36, 34, 5).strokeRoundedRect(X + 49, 64, 46, 26, 4);
        copa(F, X + 42, 77);
        for (let k = 0; k < 4; k++) {
          F.fillStyle(k < n ? 0xc0203a : 0x3c3650, 1).fillRect(X + 52 + k * 11, 67, 8, 20);
          F.fillStyle(k < n ? 0xff6a86 : 0x50496a, 1).fillRect(X + 52 + k * 11, 67, 8, 3);
        }
      });
    }
    s.hud.setVisible(jugando);
  }
}

function humo(s, x, y, col) {
  const c = s.add.rectangle(x, y, 6, 6, col, 0.75).setDepth(28);
  s.tweens.add({ targets: c, y: y - 40, x: x + (Math.random() - 0.5) * 16, scale: 2.6, alpha: 0, duration: 1000, onComplete: () => c.destroy() });
}

function polvo(s, x, y) {
  const c = s.add.circle(x, y, 3, 0xf0dcc0, 0.7).setDepth(9);
  s.tweens.add({ targets: c, y: y - 6, scale: 2.2, alpha: 0, duration: 380, onComplete: () => c.destroy() });
}

// textos flotantes; los de error van sobre placa oscura para que se lean
function pop(s, x, y, txt, col, sz, bad) {
  const t = s.add.text(x, y, txt, TXT(sz || 14, col, bad ? { backgroundColor: '#2a1020', padding: { x: 6, y: 3 } } : { stroke: '#1a0f08', strokeThickness: 5 })).setOrigin(0.5).setDepth(45);
  t.x = Phaser.Math.Clamp(x, t.width / 2 + 4, W - t.width / 2 - 4);
  t.y = Math.max(y, 112);
  s.tweens.add({ targets: t, y: t.y - 32, alpha: 0, delay: 600, duration: 700, onComplete: () => t.destroy() });
}

// avisos: cola (uno a la vez, nunca superpuestos) sobre placa oscura, arriba del centro
function aviso(s, txt, col) {
  if (!s.avQ.some((q) => q[0] === txt)) s.avQ.push([txt, col]);
}

function avisos(s, dt) {
  const a = s.av;
  if ((s.avT -= dt) > 0 || !s.avQ.length) return;
  const [txt, col] = s.avQ.shift();
  s.avT = 1.6;
  s.avTx.setText(txt).setColor(col);
  const w = s.avTx.width + 28;
  s.avG.clear();
  caja(s.avG, -w / 2, -21, w, 42, 0x120c1c, 0x000000, 8, 3, 0.92).lineStyle(2, Phaser.Display.Color.HexStringToColor(col).color, 1).strokeRoundedRect(-w / 2 + 4, -17, w - 8, 34, 6);
  s.tweens.killTweensOf(a);
  a.setScale(0.6).setAlpha(1);
  s.tweens.add({ targets: a, scale: 1, duration: 200, ease: 'Back.easeOut' });
  s.tweens.add({ targets: a, alpha: 0, delay: 1300, duration: 280 });
}

// ===== HUD Y PANTALLAS =====
const F2 = '"Arial Black",Impact,sans-serif';
// texto nitido: resolucion 2 y contorno oscuro grueso
const TXT = (sz, col, extra) => ({ fontFamily: 'monospace', fontSize: sz + 'px', color: col, fontStyle: 'bold', resolution: 2, stroke: '#0c0810', strokeThickness: sz > 15 ? 4 : 2, ...extra });

function crearHud(s) {
  const c = s.add.container(0, 0).setDepth(41);
  const g = s.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(592, 7, 204, 94, 9);
  caja(g, 588, 3, 206, 94, 0x1b2448, 0xe8dcc0, 9, 3);
  g.fillStyle(0x34406a, 1).fillRect(700, 10, 2, 30).fillRect(596, 59, 190, 1);
  g.fillStyle(0xf4e6c8, 1).fillRoundedRect(594, 60, 36, 34, 5).fillRoundedRect(694, 60, 36, 34, 5);
  // cronometro
  g.fillStyle(0xe8dcc0, 1).fillRect(605, 7, 6, 4).fillRect(616, 11, 4, 3);
  g.fillStyle(0x0a1028, 1).fillCircle(608, 25, 12);
  g.fillStyle(0xf6f0e2, 1).fillCircle(608, 25, 10);
  g.lineStyle(2, 0x1b2448, 1).lineBetween(608, 25, 608, 18).lineBetween(608, 25, 613, 27);
  s.hudT = s.add.text(624, 25, '3:00', TXT(26, '#ffffff', { fontFamily: F2, stroke: '#0a1028', strokeThickness: 4 })).setOrigin(0, 0.5);
  const p = s.add.text(746, 12, 'PUNTOS', TXT(10, '#c8d0f0')).setOrigin(0.5);
  s.hudSc = s.add.text(746, 30, '0', TXT(22, '#ffe066', { fontFamily: F2, stroke: '#0a1028', strokeThickness: 4 })).setOrigin(0.5);
  s.ret = [0, 1].map((i) => s.add.image(594 + i * 100, 60, 'at', 'h' + 'ab'[i]).setOrigin(0).setScale(2));
  c.add([g, s.hudT, p, s.hudSc, ...s.ret]);
  s.hud = c.setVisible(false);
  s.avG = s.add.graphics();
  s.avTx = s.add.text(0, 0, '', TXT(22, '#fff', { fontFamily: F2, strokeThickness: 5 })).setOrigin(0.5);
  s.av = s.add.container(W / 2, 214, [s.avG, s.avTx]).setDepth(50).setAlpha(0);
  s.avQ = [];
  s.avT = 0;
}

function overlay(s, d, a) {
  const c = s.add.container(0, 0).setDepth(d);
  c.add(s.add.rectangle(0, 0, W, H, 0x0c0a18, a).setOrigin(0));
  return c;
}

// letrero azul con estrellas
function letrero(s, c, y, w, txt, sz) {
  const g = s.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(W / 2 - w / 2 + 5, y + 6, w, sz * 1.9, 12);
  caja(g, W / 2 - w / 2, y, w, sz * 1.9, 0x1d2c66, 0xe8b84a, 12, 4);
  g.lineStyle(3, 0x0c1230, 1).strokeRoundedRect(W / 2 - w / 2 - 4, y - 4, w + 8, sz * 1.9 + 8, 14);
  estrella(g, W / 2 - w / 2 + sz * 0.7, y + sz * 0.95, sz * 0.35, 0xffd24a);
  estrella(g, W / 2 + w / 2 - sz * 0.7, y + sz * 0.95, sz * 0.35, 0xffd24a);
  const t = s.add.text(W / 2, y + sz * 0.95, txt, TXT(sz, '#fff4d6', { fontFamily: F2, stroke: '#a01c22', strokeThickness: Math.round(sz / 6) })).setOrigin(0.5);
  c.add([g, t]);
  return t;
}

function crearTitulo(s) {
  const c = overlay(s, 60, 0.8);
  const t = letrero(s, c, 14, 440, 'LA FONDA', 50);
  s.tweens.add({ targets: t, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  c.add(s.add.text(W / 2, 128, "¡Anticuchos y choripanes pa'l Dieciocho!", TXT(19, '#ffe066', { stroke: '#1a0f08', strokeThickness: 6 })).setOrigin(0.5));
  const g = s.add.graphics();
  caja(g, 16, 148, 486, 302, 0x140e20, 0xe8dcc0, 10, 2);
  caja(g, 512, 148, 272, 302, 0x140e20, 0xe8dcc0, 10, 2);
  c.add(g);
  c.add(s.add.text(259, 166, 'CÓMO SE JUEGA · RONDA DE 3 MIN', TXT(14, '#ffd24a')).setOrigin(0.5));
  // 4 lineas con iconos del atlas
  const IC = [
    [{ k: 'a', m: 1, p: 1, o: 1, st: 1 }, 'ANTICUCHO', 'palito + carne cortada (+ pedido) -> PARRILLA'],
    [{ k: 'c', e: 1 }, 'CHORIPÁN', 'chorizo asado -> al PAN (+ PEBRE)'],
    [{ k: 'm' }, 'B1 TOMA · B2 CORTA EN LA TABLA', 'arma en el mesón, todo a la ENTREGA'],
    [0, '¡OJO CON EL COMPADRE!', 'cada sorbo cura · lo quemado se hace humo'],
  ];
  IC.forEach(([it, h, d], i) => {
    const y = 210 + i * 58, ic = s.add.container(56, y);
    if (it) sync(s, ic, it); else ic.add(s.add.image(0, 4, 'pq').setScale(0.7));
    c.add([ic, s.add.text(96, y - 20, h, TXT(16, '#ffe066')), s.add.text(96, y + 2, d, TXT(14, '#ffffff'))]);
  });
  c.add(s.add.text(259, 438, '1 JUGADOR: el otro chef ayuda solo · B3 cambia · START pausa', TXT(12, '#b8c4f0')).setOrigin(0.5));
  s.topHdr = s.add.text(648, 168, '', TXT(14, '#ffd24a')).setOrigin(0.5);
  s.topTitulo = s.add.text(648, 192, '', TXT(18, '#ffffff', { lineSpacing: 12 })).setOrigin(0.5, 0);
  c.add([s.topHdr, s.topTitulo]);
  c.add(s.add.image(600, 410, 'at', 'ch').setScale(2));
  const an = s.add.container(700, 410).setScale(1.2);
  sync(s, an, { k: 'a', m: 1, p: 1, o: 1, st: 1 });
  c.add(an);
  // selector de modo
  s.sel = [1, 2].map((m) => {
    const sg = s.add.graphics(), st = s.add.text(m === 1 ? 270 : 530, 482, m === 1 ? '1 JUGADOR' : '2 JUGADORES', TXT(20, '#fff', { fontFamily: F2 })).setOrigin(0.5);
    c.add([sg, st]);
    return [sg, st];
  });
  dibSel(s);
  // chefs del atlas grandes (x3) a los costados, enteros
  s.chefsT = [0, 1].map((i) => {
    const x = i ? 742 : 58, col = i ? 0x3b82f6 : 0xef4444;
    const r = s.add.graphics();
    r.fillStyle(0x000000, 0.4).fillEllipse(x, 566, 70, 18);
    r.lineStyle(5, col, 1).strokeEllipse(x, 566, 70, 20);
    const im = s.add.image(x, 568, 'at', 'ab'[i] + 0).setOrigin(0.5, 1).setScale(3).setFlipX(i === 1);
    c.add([r, im]);
    placa(s, c, x, 588, i ? 'FONDERO' : 'FONDERA', i ? '#93c5fd' : '#fca5a5', 13);
    return im;
  });
  const pg = caja(s.add.graphics(), 210, 518, 380, 58, 0xc8282c, 0xfff0c0, 10, 4);
  pg.lineStyle(3, 0x3a0c10, 1).strokeRoundedRect(206, 514, 388, 66, 12);
  s.tituloBlink = s.add.text(W / 2, 547, 'PRESIONA START', TXT(34, '#ffe066', { fontFamily: F2, stroke: '#2a0608', strokeThickness: 7 })).setOrigin(0.5);
  c.add([pg, s.tituloBlink]);
  s.titulo = c;
  s.lbl.setVisible(false);
}

function dibSel(s) {
  s.sel.forEach(([g, t], j) => {
    const on = s.modo === j + 1, x = j ? 530 : 270;
    g.clear();
    caja(g, x - 118, 460, 236, 44, on ? 0xffd23a : 0x1d2c66, on ? 0xd8262a : 0xc8d4ff, 8, on ? 4 : 2);
    if (on) {
      g.fillStyle(0xd8262a, 1).fillTriangle(x - 108, 472, x - 108, 492, x - 96, 482).fillTriangle(x + 108, 472, x + 108, 492, x + 96, 482);
    }
    t.setColor(on ? '#2a1610' : '#ffffff').setStroke(on ? '#ffd23a' : '#0c0810', on ? 0 : 3);
  });
}

function crearPausa(s) {
  const c = overlay(s, 70, 0.6);
  const g = caja(s.add.graphics(), 240, 220, 320, 150, 0x120c1c, 0xe8dcc0, 12, 3);
  c.add([g, s.add.text(W / 2, 275, 'PAUSA', TXT(52, '#ffe066', { fontFamily: F2, stroke: '#1a0f08', strokeThickness: 8 })).setOrigin(0.5)]);
  c.add(s.add.text(W / 2, 335, 'START para seguir', TXT(16, '#ffffff')).setOrigin(0.5));
  s.pausa = c.setVisible(false);
}

function crearFin(s) {
  const c = overlay(s, 65, 0.85);
  letrero(s, c, 14, 520, '¡SE ACABÓ LA FONDA!', 30);
  c.add(s.add.text(W / 2, 92, 'PUNTOS', TXT(13, '#c8d0f0')).setOrigin(0.5));
  s.finSc = s.add.text(W / 2, 126, '', TXT(48, '#ffe066', { fontFamily: F2, stroke: '#1a0f08', strokeThickness: 8 })).setOrigin(0.5);
  s.finStats = s.add.text(W / 2, 166, '', TXT(14, '#f6f1e4')).setOrigin(0.5);
  const g = s.add.graphics();
  caja(g, 160, 184, 480, 214, 0x120c1c, 0xe8dcc0, 10, 2);
  caja(g, 250, 404, 300, 150, 0x120c1c, 0xe8dcc0, 10, 2);
  c.add(g);
  s.finNameLbl = s.add.text(W / 2, 200, '', TXT(12, '#ffd24a')).setOrigin(0.5);
  s.finName = s.add.text(W / 2, 228, '_ _ _', TXT(34, '#7dd3fc', { stroke: '#0a1028', strokeThickness: 5 })).setOrigin(0.5);
  c.add([s.finSc, s.finStats, s.finNameLbl, s.finName]);
  s.grid = [];
  LETTER_GRID.forEach((rowV, row) => {
    const sp = rowV.length > 2 ? 54 : 120, rw = rowV.length * sp;
    rowV.forEach((v, col) => {
      const x = W / 2 - rw / 2 + sp / 2 + col * sp, y = 268 + row * 28;
      const cell = s.add.rectangle(x, y, v.length > 1 ? 104 : 44, 24, 0xf6ecd0).setStrokeStyle(2, 0x3a2416);
      const lb = s.add.text(x, y, v, TXT(v.length > 1 ? 14 : 18, '#2a1610', { strokeThickness: 0 })).setOrigin(0.5);
      c.add([cell, lb]);
      s.grid.push({ cell, lb, row, col });
    });
  });
  s.topFinHdr = s.add.text(W / 2, 420, '', TXT(14, '#ffd24a')).setOrigin(0.5);
  s.topFin = s.add.text(W / 2, 436, '', TXT(15, '#ffffff', { lineSpacing: 2 })).setOrigin(0.5, 0);
  s.finStatus = s.add.text(W / 2, 576, '', TXT(14, '#c8f5a8', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5);
  c.add([s.topFinHdr, s.topFin, s.finStatus]);
  s.fin = c.setVisible(false);
}

function refrescarTop(s) {
  const l = [], hs = s.hs[s.modo];
  for (let i = 0; i < MAX_HIGH_SCORES; i++) {
    const e = hs[i];
    l.push((i + 1) + '. ' + (e ? e.name.padEnd(3, ' ') + '  ' + String(e.score).padStart(4, ' ') : '---  ----'));
  }
  const hd = 'TOP 5 · ' + (s.modo === 1 ? '1 JUGADOR' : '2 JUGADORES');
  s.topHdr.setText(hd);
  s.topFinHdr.setText(hd);
  s.topTitulo.setText(l.join('\n'));
  s.topFin.setText(l.join('\n'));
}

// ===== NOMBRE / TOP 5 (logica del starter) =====
function nombreInput(s, time) {
  const h = s.controls.held, q = s.controls.pressed, e = s.ne;
  const c = {};
  for (const k of ['P1_R', 'P2_R', 'P1_L', 'P2_L', 'P1_D', 'P2_D', 'P1_U', 'P2_U']) c[k] = h[k] || q[k];
  const ax = ((c.P1_R || c.P2_R) ? 1 : 0) - ((c.P1_L || c.P2_L) ? 1 : 0);
  const ay = ((c.P1_D || c.P2_D) ? 1 : 0) - ((c.P1_U || c.P2_U) ? 1 : 0);
  const v = ax + ',' + ay;
  if (time >= e.cd && (ax || ay) && e.last !== v) {
    if (ay) {
      e.row = Phaser.Math.Wrap(e.row + ay, 0, LETTER_GRID.length);
      e.col = Math.min(e.col, LETTER_GRID[e.row].length - 1);
    }
    if (ax) e.col = Phaser.Math.Wrap(e.col + ax, 0, LETTER_GRID[e.row].length);
    e.cd = time + 160;
    marcarLetra(s);
    snd(s, 'click');
  }
  e.last = v;
  if (consume(s, ['P1_1', 'P2_1', 'START1', 'START2'])) {
    const val = LETTER_GRID[e.row][e.col];
    snd(s, 'select');
    if (val === 'BORRAR') e.letters.pop();
    else if (val === 'LISTO') {
      if (!e.letters.length) { s.finStatus.setText('Elijan al menos una letra'); return; }
      return guardar(s);
    } else {
      if (e.letters.length >= NAME_LEN) e.letters.shift();
      e.letters.push(val);
    }
    refrescarNombre(s);
  }
  if (consume(s, ['P1_2', 'P2_2'])) { e.letters.pop(); refrescarNombre(s); }
}

function marcarLetra(s) {
  for (const it of s.grid) {
    const a = it.row === s.ne.row && it.col === s.ne.col;
    it.cell.setFillStyle(a ? 0xffd23a : 0xf6ecd0).setStrokeStyle(a ? 4 : 2, a ? 0xd8262a : 0x3a2416);
  }
}

function refrescarNombre(s) {
  const l = s.ne.letters.slice();
  while (l.length < NAME_LEN) l.push('_');
  s.finName.setText(l.join(' '));
}

function guardar(s) {
  const name = s.ne.letters.join('').slice(0, NAME_LEN) || '???', m = s.modo;
  const entry = { name, score: s.g.sc, m, detail: s.g.ok + '/' + s.g.venc + '/' + s.g.quem, savedAt: new Date().toISOString().slice(0, 10) };
  s.ph = 'saved';
  s.finStatus.setText('¡Guardado ' + name + '! START para volver a la fonda');
  persistHighScore(entry, KEYS[m])
    .then((hs) => { s.hs[m] = hs; refrescarTop(s); })
    .catch(() => {
      s.hs[m] = s.hs[m].concat(entry).sort((a, b) => b.score - a.score).slice(0, MAX_HIGH_SCORES);
      refrescarTop(s);
      s.finStatus.setText('No se pudo guardar, pero la fonda sigue. START');
    });
}

async function persistHighScore(entry, key) {
  const ex = await loadHighScores(key);
  const next = ex.concat(entry).sort((a, b) => (b.score !== a.score ? b.score - a.score : a.savedAt < b.savedAt ? 1 : -1)).slice(0, MAX_HIGH_SCORES);
  await getStorage().set(key, next);
  return next;
}

async function loadHighScores(key) {
  const r = await getStorage().get(key);
  if (!r || !r.found || !Array.isArray(r.value)) return [];
  return r.value.filter((v) => v && typeof v.name === 'string' && typeof v.score === 'number' && typeof v.savedAt === 'string').slice(0, MAX_HIGH_SCORES);
}

function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? { found: false, value: null } : { found: true, value: JSON.parse(raw) };
      } catch {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

// ===== INPUT (del starter) =====
function createControls(s) {
  s.controls = { held: Object.create(null), pressed: Object.create(null) };
  const down = (ev) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(ev.key)];
    if (!code) return;
    if (!s.controls.held[code]) s.controls.pressed[code] = true;
    s.controls.held[code] = true;
  };
  const up = (ev) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(ev.key)];
    if (code) s.controls.held[code] = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  s.events.once('shutdown', () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  });
}

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) return '';
  if (key === ' ') return 'space';
  return key.toLowerCase();
}

function consume(s, codes) {
  for (const c of codes) {
    if (s.controls.pressed[c]) {
      s.controls.pressed[c] = false;
      return true;
    }
  }
  return false;
}

// ===== SONIDO (Web Audio) =====
const SQ = 'square', TRI = 'triangle';
// ty: tipo de onda o PeriodicWave; dl: retraso en s; out: nodo destino (musica)
function tono(ctx, f, f2, d, ty, v, dl, out) {
  const n = ctx.currentTime + (dl || 0);
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (ty.at) o.type = ty; else o.setPeriodicWave(ty);
  o.frequency.setValueAtTime(f, n);
  o.frequency.exponentialRampToValueAtTime(f2 || f, n + d);
  g.gain.setValueAtTime(v, n);
  g.gain.exponentialRampToValueAtTime(0.001, n + d);
  o.connect(g);
  g.connect(out || ctx.destination);
  o.start(n);
  o.stop(n + d + 0.02);
  return o;
}

function ruido(s, ctx, d, v, fq, dl, out) {
  if (!s.nb) {
    s.nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const a = s.nb.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = s.nb;
  fl.type = 'bandpass';
  fl.frequency.value = fq;
  const n = ctx.currentTime + (dl || 0);
  g.gain.setValueAtTime(v, n);
  g.gain.exponentialRampToValueAtTime(0.001, n + d);
  src.connect(fl);
  fl.connect(g);
  g.connect(out || ctx.destination);
  src.start(n, Math.random() * 0.5);
  src.stop(n + d);
}

function snd(s, ty) {
  try {
    const c = s.sound.context;
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const T = (f, f2, d, w, v, dl) => tono(c, f, f2, d, w, v, dl);
    if (ty === 'pick') T(500, 800, 0.07, SQ, 0.08);
    else if (ty === 'drop') T(600, 350, 0.07, SQ, 0.07);
    else if (ty === 'arma') { T(520, 0, 0.06, SQ, 0.08); T(780, 0, 0.08, SQ, 0.08, 0.06); }
    else if (ty === 'chop') { ruido(s, c, 0.05, 0.25, 2500); T(180, 90, 0.04, SQ, 0.06); }
    else if (ty === 'cortado') T(660, 990, 0.12, TRI, 0.15);
    else if (ty === 'sizzle') ruido(s, c, 0.35, 0.05, 6000);
    else if (ty === 'listo') { T(880, 0, 0.08, TRI, 0.15); T(1175, 0, 0.12, TRI, 0.15, 0.09); }
    else if (ty === 'alarma') T(1400, 0, 0.08, SQ, 0.06);
    else if (ty === 'quema') { T(300, 60, 0.5, 'sawtooth', 0.15); ruido(s, c, 0.5, 0.15, 800); }
    else if (ty === 'puf') { ruido(s, c, 0.45, 0.25, 500); T(220, 70, 0.4, TRI, 0.12); }
    else if (ty === 'ok') [523, 659, 784, 1047].forEach((f, i) => T(f, 0, 0.12, TRI, 0.16, i * 0.07));
    else if (ty === 'err') T(200, 110, 0.22, 'sawtooth', 0.1);
    else if (ty === 'ticket') { T(1568, 0, 0.05, 'sine', 0.1); T(2093, 0, 0.08, 'sine', 0.1, 0.06); }
    else if (ty === 'tick') T(1000, 0, 0.05, SQ, 0.07);
    else if (ty === 'click') T(1200, 600, 0.04, SQ, 0.06);
    else if (ty === 'select') T(700, 1400, 0.1, SQ, 0.1);
    else if (ty === 'glu') [0, 1, 2, 3].forEach((i) => T(240 + i * 30, 480 + i * 40, 0.07, 'sine', 0.18, i * 0.1));
    else if (ty === 'compadre') { T(900, 1400, 0.12, 'sine', 0.1); T(900, 600, 0.15, 'sine', 0.1, 0.14); }
    else if (ty === 'fin') [784, 659, 523, 392, 523].forEach((f, i) => T(f, 0, 0.18, TRI, 0.15, i * 0.14));
  } catch (_) {}
}

// ===== MZICA: cumbia chiptune a 112 BPM en do menor (estilo "Mujeres y cerveza") =====
// Cada seccion: [melodia, acordes]. Melodia en pares de chars: nota (codigo = midi, ' ' = silencio)
// y duracion en semicorcheas (codigo - 48). Acordes: un char por compas, raiz del bajo = codigo - 24
// (A=Fa, D=Lab, F=Sib, H=Do). Orden: intro una vez, luego 1, 1', 2, 2' en loop.
const M1 = 'R1R1R2R1P3J1J1J2J1M1P2R1R1R3R1M2J1J1M2P2V2T1T3O3O3O2O2R2R1R3R4J2J1M1J1M1P2R1R4R1M2J1J3V2V3T3O4O6O1O1';
const M2 = 'M2O2O4K2J2M2K2J1H3H4H7O1M2K4O4J2K1J3H4H4H:W4[4J2M1J1K3H7H4H6W2[3K1J2J2M1J1H2[8H2H6';
const MZ = [
  ['R4T4 8R4T4 8R4T4 8R4T2T2T2T2 4', 'FHFH'],
  [M1, 'FFHFFH'],
  [M2, 'FHFHDHAH'],
  // variaciones (segunda pasada): remate a do agudo y relleno sol-fa en la nota larga
  [M1.replace('O2O2R2', 'O2O2T2').replace('O6O1', 'O4T2O1'), 'FFHFFH'],
  [M2.replace('H:', 'H6O2M2').replace('H2H6', 'H2T6'), 'FHFHDHAH'],
].map(([m, a]) => {
  const n = [];
  for (let i = 0, p = 0; i < m.length; i += 2) p += (n[p] = [m.charCodeAt(i), m.charCodeAt(i + 1) - 48])[1];
  return [n, a];
});
const HZ = (m) => 440 * 2 ** ((m - 69) / 12);

// Estado del secuenciador sobre un AudioContext (sirve igual para un OfflineAudioContext)
function mIni(c, out) {
  const M = { c, q: 0, k: 0, t: 0, g: c.createGain(), l: c.createOscillator(), v: c.createGain() };
  const R = new Float32Array(16).map((_, n) => n && Math.sin(n * 0.785) / n); // pulso 25%
  M.w = c.createPeriodicWave(R, R.map(() => 0));
  M.l.connect(M.v); // vibrato compartido por todas las notas de la melodia
  M.l.start();
  M.g.connect(out);
  return M;
}

// Programa semicorcheas hasta el tiempo 'hasta'. mel: con melodia; cu: algun chef muy curado
function mTick(s, M, hasta, mel, bpm, cu) {
  const c = M.c, u = 15 / bpm;
  if (M.t < c.currentTime) M.t = c.currentTime + 0.05;
  M.v.gain.value = cu ? 45 : 7;
  M.l.frequency.value = cu ? 1.7 : 5.5;
  while (M.t < hasta) {
    const [n, a] = MZ[M.q], k = M.k, q = k % 16, r = a.charCodeAt(k >> 4) - 24, dl = M.t - c.currentTime, b = [0, , , , , , 0, , 7, , , , 12][q];
    // guacharaca: chiiik-chi-chi por tiempo, acento en el contratiempo
    ruido(s, c, q % 4 ? 0.04 : 0.11, q % 4 == 2 ? 0.5 : 0.22, 7000, dl, M.g);
    // timbal en el 4
    if (q > 11 && q % 2 == 0) tono(c, 330, 150, 0.09, 'sine', q > 12 ? 0.3 : 0.2, dl, M.g);
    // bajo saltado: tonica en 1 (y anticipada), quinta en 3, octava en 4
    if (b > -1) tono(c, HZ(r + b), 0, u * 3, TRI, 0.55, dl, M.g);
    if (mel && n[k] && n[k][0] > 40) M.v.connect(tono(c, HZ(n[k][0]), 0, Math.min(n[k][1] * u, 1.2), M.w, 0.11, dl, M.g).detune);
    M.t += u;
    if (++M.k >= a.length * 16) M.k = 0, M.q = M.q % 4 + 1;
  }
}

// Llamado cada cuadro: partida = todo; titulo = solo base suave; pausa y fin = silencio
function musica(s) {
  try {
    const c = s.sound.context;
    if (!c || c.state != 'running') return;
    const M = s.M || (s.M = mIni(c, c.destination)), p = s.ph == 'play', ti = s.ph == 'title';
    M.g.gain.setTargetAtTime(p ? 0.3 : ti ? 0.12 : 0, c.currentTime, 0.03);
    if (p || ti) mTick(s, M, c.currentTime + 0.3, p, 115 + (p ? Math.max(0, s.g.el - RONDA + 30) * 0.4 : 0), p && s.pl.some((P) => P.cu > 2));
  } catch (_) {}
}
