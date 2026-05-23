import React, { useRef, useEffect, useState } from 'react';
import socket from '../socket';
import { GameState, PlayerInfo } from '../types';
import { Entity, renderFrame } from '../render/Entity';
import { getP1Input, getP2Input, getGamepadInputs, getCombinedInput } from '../hooks/useInputCapture';

interface Props {
  roomType: 'local' | 'online';
  playerIds?: number[];
}

export default function GameCanvas({ roomType, playerIds }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const entitiesRef = useRef<Entity[]>([]);
  const footprintsRef = useRef<any[]>([]);
  const coinRef = useRef<any>(null);
  const currentMapRef = useRef<any>(null);
  const currentModeRef = useRef<any>(null);
  const gameOverRef = useRef(false);
  const frameCountRef = useRef(0);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const [activePlayers, setActivePlayers] = useState<PlayerInfo[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [message, setMessage] = useState('');
  const [survivalTimer, setSurvivalTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const roomTypeRef = useRef(roomType);
  roomTypeRef.current = roomType;
  const playerIdsRef = useRef(playerIds);
  playerIdsRef.current = playerIds;

  useEffect(() => {
    const onGameState = (state: GameState) => {
      entitiesRef.current = state.entities.map(e => Entity.fromData(e));
      footprintsRef.current = state.footprints || [];
      coinRef.current = state.coin;
      currentMapRef.current = state.currentMap;
      currentModeRef.current = state.currentMode;
      gameOverRef.current = state.gameOver;
      setActivePlayers(state.activePlayers);
      setScores(state.scores);
      setMessage(state.message);
      setSurvivalTimer(state.survivalTimer);

      if (state.currentMode && state.currentMode.id === 'survival' && !state.gameOver) {
        setMessage(`الصياد يبحث! | الوقت: ${Math.ceil(state.survivalTimer / 60)} ثانية`);
      }

      if (state.status === 'playing' && !runningRef.current) {
        runningRef.current = true;
        setIsPlaying(true);
        rafRef.current = requestAnimationFrame(renderLoop);
      } else if (state.status !== 'playing') {
        runningRef.current = false;
        setIsPlaying(false);
      }
    };

    socket.on('gameState', onGameState);
    return () => {
      socket.off('gameState', onGameState);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function renderLoop() {
    runningRef.current = false;
    frameCountRef.current++;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (roomTypeRef.current === 'local') {
      const p1 = getP1Input();
      const p2 = getP2Input();
      const gp = getGamepadInputs();
      socket.emit('localInputs', { 1: p1, 2: p2, ...gp });
    } else if (roomTypeRef.current === 'online') {
      socket.emit('onlineInput', getCombinedInput());
    }

    const map = currentMapRef.current;
    if (!map) return;

    renderFrame(
      ctx, map, entitiesRef.current,
      footprintsRef.current, coinRef.current,
      gameOverRef.current, frameCountRef.current,
      runningRef.current
    );

    if (runningRef.current) {
      rafRef.current = requestAnimationFrame(renderLoop);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        id="ui"
        style={{
          display: 'flex', width: 800, justifyContent: 'space-around',
          flexWrap: 'wrap', marginBottom: 15, color: 'white',
          fontWeight: 'bold', fontSize: 16,
        }}
      >
        <div id="game-info" style={{ width: '100%', textAlign: 'center', color: '#38bdf8', fontSize: 20 }}>
          {message}
        </div>
        {activePlayers.map(p => (
          <div key={p.id} className="player-score" style={{ margin: '5px 15px' }}>
            {p.name}: <span style={{ color: '#facc15' }}>{scores[p.id] || 0}</span>
          </div>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
          borderRadius: 12,
          display: isPlaying ? 'block' : 'none',
        }}
      />
    </div>
  );
}