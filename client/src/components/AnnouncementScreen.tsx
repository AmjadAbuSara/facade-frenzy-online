import React from 'react';
import { Announcement } from '../types';

interface Props {
  announcement: Announcement;
  totalRounds: number;
}

export default function AnnouncementScreen({ announcement, totalRounds }: Props) {
  return (
    <div className="screen" style={{ display: 'block' }}>
      <div style={{ fontSize: 32, color: '#38bdf8', marginBottom: 20 }}>
        الجولة {announcement.round} من {totalRounds}
      </div>
      <div style={{ fontSize: 24, lineHeight: 1.6 }}>
        الطور: {announcement.modeName}<br /><br />
        الخريطة: {announcement.mapName}
      </div>
    </div>
  );
}