import { useId, useMemo } from 'react';

import { encodeQr } from './qr-encode';

/**
 * QR 그림 — 글 하나를 스캔할 수 있는 정사각 그림으로 그린다.
 *
 * ⭐ **여백을 반드시 넣는다.** 규격이 요구하는 네 칸의 조용한 테두리가 없으면 스캐너가
 * 격자의 끝을 못 찾는다 — 배경색과 같은 자리라 눈으로는 빠진 것이 보이지 않는다.
 *
 * ⭐ **색을 토큰으로 받지 않고 검정·흰색으로 고정한다.** 대비가 낮으면 못 읽는데, 테마
 * 토큰은 그 대비를 보장하지 않는다. 다크 모드에서도 흰 바탕에 검은 격자를 그린다.
 *
 * 크기는 칸 수와 무관하게 CSS 로 정한다 — `viewBox` 가 칸을 세고 브라우저가 맞춰 늘린다.
 * ⛔ 확대·축소로 칸이 반 픽셀에 걸리지 않도록 `shape-rendering="crispEdges"` 를 건다.
 */
export interface QrCodeProps {
  /** 그림에 담을 글. 기기가 이것을 그대로 읽는다. */
  value: string;
  /** 한 변의 CSS 길이. 기본 `12rem` — 손에 든 기기가 30cm 거리에서 읽는 크기다. */
  size?: string;
  /**
   * 그림을 대신할 말. **화면 낭독기는 격자를 읽을 수 없다** — 무엇을 담은 그림인지 말한다.
   * ⛔ 여기에 담긴 글 자체(토큰 등)를 넣지 않는다.
   */
  label: string;
  className?: string;
}

const QUIET_ZONE = 4;

export const QrCode = ({ value, size = '12rem', label, className }: QrCodeProps) => {
  const titleId = useId();
  const matrix = useMemo(() => encodeQr(value), [value]);
  const span = matrix.size + QUIET_ZONE * 2;

  /* 검은 칸만 그린다 — 흰 바탕은 배경 사각형 하나로 충분하다. */
  const cells: string[] = [];

  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (matrix.modules[row]?.[col] === true) {
        cells.push(`M${String(col + QUIET_ZONE)} ${String(row + QUIET_ZONE)}h1v1h-1z`);
      }
    }
  }

  return (
    <svg
      className={className}
      role="img"
      aria-labelledby={titleId}
      viewBox={`0 0 ${String(span)} ${String(span)}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      <title id={titleId}>{label}</title>
      <rect width={span} height={span} fill="#ffffff" />
      <path d={cells.join('')} fill="#000000" />
    </svg>
  );
};
