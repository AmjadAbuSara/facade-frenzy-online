import React, { useState, useEffect } from 'react';

interface Props {
  onBack: () => void;
  onStart: (p1: string, p2: string, gpCount: number) => void;
}

export default function LocalSetup({ onBack, onStart }: Props) {
  const [p1, setP1] = useState('اللاعب 1');
  const [p2, setP2] = useState('اللاعب 2');
  const [gpCount, setGpCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let c = 0;
      for (const p of pads) { if (p) c++; }
      setGpCount(c);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="screen">
      <h1 style={{ fontSize: 24 }}>🕹️ Offline Locally</h1>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 20, fontSize: 14 }}>← رجوع</button>
      <div className="input-group">
        <label>اللاعب 1 (WASD / Space)</label>
        <input type="text" value={p1} onChange={e => setP1(e.target.value)} placeholder="اللاعب 1" />
      </div>
      <div className="input-group">
        <label>اللاعب 2 (الأسهم / Numpad 0)</label>
        <input type="text" value={p2} onChange={e => setP2(e.target.value)} placeholder="اللاعب 2" />
      </div>
      <p style={{ color: '#fbbf24', fontSize: 14, marginTop: 15 }}>
        🎮 <strong>إضافة لاعبين إضافيين:</strong><br />قم بتوصيل أيدي التحكم (Gamepads) — سيتم اكتشافها تلقائياً!
      </p>
      <p id="gamepad-count" style={{ color: '#94a3b8', fontSize: 13 }}>
        {gpCount > 0 ? `تم الكشف عن ${gpCount} يد(أي) تحكم` : 'لم يتم الكشف عن أي يد تحكم'}
      </p>
      <button className="btn" onClick={() => onStart(p1, p2, gpCount)}>بدء الجلسة المحلية 🏆</button>
    </div>
  );
}