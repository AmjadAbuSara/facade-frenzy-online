import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("client/dist"));

const PORT = process.env.PORT || 3000;
const W = 800, H = 600;
const TOTAL_ROUNDS = 5;
const NUM_BOTS = 30;
const SPEED = 5.0;
const TICK_MS = 1000 / 30;
const MIRROR_SIZE = 90;

interface Mode { id: string; name: string; }
interface Spotlight { cx: number; cy: number; radius: number; angle: number; speed: number; orbitRadius: number; x: number; y: number; }
interface SnowPatch { x: number; y: number; w: number; h: number; }
interface Wall { x: number; y: number; w: number; h: number; }
interface Checkpoint { x: number; y: number; w: number; h: number; flashTimer: number; flashColor: string; }
interface Belt { x: number; y: number; w: number; h: number; dirX: number; dirY: number; speed: number; }
interface GameMap { name: string; bg: string; hasTop: boolean; hasBottom: boolean; isDisco?: boolean; isSnow?: boolean; isDark?: boolean; spotlights?: Spotlight[]; snowPatches?: SnowPatch[]; walls?: Wall[]; checkpoints?: Checkpoint[]; belts?: Belt[]; }
interface PlayerInfo { id: number; name: string; socketId: string; }
interface Coin { x: number; y: number; }
interface Footprint { x: number; y: number; timer: number; isPlayer: boolean; }
interface Announcement { round: number; modeName: string; mapName: string; }
interface PlayerInput { up?: boolean; down?: boolean; left?: boolean; right?: boolean; punch?: boolean; }

const MODES: Mode[] = [
  { id: "classic", name: "\u2694\uFE0F \u0642\u062A\u0627\u0644 \u0643\u0644\u0627\u0633\u064A\u0643\u064A (\u0627\u063A\u062A\u0644 \u0623\u064A \u062E\u0635\u0645)" },
  { id: "coin", name: "\U0001F4B0 \u062C\u0645\u0639 \u0627\u0644\u0639\u0645\u0644\u0627\u062A (\u0627\u062C\u0645\u0639 3 \u0639\u0645\u0644\u0627\u062A \u0644\u0644\u0641\u0648\u0632)" },
  { id: "survival", name: "\u23F1\uFE0F \u0627\u0644\u0646\u062C\u0627\u0629 (P1 \u064A\u0635\u0637\u0627\u062F \u0627\u0644\u0628\u0642\u064A\u0629!)" }
];

