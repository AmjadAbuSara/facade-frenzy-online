import React, { useState } from 'react';

interface Props {
  onBack: () => void;
  onJoin: (name: string) => void;
  onStartMatch: () => void;
  lobbyCount: number;
  joined: boolean;
}

export default function OnlineLobby({ onBack, onJoin, onStartMatch, lobbyCount, joined }: Props) {
  const [name, setName] = useState('لاعب');

  return (
    <div className="screen">
      <h1 style={{ fontSize: 24 }}>🌐 Online (Demo)</h1>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 20, fontSize: 14 }}>← رجوع</button>
      {!joined ? (
        <>
          <div className="input-group">
            <label>اسمك</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="اسمك" />
          </div>
          <button className="btn" onClick={() => onJoin(name)}>انضمام للمباراة</button>
        </>
      ) : (
        <p style={{ color: '#fbbf24', fontSize: 14, marginTop: 15 }}>
          ⏳ في طابور الانتظار... ({lobbyCount} لاعب/ين)
        </p>
      )}
      {joined && lobbyCount >= 1 && (
        <button className="btn" onClick={onStartMatch} style={{ marginTop: 15 }}>
          بدء المباراة 🏆 ({lobbyCount} لاعب/ين)
        </button>
      )}
    </div>
  );
}