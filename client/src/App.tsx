import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from './socket';
import { GameState, Announcement } from './types';
import { Entity, renderFrame } from './render/Entity';
import { getP1Input, getP2Input, getGamepadInputs, getCombinedInput } from './hooks/useInputCapture';
import ModeSelection from './components/ModeSelection';
import LocalSetup from './components/LocalSetup';
import OnlineLobby from './components/OnlineLobby';
import AnnouncementScreen from './components/AnnouncementScreen';

type Screen = 'mode' | 'local-setup' | 'online-lobby' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('mode');
  const [roomType, setRoomType] = useState<'local' | 'online' | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [totalRounds, setTotalRounds] = useState(5);
  const [winner, setWinner] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState('');
  const [activePlayers, setActivePlayers] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [survivalTimer, setSurvivalTimer] = useState(0);

  // Refs for render loop (avoid stale closures)
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
  const roomTypeRef = useRef<'local' | 'online' | null>(null);

  // Render loop
  const renderLoop = useCallback(() => {
    runningRef.current = false;
    frameCountRef.current++;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (roomTypeRef.current === 'local') {
      socket.emit('localInputs', { 1: getP1Input(), 2: getP2Input(), ...getGamepadInputs() });
    } else if (roomTypeRef.current === 'online') {
      socket.emit('onlineInput', getCombinedInput());
    }

    const map = currentMapRef.current;
    if (!map) return;

    renderFrame(ctx, map, entitiesRef.current, footprintsRef.current, coinRef.current, gameOverRef.current, frameCountRef.current, runningRef.current);

    if (runningRef.current) {
      rafRef.current = requestAnimationFrame(renderLoop);
    }
  }, []);

  // Socket event handlers
  useEffect(() => {
    const onLobbyCount = (count: number) => setLobbyCount(count);
    const onRoomAssigned = (data: any) => {
      setJoined(true);
      if (data.type === 'local') {
        roomTypeRef.current = 'local';
        setRoomType('local');
      } else {
        roomTypeRef.current = 'online';
        setRoomType('online');
      }
    };
    const onGameState = (state: GameState) => {
      entitiesRef.current = state.entities.map(e => Entity.fromData(e));
      footprintsRef.current = state.footprints || [];
      coinRef.current = state.coin;
      currentMapRef.current = state.currentMap;
      currentModeRef.current = state.currentMode;
      gameOverRef.current = state.gameOver;
      setActivePlayers(state.activePlayers);
      setScores(state.scores);
      setTotalRounds(state.totalRounds);

      if (state.currentMode && state.currentMode.id === 'survival' && !state.gameOver) {
        setMessage(`الصياد يبحث! | الوقت: ${Math.ceil(state.survivalTimer / 60)} ثانية`);
      } else {
        setMessage(state.message || '');
      }
      setSurvivalTimer(state.survivalTimer);

      if (state.phase === 'announcement' && state.announcement) {
        setIsPlaying(false);
        setAnnouncement(state.announcement);
      } else if (state.phase === 'playing') {
        setAnnouncement(null);
        setWinner(null);
        if (!runningRef.current) {
          runningRef.current = true;
          setIsPlaying(true);
          setScreen('game');
          rafRef.current = requestAnimationFrame(renderLoop);
        }
      } else if (state.phase === 'finished') {
        runningRef.current = false;
        setIsPlaying(false);
        setWinner(state.winner);
        setTimeout(() => {
          setScreen('mode');
          setWinner(null);
          setAnnouncement(null);
        }, 5000);
      }
    };

    socket.on('lobbyCount', onLobbyCount);
    socket.on('roomAssigned', onRoomAssigned);
    socket.on('gameState', onGameState);

    return () => {
      socket.off('lobbyCount', onLobbyCount);
      socket.off('roomAssigned', onRoomAssigned);
      socket.off('gameState', onGameState);
      cancelAnimationFrame(rafRef.current);
    };
  }, [renderLoop]);

  function startLocal(p1: string, p2: string, gpCount: number) {
    socket.emit('startLocalSession', { p1Name: p1, p2Name: p2, gamepadCount: gpCount });
  }

  function joinOnline(name: string) {
    socket.emit('joinOnlineMatch', { name });
  }

  function startOnline() {
    socket.emit('startOnlineMatch');
  }

  function goToMode() {
    if (roomType) socket.emit('leaveQueue');
    setScreen('mode');
    setJoined(false);
    setRoomType(null);
    setAnnouncement(null);
    setIsPlaying(false);
    setWinner(null);
    runningRef.current = false;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      {announcement && !isPlaying && (
        <AnnouncementScreen announcement={announcement} totalRounds={totalRounds} />
      )}

      {winner && !isPlaying && (
        <div className="screen" style={{ display: 'block' }}>
          <h1 style={{ color: '#38bdf8' }}>{winner}</h1>
          <p style={{ color: '#94a3b8' }}>العودة إلى القائمة الرئيسية...</p>
        </div>
      )}

      {screen === 'mode' && !announcement && !winner && (
        <ModeSelection
          onSelectLocal={() => setScreen('local-setup')}
          onSelectOnline={() => setScreen('online-lobby')}
        />
      )}

      {screen === 'local-setup' && (
        <LocalSetup onBack={goToMode} onStart={startLocal} />
      )}

      {screen === 'online-lobby' && (
        <OnlineLobby
          onBack={goToMode}
          onJoin={joinOnline}
          onStartMatch={startOnline}
          lobbyCount={lobbyCount}
          joined={joined}
        />
      )}

      {screen === 'game' && (
        <>
          <div
            id="ui"
            style={{
              display: 'flex', width: 800, justifyContent: 'space-around',
              flexWrap: 'wrap', marginBottom: 15, color: 'white',
              fontWeight: 'bold', fontSize: 16, flexDirection: 'column', alignItems: 'center',
            }}
          >
            <div style={{ width: '100%', textAlign: 'center', color: '#38bdf8', fontSize: 20, marginBottom: 8 }}>
              {message}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
              {activePlayers.map(p => (
                <div key={p.id} style={{ margin: '5px 15px' }}>
                  {p.name}: <span style={{ color: '#facc15' }}>{scores[p.id] || 0}</span>
                </div>
              ))}
            </div>
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
        </>
      )}
    </div>
  );
}