const MAPS: GameMap[] = [
  { name: "\u0627\u0644\u0642\u0627\u0639\u0629 \u0627\u0644\u0645\u0644\u0643\u064A\u0629 (\u0645\u0631\u0622\u0629 \u0639\u0644\u0648\u064A\u0629)", bg: "#cbd5e1", hasTop: true, hasBottom: false },
  { name: "\u0627\u0644\u063A\u0631\u0641\u0629 \u0627\u0644\u0645\u0639\u0643\u0648\u0633\u0629 (\u0645\u0631\u0622\u0629 \u0633\u0641\u0644\u064A\u0629)", bg: "#94a3b8", hasTop: false, hasBottom: true },
  { name: "\u0627\u0644\u0645\u0645\u0631 \u0627\u0644\u0645\u0632\u062F\u0648\u062C (\u0645\u0631\u0622\u062A\u064A\u0646)", bg: "#64748b", hasTop: true, hasBottom: true },
  { name: "\u0646\u0627\u062F\u064A \u0627\u0644\u062F\u064A\u0633\u0643\u0648", bg: "#1a1a2e", hasTop: false, hasBottom: false, isDisco: true,
    spotlights: [
      { cx: 200, cy: 150, radius: 100, angle: 0, speed: 0.02, orbitRadius: 80, x: 200, y: 150 },
      { cx: 500, cy: 300, radius: 120, angle: Math.PI, speed: 0.015, orbitRadius: 100, x: 500, y: 300 },
      { cx: 350, cy: 450, radius: 90, angle: Math.PI/2, speed: 0.025, orbitRadius: 60, x: 350, y: 450 },
      { cx: 650, cy: 200, radius: 110, angle: Math.PI*1.5, speed: 0.018, orbitRadius: 90, x: 650, y: 200 }
    ] },
  { name: "\u0627\u0644\u062D\u062F\u064A\u0642\u0629 \u0627\u0644\u062B\u0644\u062C\u064A\u0629", bg: "#d1d5db", hasTop: false, hasBottom: false, isSnow: true,
    snowPatches: [
      { x: 60, y: 50, w: 180, h: 140 }, { x: 480, y: 80, w: 260, h: 130 },
      { x: 100, y: 400, w: 280, h: 160 }, { x: 550, y: 380, w: 200, h: 180 }
    ] },
  { name: "\u0628\u0648\u0627\u0628\u0627\u062A \u0627\u0644\u062A\u0641\u062A\u064A\u0634", bg: "#2a2a2a", hasTop: false, hasBottom: false,
    walls: [
      { x: 0, y: 200, w: 250, h: 25 }, { x: 400, y: 200, w: 400, h: 25 },
      { x: 0, y: 400, w: 300, h: 25 }, { x: 500, y: 400, w: 300, h: 25 }
    ],
    checkpoints: [
      { x: 250, y: 195, w: 150, h: 30, flashTimer: 0, flashColor: "#00ff00" },
      { x: 300, y: 395, w: 200, h: 30, flashTimer: 0, flashColor: "#00ff00" }
    ] },
  { name: "\u0645\u0645\u0631\u0627\u062A \u0627\u0644\u0645\u0635\u0646\u0639", bg: "#4a4a4a", hasTop: false, hasBottom: false,
    belts: [
      { x: 0, y: 160, w: 800, h: 50, dirX: 1, dirY: 0, speed: 1.5 },
      { x: 0, y: 300, w: 800, h: 50, dirX: -1, dirY: 0, speed: 1.5 },
      { x: 0, y: 450, w: 800, h: 50, dirX: 1, dirY: 0, speed: 1.5 }
    ] },
  { name: "\u0627\u0644\u0642\u0628\u0648 \u0627\u0644\u0645\u0638\u0644\u0645", bg: "#000000", hasTop: false, hasBottom: false, isDark: true }
];

// Helpers
function isInsideWall(x: number, y: number, map: GameMap): boolean {
  if (!map.walls) return false;
  for (const w of map.walls) { if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true; }
  return false;
}
function isInSnowPatch(x: number, y: number, map: GameMap): boolean {
  if (!map.snowPatches) return false;
  for (const p of map.snowPatches) { if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true; }
  return false;
}
function isInsideSpotlight(x: number, y: number, map: GameMap): boolean {
  if (!map.spotlights) return false;
  for (const s of map.spotlights) { if (Math.hypot(x - s.x, y - s.y) < s.radius) return true; }
  return false;
}
function rand(min: number, max: number): number { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }

interface Room {
  id: number; type: 'local' | 'online';
  sockets: Set<string>;
  socketPlayerMap: Record<string, number | number[]>;
  nextLocalPlayer: number;
  inputBuffer: Record<number, PlayerInput>;
  phase: string;
  entities: Entity[];
  activePlayers: PlayerInfo[];
  scores: Record<number, number>;
  roundCoins: Record<number, number>;
  currentRound: number;
  currentMode: Mode | null;
  currentMap: GameMap | null;
  gameOver: boolean;
  coin: Coin | null;
  survivalTimer: number;
  footprints: Footprint[];
  frameCount: number;
  announcement: Announcement | null;
  message: string;
  winner: string | null;
  gameInterval: ReturnType<typeof setInterval> | null;
  announcementTimeout: ReturnType<typeof setTimeout> | null;
  endTimeout: ReturnType<typeof setTimeout> | null;
}

let rooms: Record<number, Room> = {};
let nextRoomId = 1;
let onlineLobby: { socket: string; name: string; id: number }[] = [];
let nextOnlineId = 1;

function createRoom(type: 'local' | 'online'): Room {
  const id = nextRoomId++;
  const room: Room = {
    id, type,
    sockets: new Set(),
    socketPlayerMap: {},
    nextLocalPlayer: 1,
    inputBuffer: {},
    phase: "lobby",
    entities: [],
    activePlayers: [],
    scores: {},
    roundCoins: {},
    currentRound: 1,
    currentMode: null,
    currentMap: null,
    gameOver: false,
    coin: null,
    survivalTimer: 0,
    footprints: [],
    frameCount: 0,
    announcement: null,
    message: "",
    winner: null,
    gameInterval: null,
    announcementTimeout: null,
    endTimeout: null
  };
  return room;
}

