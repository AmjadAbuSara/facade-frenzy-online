import { useEffect, useRef } from 'react';
import { PlayerInput } from '../types';

const keys: Record<string, boolean> = {};

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

export function getP1Input(): PlayerInput {
  return {
    up: !!keys['KeyW'], down: !!keys['KeyS'],
    left: !!keys['KeyA'], right: !!keys['KeyD'],
    punch: !!keys['Space'],
  };
}

export function getP2Input(): PlayerInput {
  return {
    up: !!keys['ArrowUp'] || !!keys['Numpad8'],
    down: !!keys['ArrowDown'] || !!keys['Numpad5'],
    left: !!keys['ArrowLeft'] || !!keys['Numpad4'],
    right: !!keys['ArrowRight'] || !!keys['Numpad6'],
    punch: !!keys['Numpad0'],
  };
}

export function getGamepadInputs(): Record<number, PlayerInput> {
  const gp: Record<number, PlayerInput> = {};
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < gamepads.length; i++) {
    const g = gamepads[i];
    if (g) {
      gp[3 + i] = {
        up: (g.axes[1] || 0) < -0.3,
        down: (g.axes[1] || 0) > 0.3,
        left: (g.axes[0] || 0) < -0.3,
        right: (g.axes[0] || 0) > 0.3,
        punch: !!(g.buttons[1]?.pressed),
      };
    }
  }
  return gp;
}

export function getCombinedInput(): PlayerInput {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const input: PlayerInput = {
    up: !!keys['KeyW'] || !!keys['ArrowUp'] || !!keys['Numpad8'],
    down: !!keys['KeyS'] || !!keys['ArrowDown'] || !!keys['Numpad5'],
    left: !!keys['KeyA'] || !!keys['ArrowLeft'] || !!keys['Numpad4'],
    right: !!keys['KeyD'] || !!keys['ArrowRight'] || !!keys['Numpad6'],
    punch: !!keys['Space'] || !!keys['Numpad0'],
  };
  for (const g of gamepads) {
    if (g) {
      if ((g.axes[1] || 0) < -0.3) input.up = true;
      if ((g.axes[1] || 0) > 0.3) input.down = true;
      if ((g.axes[0] || 0) < -0.3) input.left = true;
      if ((g.axes[0] || 0) > 0.3) input.right = true;
      if (g.buttons[1]?.pressed) input.punch = true;
    }
  }
  return input;
}

export function useGamepadCount() {
  const countRef = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let c = 0;
      for (const p of pads) { if (p) c++; }
      countRef.current = c;
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return countRef;
}