export interface EntityData {
  index: number; isPlayer: boolean; playerNum: number; color: string;
  x: number; y: number; dirX: number; dirY: number;
  isPunching: boolean; punchTimer: number; dead: boolean; stunTimer: number;
}

export interface PlayerInfo {
  id: number; name: string; socketId?: string;
}

export interface MapData {
  name: string; bg: string; hasTop: boolean; hasBottom: boolean;
  isDisco?: boolean; isSnow?: boolean; isDark?: boolean;
  spotlights?: { cx: number; cy: number; radius: number; angle: number; speed: number; orbitRadius: number; x: number; y: number }[];
  snowPatches?: { x: number; y: number; w: number; h: number }[];
  walls?: { x: number; y: number; w: number; h: number }[];
  checkpoints?: { x: number; y: number; w: number; h: number; flashTimer: number; flashColor: string }[];
  belts?: { x: number; y: number; w: number; h: number; dirX: number; dirY: number; speed: number }[];
}

export interface ModeData {
  id: string; name: string;
}

export interface CoinData {
  x: number; y: number;
}

export interface FootprintData {
  x: number; y: number; timer: number; isPlayer: boolean;
}

export interface Announcement {
  round: number; modeName: string; mapName: string;
}

export interface GameState {
  roomId: number; phase: string; roomType: string;
  entities: EntityData[];
  activePlayers: PlayerInfo[];
  scores: Record<number, number>;
  roundCoins: Record<number, number>;
  currentRound: number; currentMode: ModeData; currentMap: MapData;
  coin: CoinData | null; survivalTimer: number;
  footprints: FootprintData[]; gameOver: boolean;
  message: string; announcement: Announcement | null;
  winner: string | null; frameCount: number;
  totalRounds: number; status: string;
}

export interface RoomAssignment {
  roomId: number; type: string; playerIds?: number[]; playerId?: number;
}

export interface PlayerInput {
  up: boolean; down: boolean; left: boolean; right: boolean; punch: boolean;
}

export interface MapConfig extends MapData {
  spotlights?: (MapData['spotlights'][0] & { x: number; y: number })[];
  checkpoints?: MapData['checkpoints'][0][];
  belts?: MapData['belts'][0][];
}