function destroyRoom(roomId: number) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.gameInterval) clearInterval(room.gameInterval);
  if (room.announcementTimeout) clearTimeout(room.announcementTimeout);
  if (room.endTimeout) clearTimeout(room.endTimeout);
  delete rooms[roomId];
}

function broadcastRoomState(room: Room) {
  const state = {
    roomId: room.id, phase: room.phase, roomType: room.type,
    entities: room.entities.filter(e => e !== null).map(e => e.toJSON()),
    activePlayers: room.activePlayers, scores: room.scores,
    roundCoins: room.roundCoins, currentRound: room.currentRound,
    currentMode: room.currentMode, currentMap: room.currentMap,
    coin: room.coin, survivalTimer: room.survivalTimer,
    footprints: room.footprints, gameOver: room.gameOver,
    message: room.message, announcement: room.announcement,
    winner: room.winner, frameCount: room.frameCount,
    totalRounds: TOTAL_ROUNDS,
    status: room.gameOver ? 'gameOver' : (room.phase === 'playing' ? 'playing' : room.phase)
  };
  for (const sid of room.sockets) {
    const sock = io.sockets.sockets.get(sid);
    if (sock) sock.emit("gameState", state);
  }
}

// Entity class
interface EntityJSON {
  index: number; isPlayer: boolean; playerNum: number; color: string;
  x: number; y: number; dirX: number; dirY: number;
  isPunching: boolean; punchTimer: number; dead: boolean; stunTimer: number;
}

class Entity {
  index: number;
  isPlayer: boolean;
  playerNum: number;
  color: string = "#334155";
  radius: number = 12;
  x: number;
  y: number;
  dirX: number = 0;
  dirY: number = 1;
  isPunching: boolean = false;
  punchTimer: number = 0;
  dead: boolean = false;
  stunTimer: number = 0;
  targetX: number;
  targetY: number;
  pauseTimer: number = 0;
  lastFootX: number;
  lastFootY: number;
  footDist: number = 0;

  constructor(isPlayer: boolean, playerNum: number, index: number) {
    this.index = index;
    this.isPlayer = isPlayer;
    this.playerNum = playerNum;
    this.x = Math.random() * (W - 40) + 20;
    this.y = Math.random() * (H - 40) + 20;
    this.targetX = this.x;
    this.targetY = this.y;
    this.lastFootX = this.x;
    this.lastFootY = this.y;
  }

