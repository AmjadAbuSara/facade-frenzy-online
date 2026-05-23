import { EntityData, MapConfig, CoinData, FootprintData } from '../types';

const MIRROR_SIZE = 90;

export class Entity {
  radius = 12;
  isPlayer: boolean;
  playerNum: number;
  color: string;
  x: number; y: number;
  dirX: number; dirY: number;
  isPunching: boolean;
  punchTimer: number;
  dead: boolean;
  stunTimer: number;
  index: number;

  constructor(isPlayer: boolean, playerNum: number) {
    this.isPlayer = isPlayer;
    this.playerNum = playerNum;
    this.color = '#334155';
    this.x = 0; this.y = 0;
    this.dirX = 0; this.dirY = 1;
    this.isPunching = false;
    this.punchTimer = 0;
    this.dead = false;
    this.stunTimer = 0;
    this.index = 0;
  }

  static fromData(d: EntityData): Entity {
    const e = new Entity(d.isPlayer, d.playerNum);
    e.index = d.index; e.x = d.x; e.y = d.y;
    e.dirX = d.dirX; e.dirY = d.dirY;
    e.isPunching = d.isPunching; e.punchTimer = d.punchTimer;
    e.dead = d.dead; e.stunTimer = d.stunTimer; e.color = d.color;
    return e;
  }

  drawAgent(ctx: CanvasRenderingContext2D, color: string, isReflection = false, currentMap?: MapConfig) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (currentMap && currentMap.isDisco && this.isPlayer && !isReflection) {
      let under = false;
      for (const s of (currentMap.spotlights || [])) {
        if (Math.hypot(this.x - s.x, this.y - s.y) < s.radius) { under = true; break; }
      }
      if (under) { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 20; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 10; }
    }

