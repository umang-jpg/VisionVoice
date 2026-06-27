import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

const PRIMARY_BLUE = '#0040e0';
const BAR_COUNT = 12;
const WAVE_WIDTH = 64;
const WAVE_HEIGHT_LARGE = 36;
const WAVE_HEIGHT_SMALL = 22;
const TICK_MS = 50; // ~20fps

function generateSineHeights(t, amplitude) {
  const heights = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const phase = (i / BAR_COUNT) * Math.PI * 2;
    const wave1 = Math.sin(t * 1.8 + phase);
    const wave2 = Math.sin(t * 1.1 + phase * 1.5) * 0.4;
    const wave3 = Math.sin(t * 2.5 + phase * 0.8) * 0.2;
    const raw = (wave1 + wave2 + wave3) / 1.6; // range roughly -1..1
    heights.push(Math.abs(raw) * amplitude + 2); // always positive, min 2
  }
  return heights;
}

function buildWavePath(heights, totalW, totalH) {
  const barWidth = totalW / BAR_COUNT;
  const cx = totalH / 2;
  let d = '';

  heights.forEach((h, i) => {
    const x = i * barWidth + barWidth * 0.25;
    const w = barWidth * 0.5;
    const y = cx - h;
    const r = Math.min(w / 2, h / 2, 3);
    // Rounded rect path
    d += `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h * 2 - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - 2 * r)} a${r},${r} 0 0 1 ${-r},${-r} v${-(h * 2 - 2 * r)} a${r},${r} 0 0 1 ${r},${-r} z `;
  });
  return d;
}

export default function WaveformLoader({ color, size = 'large' }) {
  const loaderColor = color || PRIMARY_BLUE;

  const totalW = size === 'large' ? WAVE_WIDTH : WAVE_WIDTH * 0.6;
  const totalH = size === 'large' ? WAVE_HEIGHT_LARGE : WAVE_HEIGHT_SMALL;
  const amplitude = size === 'large' ? totalH * 0.42 : totalH * 0.38;

  const tRef = useRef(0);
  const [pathD, setPathD] = useState(() =>
    buildWavePath(generateSineHeights(0, amplitude), totalW, totalH)
  );

  useEffect(() => {
    let rafId;
    let last = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      tRef.current += dt;
      const heights = generateSineHeights(tRef.current, amplitude);
      setPathD(buildWavePath(heights, totalW, totalH));
      rafId = setTimeout(tick, TICK_MS);
    };

    rafId = setTimeout(tick, TICK_MS);
    return () => clearTimeout(rafId);
  }, [amplitude, totalW, totalH]);

  return (
    <View accessible={false}>
      <Svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
        <G>
          <Path d={pathD} fill={loaderColor} />
        </G>
      </Svg>
    </View>
  );
}
