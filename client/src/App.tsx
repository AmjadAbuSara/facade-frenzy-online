import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from './socket';
import { GameState, Announcement } from './types';
import { Entity, renderFrame } from './render/Entity';
import { getP1Input, getP2Input, getGamepadInputs, getCombinedInput } from './hooks/useInputCapture';
import './styles.css';

export default function App() {
  const [screen, setScreen] = useState<'mode' | 'game'>('mode');
  const [showLocalSetup, setShowLocalSetup] = useState(false);
  const [showOnlineLobby, setShowOnlineLobby] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [totalRounds, setTotalRounds] = useState(5);
  const [winner, setWinner] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [msg, setMsg] = useState('');
  const [activePlayers, setActivePlayers] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const entitiesRef = useRef<Entity[]>([]);
  const footprintsRef = useRef<any[]>([]);
  const coinRef = useRef<any>(null);
  const currentMapRef = useRef<any>(null);
  const gameOverRef = useRef(false);
  const frameRef = useRef(0);
  const rafRef = useRef(0);
  const roomTypeRef = useRef<'local' | 'online' | null>(null);

  // --- Render loop ---
  function loop() {
    frameRef.current++;
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(loop); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

    const rt = roomTypeRef.current;
    if (rt === 'local') {
      socket.emit('localInputs', { 1: getP1Input(), 2: getP2Input(), ...getGamepadInputs() });
    } else if (rt === 'online') {
      socket.emit('onlineInput', getCombinedInput());
    }

    if (currentMapRef.current) {
      renderFrame(ctx, currentMapRef.current, entitiesRef.current, footprintsRef.current, coinRef.current, gameOverRef.current, frameRef.current, true);
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  // --- Socket events ---
  useEffect(() => {
    socket.on('lobbyCount', (c: number) => setLobbyCount(c));

    socket.on('roomAssigned', (data: any) => {
      setJoined(true);
      roomTypeRef.current = data.type === 'local' ? 'local' : 'online';
      setScreen('game');
      setShowLocalSetup(false);
      setShowOnlineLobby(false);
    });

    socket.on('gameState', (state: GameState) => {
      entitiesRef.current = state.entities.map(e => Entity.fromData(e));
      footprintsRef.current = state.footprints || [];
      coinRef.current = state.coin;
      currentMapRef.current = state.currentMap;
      gameOverRef.current = state.gameOver;
      setActivePlayers(state.activePlayers);
      setScores(state.scores);
      setTotalRounds(state.totalRounds);
      setMsg(state.currentMode?.id === 'survival' && !state.gameOver
        ? `الصياد يبحث! | الوقت: ${Math.ceil(state.survivalTimer / 60)} ثانية`
        : state.message || '');

      if (state.phase === 'announcement' && state.announcement) {
        setIsPlaying(false);
        setAnnouncement(state.announcement);
        cancelAnimationFrame(rafRef.current);
      } else if (state.phase === 'playing') {
        setAnnouncement(null);
        setWinner(null);
        setIsPlaying(true);
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(loop);
      } else if (state.phase === 'finished') {
        setIsPlaying(false);
        cancelAnimationFrame(rafRef.current);
        setWinner(state.winner);
        setTimeout(() => {
          setScreen('mode');
          setWinner(null);
          setAnnouncement(null);
          setIsPlaying(false);
          setJoined(false);
          roomTypeRef.current = null;
        }, 5000);
      }
    });

    return () => {
      socket.off('lobbyCount');
      socket.off('roomAssigned');
      socket.off('gameState');
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function startLocal(p1: string, p2: string, gp: number) {
    socket.emit('startLocalSession', { p1Name: p1, p2Name: p2, gamepadCount: gp });
  }
  function joinOnline(name: string) { socket.emit('joinOnlineMatch', { name }); }
  function startOnline() { socket.emit('startOnlineMatch'); }
  function goMode() {
    if (roomTypeRef.current) socket.emit('leaveQueue');
    setScreen('mode'); setShowLocalSetup(false); setShowOnlineLobby(false);
    setJoined(false); setAnnouncement(null); setIsPlaying(false); setWinner(null);
    roomTypeRef.current = null; cancelAnimationFrame(rafRef.current);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      {/* Mode Selection */}
      {screen === 'mode' && !showLocalSetup && !showOnlineLobby && (
        <div className="screen">
          <h1>Facade Frenzy</h1>
          <h3>اختر وضع اللعب</h3>
          <button className="btn mode-btn" onClick={() => setShowLocalSetup(true)}>🕹️ Offline Locally</button>
          <button className="btn mode-btn btn-secondary" onClick={() => setShowOnlineLobby(true)} style={{marginTop:10}}>🌐 Online (Demo)</button>
        </div>
      )}

      {/* Local Setup */}
      {screen === 'mode' && showLocalSetup && <LocalSetupWizard onBack={goMode} onStart={startLocal} />}

      {/* Online Lobby */}
      {screen === 'mode' && showOnlineLobby && (
        <div className="screen">
          <h1 style={{fontSize:24}}>🌐 Online (Demo)</h1>
          <button className="btn-back" onClick={goMode}>← رجوع</button>
          {!joined ? (
            <>
              <div className="input-group"><label>اسمك</label><input type="text" id="oname" placeholder="اسمك" /></div>
              <button className="btn" onClick={() => {
                const n = (document.getElementById('oname') as HTMLInputElement)?.value || 'لاعب';
                joinOnline(n);
              }}>انضمام للمباراة</button>
            </>
          ) : (
            <p className="lobby-status">⏳ في طابور الانتظار... ({lobbyCount} لاعب/ين)</p>
          )}
          {joined && lobbyCount >= 1 && (
            <button className="btn" onClick={startOnline} style={{marginTop:15}}>بدء المباراة 🏆 ({lobbyCount} لاعب/ين)</button>
          )}
        </div>
      )}

      {/* Announcement */}
      {announcement && !isPlaying && screen === 'game' && (
        <div className="screen" style={{display:'block'}}>
          <div className="announce-title">الجولة {announcement.round} من {totalRounds}</div>
          <div className="announce-text">
            الطور: {announcement.modeName}<br /><br />
            الخريطة: {announcement.mapName}
          </div>
        </div>
      )}

      {/* Winner */}
      {winner && !isPlaying && (
        <div className="screen" style={{display:'block'}}>
          <div className="winner-title">{winner}</div>
          <p className="winner-sub">العودة إلى القائمة الرئيسية...</p>
        </div>
      )}

      {/* Game */}
      {screen === 'game' && (
        <>
          <div id="ui">
            <div id="game-info">{msg}</div>
            <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center'}}>
              {activePlayers.map(p => (
                <div key={p.id} className="player-score">{p.name}: <span className="score">{scores[p.id] || 0}</span></div>
              ))}
            </div>
          </div>
          <canvas ref={canvasRef} width={800} height={600}
            style={{ display: isPlaying && !announcement ? 'block' : 'none' }} />
        </>
      )}
    </div>
  );
}

function LocalSetupWizard({ onBack, onStart }: { onBack: () => void; onStart: (p1: string, p2: string, gp: number) => void }) {
  const [p1, setP1] = useState('اللاعب 1');
  const [p2, setP2] = useState('اللاعب 2');
  const [gpCount, setGpCount] = useState(0);
  const [gamestarted, setGamestarted] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let c = 0;
      for (const p of pads) { if (p) c++; }
      setGpCount(c);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  if (gamestarted) {
    return <div className="screen"><p style={{color:'#38bdf8',fontSize:18}}>⏳ بدء الجلسة...</p></div>;
  }

  return (
    <div className="screen">
      <h1 style={{fontSize:24}}>🕹️ Offline Locally</h1>
      <button className="btn-back" onClick={onBack}>← رجوع</button>
      <div className="input-group">
        <label>اللاعب 1 (WASD / Space)</label>
        <input type="text" value={p1} onChange={e => setP1(e.target.value)} placeholder="اللاعب 1" />
      </div>
      <div className="input-group">
        <label>اللاعب 2 (الأسهم / Numpad 0)</label>
        <input type="text" value={p2} onChange={e => setP2(e.target.value)} placeholder="اللاعب 2" />
      </div>
      <p className="gamepad-note">🎮 <strong>إضافة لاعبين إضافيين:</strong><br />قم بتوصيل أيدي التحكم (Gamepads) — سيتم اكتشافها تلقائياً!</p>
      <p className="gamepad-count">{gpCount > 0 ? `تم الكشف عن ${gpCount} يد(أي) تحكم` : 'لم يتم الكشف عن أي يد تحكم'}</p>
      <button className="btn" onClick={() => { setGamestarted(true); onStart(p1, p2, gpCount); }}>بدء الجلسة المحلية 🏆</button>
    </div>
  );
}