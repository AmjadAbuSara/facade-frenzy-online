import React from 'react';

interface Props {
  onSelectLocal: () => void;
  onSelectOnline: () => void;
}

export default function ModeSelection({ onSelectLocal, onSelectOnline }: Props) {
  return (
    <div className="screen">
      <h1>Facade Frenzy</h1>
      <h3 style={{ color: '#94a3b8', marginBottom: 30 }}>اختر وضع اللعب</h3>
      <button className="btn mode-btn" onClick={onSelectLocal}>🕹️ Offline Locally</button>
      <button className="btn mode-btn btn-secondary" onClick={onSelectOnline} style={{ marginTop: 10 }}>🌐 Online (Demo)</button>
    </div>
  );
}