    if (!isReflection && !this.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(0, 15, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.lineWidth = 3; ctx.strokeStyle = '#0f172a'; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, -8, 12, Math.PI, 0);
    ctx.lineTo(12, 8); ctx.arc(0, 8, 12, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#7dd3fc';
    const vx = this.dirX * 6, vy = -4 + (this.dirY * 4);
    ctx.beginPath(); ctx.arc(vx, vy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    const time = Date.now() / 120;
    const legAnim = (this.dirX === 0 && this.dirY === 0 || this.stunTimer > 0) ? 0 : Math.sin(time) * 4;
    ctx.beginPath(); ctx.moveTo(-5, 18); ctx.lineTo(-5, 24 + legAnim);
    ctx.moveTo(5, 18); ctx.lineTo(5, 24 - legAnim); ctx.stroke();

    if (this.isPunching) {
      ctx.beginPath(); ctx.moveTo(vx, vy + 4); ctx.lineTo(this.dirX * 30, this.dirY * 30);
      ctx.lineWidth = 6; ctx.stroke();
      ctx.beginPath(); ctx.arc(this.dirX * 30, this.dirY * 30, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D, currentMap?: MapConfig) {
    if (this.dead) {
      ctx.save(); ctx.translate(this.x, this.y);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.beginPath(); ctx.ellipse(0, 5, 20, 10, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(10, 20);
      ctx.moveTo(10, 10); ctx.lineTo(-10, 20); ctx.stroke();
      ctx.restore(); return;
    }
    const c = this.stunTimer > 0 ? '#94a3b8' : this.color;
    this.drawAgent(ctx, c, false, currentMap);
  }

  drawReflection(ctx: CanvasRenderingContext2D, mirrorType: 'top' | 'bottom') {
    if (this.dead || this.isPlayer) return;
    ctx.save();
    let distance: number, refY: number;
    if (mirrorType === 'top') { distance = this.y - MIRROR_SIZE; refY = MIRROR_SIZE - distance; }
    else { distance = (800 - MIRROR_SIZE) - this.y; refY = (800 - MIRROR_SIZE) + distance; }
    const originalY = this.y;
    this.y = refY + 15;
    this.drawAgent(ctx, 'rgba(51, 65, 85, 0.6)', true);
    this.y = originalY;
    ctx.restore();
  }
}

export function drawMirror(ctx: CanvasRenderingContext2D, type: 'top' | 'bottom', entities: Entity[]) {
  const yPos = type === 'top' ? 0 : 600 - MIRROR_SIZE;
  ctx.fillStyle = '#475569'; ctx.fillRect(0, yPos, 800, MIRROR_SIZE);
  ctx.fillStyle = '#bae6fd'; ctx.fillRect(10, yPos + 10, 780, MIRROR_SIZE - 20);
  ctx.save(); ctx.beginPath();
  ctx.rect(10, yPos + 10, 780, MIRROR_SIZE - 20); ctx.clip();
  entities.forEach(e => e.drawReflection(ctx, type));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(10, yPos + 10, 780, MIRROR_SIZE - 20); ctx.restore();
  ctx.fillStyle = '#1e293b';
  if (type === 'top') ctx.fillRect(0, MIRROR_SIZE, 800, 5);
  else ctx.fillRect(0, 600 - MIRROR_SIZE - 5, 800, 5);
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  currentMap: MapConfig | null,
  entities: Entity[],
  footprints: FootprintData[],
  coin: CoinData | null,
  gameOver: boolean,
  frameCount: number,
  isPlaying: boolean,
) {
  if (!currentMap) return;

  ctx.fillStyle = currentMap.bg;
  ctx.fillRect(0, 0, 800, 600);

  if (currentMap.hasTop) drawMirror(ctx, 'top', entities);
  if (currentMap.hasBottom) drawMirror(ctx, 'bottom', entities);

  if (currentMap.spotlights) {
    for (const s of currentMap.spotlights) {
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
      grad.addColorStop(0, 'rgba(255, 255, 200, 0.25)');
      grad.addColorStop(0.5, 'rgba(255, 255, 200, 0.08)');
      grad.addColorStop(1, 'rgba(255, 255, 200, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (currentMap.walls) {
    ctx.fillStyle = '#3a3a3a';
    for (const w of currentMap.walls) {
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#555'; ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, 4);
      ctx.fillStyle = '#3a3a3a';
    }
  }

  if (currentMap.checkpoints) {
    for (const cp of currentMap.checkpoints) {
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(cp.x - 6, cp.y + 2, 6, cp.h - 4);
      ctx.fillRect(cp.x + cp.w, cp.y + 2, 6, cp.h - 4);
      if (cp.flashTimer > 0) {
        ctx.fillStyle = cp.flashColor;
        ctx.globalAlpha = 0.6 + Math.sin(frameCount * 0.5) * 0.3;
        ctx.fillRect(cp.x, cp.y, cp.w, cp.h);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(cp.x, cp.y, cp.w, cp.h);
      }
    }
  }

  if (currentMap.belts) {
    for (const b of currentMap.belts) {
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#666'; ctx.lineWidth = 2;
      const offset = (frameCount * b.speed * 0.5) % 30;
      for (let x = b.x + offset - 30; x < b.x + b.w; x += 30) {
        ctx.beginPath();
        if (b.dirX > 0) { ctx.moveTo(x, b.y + b.h * 0.5 - 8); ctx.lineTo(x + 12, b.y + b.h * 0.5); ctx.lineTo(x, b.y + b.h * 0.5 + 8); }
        else { ctx.moveTo(x + 12, b.y + b.h * 0.5 - 8); ctx.lineTo(x, b.y + b.h * 0.5); ctx.lineTo(x + 12, b.y + b.h * 0.5 + 8); }
        ctx.stroke();
      }
      ctx.fillStyle = '#666';
      ctx.fillRect(b.x, b.y, b.w, 3); ctx.fillRect(b.x, b.y + b.h - 3, b.w, 3);
    }
  }

  if (currentMap.isSnow) {
    if (currentMap.snowPatches) {
      ctx.fillStyle = '#f8fafc';
      for (const p of currentMap.snowPatches) {
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(p.x + 5, p.y + 5, p.w - 10, 4);
        ctx.fillStyle = '#f8fafc';
      }
    }
    for (const f of footprints) {
      ctx.fillStyle = `rgba(180, 190, 200, ${f.timer / 160})`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (coin && !gameOver) {
    ctx.beginPath(); ctx.arc(coin.x, coin.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#b45309'; ctx.stroke();
  }

  entities.sort((a, b) => a.y - b.y);
  entities.forEach(e => e.draw(ctx, currentMap));

  if (currentMap.isDark) {
    ctx.save(); ctx.beginPath();
    ctx.rect(0, 0, 800, 600);
    entities.forEach(e => {
      if (!e.dead && e.isPlayer) { ctx.moveTo(e.x + 120, e.y); ctx.arc(e.x, e.y, 120, 0, Math.PI * 2, true); }
    });
    ctx.fillStyle = 'rgba(10, 15, 25, 0.96)'; ctx.fill();
    ctx.restore();
  }
}