  update(map: GameMap, mode: Mode, coin: Coin | null, room: Room) {
    if (this.dead || room.gameOver) return;
    if (this.stunTimer > 0) { this.stunTimer--; return; }

    let moveX = 0, moveY = 0;
    const minY = map.hasTop ? MIRROR_SIZE + 15 : 15;
    const maxY = map.hasBottom ? H - MIRROR_SIZE - 15 : H - 15;

    if (this.isPlayer) {
      const input = room.inputBuffer[this.playerNum] || {};
      moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (moveX !== 0 || moveY !== 0) {
        const len = Math.hypot(moveX, moveY);
        moveX = (moveX / len) * SPEED; moveY = (moveY / len) * SPEED;
      }
      if (input.punch && this.punchTimer <= 0 && !(mode.id === "survival" && this.playerNum !== 1)) {
        this.punch(map, mode, room);
      }
    } else {
      if (this.pauseTimer > 0) {
        this.pauseTimer--;
      } else {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < SPEED) {
          this.x = this.targetX;
          this.y = this.targetY;
          this.pauseTimer = Math.random() * 60 + 20;
          let attempts = 0;
          do {
            this.targetX = Math.random() * (W - 40) + 20;
            this.targetY = Math.random() * (H - 40) + 20;
            attempts++;
          } while (isInsideWall(this.targetX, this.targetY, map) && attempts < 10);
        } else {
          const norm = SPEED / dist;
          moveX = dx * norm;
          moveY = dy * norm;
          this.dirX = dx / dist;
          this.dirY = dy / dist;
        }
      }
    }

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.hypot(moveX, moveY);
      this.dirX = moveX / len; this.dirY = moveY / len;
    }

    let newX = this.x + moveX, newY = this.y + moveY;
    if (!isInsideWall(newX, newY, map)) { this.x = newX; this.y = newY; }
    else if (!isInsideWall(newX, this.y, map)) { this.x = newX; }
    else if (!isInsideWall(this.x, newY, map)) { this.y = newY; }

    if (map.belts) {
      for (const b of map.belts) {
        if (this.x >= b.x && this.x <= b.x + b.w && this.y >= b.y && this.y <= b.y + b.h) {
          const bx = this.x + b.dirX * b.speed, by = this.y + b.dirY * b.speed;
          if (!isInsideWall(bx, by, map)) { this.x = bx; this.y = by; }
        }
      }
    }

    this.x = Math.max(15, Math.min(W - 15, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));

    if (map.checkpoints) {
      for (const cp of map.checkpoints) {
        if (this.x > cp.x && this.x < cp.x + cp.w && this.y > cp.y && this.y < cp.y + cp.h) {
          cp.flashTimer = 20; cp.flashColor = this.isPlayer ? "#ff3333" : "#00ff00";
        }
      }
    }

    if (this.punchTimer > 0) { this.punchTimer--; if (this.punchTimer < 20) this.isPunching = false; }

    if (map.isSnow) {
      const d = Math.hypot(this.x - this.lastFootX, this.y - this.lastFootY);
      this.footDist += d;
      if (this.footDist > 8 && isInSnowPatch(this.x, this.y, map)) {
        room.footprints.push({ x: this.x, y: this.y, timer: 120, isPlayer: this.isPlayer });
        this.lastFootX = this.x; this.lastFootY = this.y; this.footDist = 0;
      }
    }

    if (mode.id === "coin" && this.isPlayer && coin !== null) {
      if (Math.hypot(coin.x - this.x, coin.y - this.y) < 20) {
        room.roundCoins[this.playerNum] = (room.roundCoins[this.playerNum] || 0) + 1;
        const pName = room.activePlayers.find(p => p.id === this.playerNum)?.name || `P${this.playerNum}`;
        if (room.roundCoins[this.playerNum] >= 3) {
          endRound(room, this.playerNum, `${pName} جمع 3 عملات أولاً!`);
        } else {
          room.coin = { x: Math.random() * (W - 60) + 30, y: Math.random() * (H - MIRROR_SIZE * 2) + MIRROR_SIZE };
        }
      }
    }
  }

  punch(map: GameMap, mode: Mode, room: Room) {
    this.isPunching = true;
    this.punchTimer = 35;
    const hitX = this.x + this.dirX * 30, hitY = this.y + this.dirY * 30;
    for (const other of room.entities) {
      if (other !== this && !other.dead) {
        if (Math.hypot(other.x - hitX, other.y - hitY) < 25) {
          if (other.isPlayer) {
            other.dead = true;
            const killerName = room.activePlayers.find(p => p.id === this.playerNum)?.name || `P${this.playerNum}`;
            if (mode.id === "survival") {
              if (this.playerNum === 1) {
                const targetsAlive = room.entities.filter(e => e.isPlayer && e.playerNum !== 1 && !e.dead).length;
                if (targetsAlive === 0) endRound(room, 1, `الصياد (${killerName}) قضى على الجميع!`);
              }
            } else if (mode.id !== "coin") {
              endRound(room, this.playerNum, `اغتيال ناجح بواسطة ${killerName}!`);
            }
          } else {
            other.stunTimer = 90; this.stunTimer = 90;
          }
        }
      }
    }
  }

  toJSON(): EntityJSON {
    return { index: this.index, isPlayer: this.isPlayer, playerNum: this.playerNum, color: this.color,
      x: this.x, y: this.y, dirX: this.dirX, dirY: this.dirY, isPunching: this.isPunching,
      punchTimer: this.punchTimer, dead: this.dead, stunTimer: this.stunTimer };
  }
}

function startTournament(room: Room) {
  room.activePlayers.forEach(p => room.scores[p.id] = 0);
  room.currentRound = 1;
  room.phase = "announcement";
  playNextRound(room);
}

function playNextRound(room: Room) {
  if (room.currentRound > TOTAL_ROUNDS) {
    let maxScore = -1;
    const winnerNames: string[] = [];
    room.activePlayers.forEach(p => {
      const s = room.scores[p.id] || 0;
      if (s > maxScore) { maxScore = s; winnerNames.length = 0; winnerNames.push(p.name); }
      else if (s === maxScore) winnerNames.push(p.name);
    });
    room.phase = "finished";
    room.winner = winnerNames.length > 1 ? `تعادل بين: ${winnerNames.join(" و ")}` : `🏆 البطل: ${winnerNames[0]}`;
    broadcastRoomState(room);
    return;
  }

  const modeObj = { ...MODES[Math.floor(Math.random() * MODES.length)] };
  const mapObj: GameMap = JSON.parse(JSON.stringify(MAPS[Math.floor(Math.random() * MAPS.length)]));

  room.currentMode = modeObj;
  room.currentMap = mapObj;
  room.announcement = { round: room.currentRound, modeName: modeObj.name, mapName: mapObj.name };
  room.phase = "announcement";
  broadcastRoomState(room);

  room.announcementTimeout = setTimeout(() => { startMatch(room); }, 3500);
}

function startMatch(room: Room) {
  room.phase = "playing";
  room.entities = [];
  room.footprints = [];
  room.coin = null;
  room.gameOver = false;
  room.survivalTimer = 40 * 60;
  room.frameCount = 0;
  room.roundCoins = {};
  room.message = "";

  let idx = 0;
  room.activePlayers.forEach(p => {
    room.entities.push(new Entity(true, p.id, idx++));
    room.roundCoins[p.id] = 0;
  });

  const totalBots = NUM_BOTS + room.activePlayers.length * 5;
  for (let i = 0; i < totalBots; i++) room.entities.push(new Entity(false, 0, idx++));

  if (room.currentMap && room.currentMap.walls) {
    for (const e of room.entities) {
      let attempts = 0;
      while (isInsideWall(e.x, e.y, room.currentMap) && attempts < 10) {
        e.x = Math.random() * (W - 40) + 20;
        e.y = Math.random() * (H - 40) + 20;
        attempts++;
      }
    }
  }

  if (room.currentMode && room.currentMode.id === "coin") room.coin = { x: Math.random() * (W - 60) + 30, y: Math.random() * (H - MIRROR_SIZE * 2) + MIRROR_SIZE };

  if (room.gameInterval) clearInterval(room.gameInterval);
  room.gameInterval = setInterval(() => gameTick(room), TICK_MS);
}

function gameTick(room: Room) {
  room.frameCount++;
  const map = room.currentMap, mode = room.currentMode, coin = room.coin;
  if (!map || !mode) return;
  if (map.spotlights) {
    for (const s of map.spotlights) {
      s.angle += s.speed; s.x = s.cx + Math.cos(s.angle) * s.orbitRadius; s.y = s.cy + Math.sin(s.angle) * s.orbitRadius;
    }
  }

  for (const e of room.entities) e.update(map, mode, coin, room);

  for (let i = room.footprints.length - 1; i >= 0; i--) {
    room.footprints[i].timer--;
    if (room.footprints[i].timer <= 0) room.footprints.splice(i, 1);
  }

  if (mode.id === "survival" && !room.gameOver) {
    room.survivalTimer--;
    if (room.survivalTimer <= 0) endRound(room, "targets", "انتهى الوقت! الأهداف نجت وكسبت النقاط!");
  }

  broadcastRoomState(room);
}

function endRound(room: Room, winnerNum: number | string, message: string) {
  room.gameOver = true;
  room.message = message;

  if (winnerNum === "targets") {
    room.entities.forEach(e => {
      if (e.isPlayer && e.playerNum !== 1 && !e.dead) room.scores[e.playerNum] = (room.scores[e.playerNum] || 0) + 1;
    });
  } else {
    room.scores[winnerNum as number] = (room.scores[winnerNum as number] || 0) + 1;
  }

  broadcastRoomState(room);

  room.endTimeout = setTimeout(() => {
    if (room.gameInterval) clearInterval(room.gameInterval);
    room.currentRound++;
    playNextRound(room);
  }, 3000);
}

// Socket.io
io.on("connection", (socket: Socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on("startLocalSession", (data: { p1Name?: string; p2Name?: string; gamepadCount?: number }) => {
    const room = createRoom("local");
    room.sockets.add(socket.id);
    room.type = "local";

    const players: PlayerInfo[] = [];
    players.push({ id: 1, name: (data.p1Name || "اللاعب 1"), socketId: socket.id });
    players.push({ id: 2, name: (data.p2Name || "اللاعب 2"), socketId: socket.id });
    const gpCount = data.gamepadCount || 0;
    for (let i = 0; i < gpCount; i++) {
      const pid = players.length + 1;
      players.push({ id: pid, name: `اللاعب ${pid} (يدة)`, socketId: socket.id });
    }

    room.activePlayers = players;
    room.socketPlayerMap[socket.id] = players.map(p => p.id);
    players.forEach(p => { room.inputBuffer[p.id] = {}; });

    socket.emit("roomAssigned", { roomId: room.id, type: "local", playerIds: players.map(p => p.id) });
    console.log(`Local session ${room.id}: ${players.length} players`);

    startTournament(room);
  });

  socket.on("localInputs", (data: Record<string, PlayerInput>) => {
    for (const rid in rooms) {
      const r = rooms[rid];
      if (r.type === "local" && r.sockets.has(socket.id)) {
        for (const key in data) {
          const pid = parseInt(key);
          if (!isNaN(pid) && data[key]) r.inputBuffer[pid] = data[key];
        }
        break;
      }
    }
  });

  socket.on("joinOnlineMatch", (data: { name?: string }) => {
    const name = (data && data.name) || `لاعب ${nextOnlineId}`;
    onlineLobby.push({ socket: socket.id, name, id: nextOnlineId });
    nextOnlineId++;
    io.emit("lobbyCount", onlineLobby.length);
    console.log(`Online lobby: ${onlineLobby.length} waiting`);
  });

  socket.on("startOnlineMatch", () => {
    if (onlineLobby.length < 1) return;
    const room = createRoom("online");
    const players: PlayerInfo[] = [];
    let idx = 1;

    for (const entry of onlineLobby) {
      const sock = io.sockets.sockets.get(entry.socket);
      if (!sock) continue;
      const pid = idx++;
      players.push({ id: pid, name: entry.name, socketId: entry.socket });
      room.sockets.add(entry.socket);
      room.socketPlayerMap[entry.socket] = pid;
      room.inputBuffer[pid] = {};
      sock.emit("roomAssigned", { roomId: room.id, type: "online", playerId: pid });
    }

    room.activePlayers = players;
    onlineLobby = [];
    io.emit("lobbyCount", 0);

    console.log(`Online match ${room.id}: ${players.length} players`);
    startTournament(room);
  });

  socket.on("onlineInput", (data: PlayerInput) => {
    for (const rid in rooms) {
      const r = rooms[rid];
      if (r.type === "online" && r.sockets.has(socket.id)) {
        const pid = r.socketPlayerMap[socket.id] as number | undefined;
        if (pid) r.inputBuffer[pid] = data;
        break;
      }
    }
  });

  socket.on("leaveQueue", () => {
    onlineLobby = onlineLobby.filter(e => e.socket !== socket.id);
    io.emit("lobbyCount", onlineLobby.length);
  });

  socket.on("disconnect", () => {
    onlineLobby = onlineLobby.filter(e => e.socket !== socket.id);
    io.emit("lobbyCount", onlineLobby.length);

    for (const rid in rooms) {
      const r = rooms[rid];
      if (r.sockets.has(socket.id)) {
        r.sockets.delete(socket.id);
        if (r.type === "online" && r.socketPlayerMap[socket.id]) {
          const pid = r.socketPlayerMap[socket.id] as number;
          r.activePlayers = r.activePlayers.filter(p => p.id !== pid);
          delete r.socketPlayerMap[socket.id];
          delete r.inputBuffer[pid];
          if (r.activePlayers.length === 0) destroyRoom(parseInt(rid));
        }
        if (r.type === "local") destroyRoom(parseInt(rid));
        break;
      }
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Facade Frenzy Online running on http://0.0.0.0:${PORT}`);
});