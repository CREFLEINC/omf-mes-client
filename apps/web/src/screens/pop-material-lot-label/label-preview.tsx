import { encodeQr } from '@omf-mes/ui';
import { useMemo } from 'react';

import {
  canDrawHangul,
  layoutMaterialLotLabel,
  materialLotLabelMeasure,
  rasterizeHangul,
  type MaterialLotLabelFields,
} from '../../patterns/label/lot-label-tspl';

/** 내장 글꼴 글자 높이(점) — `lot-label-tspl` 의 줄 높이와 같은 셈(203 dpi). */
const glyphHeight = (point: number): number => Math.ceil(point * (203 / 72));

/** 굵게 찍히는 줄 — 품번 · 수량(종이에서 크게 나오는 두 줄). */
const BOLD = new Set(['itemCode', 'qty']);

/**
 * 자재 LOT 라벨 80 × 30 mm 한 장을 **종이와 같은 자리**에 그린다(사용자 지시 2026-11-23 「미리보기 배치가 실제와 너무 달라」).
 *
 * ⭐ 자리는 인쇄와 같은 `layoutMaterialLotLabel` 에서 받는다 — 줄 크기 · 위치 · 자르기 · QR 자리가 같다.
 *    폭 재기도 인쇄와 같은 길(`materialLotLabelMeasure`)이라 한글 줄이 줄어드는 자리도 같다.
 * ⭐ QR 은 실제 격자(LOT 번호)를 그린다 — 휴대폰으로 찍어 읽히는지 볼 수 있다.
 * ⚠ 글자 모양은 프린터 내장 글꼴과 같지 않다 — 화면 글꼴이다.
 */
export const LabelPreview = ({ fields }: { fields: MaterialLotLabelFields }) => {
  const layout = useMemo(
    () =>
      layoutMaterialLotLabel(
        fields,
        materialLotLabelMeasure(canDrawHangul() ? rasterizeHangul : undefined),
      ),
    [fields],
  );
  const qr = useMemo(() => encodeQr(layout.qr.content), [layout.qr.content]);
  const cell = layout.qr.side / qr.size;

  return (
    <svg
      className="mll-label-svg"
      viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
      role="img"
      aria-label={fields.lotNo}
    >
      <rect width={layout.width} height={layout.height} rx={8} fill="#fff" stroke="#c9c9cf" />
      <g fill="#000">
        {qr.modules.flatMap((row, y) =>
          row.map((isDark, x) =>
            isDark ? (
              <rect
                key={`${String(x)}-${String(y)}`}
                x={layout.qr.x + x * cell}
                y={layout.qr.y + y * cell}
                width={cell + 0.3}
                height={cell + 0.3}
              />
            ) : null,
          ),
        )}
      </g>
      {layout.texts.map((text) => (
        <text
          key={text.field}
          x={text.x}
          y={text.y}
          dominantBaseline="text-before-edge"
          fontSize={glyphHeight(text.point)}
          fontWeight={BOLD.has(text.field) ? 700 : 400}
          fontFamily={text.field === 'lotNo' ? 'var(--pu-mono, monospace)' : 'inherit'}
          textLength={text.width}
          lengthAdjust="spacingAndGlyphs"
          fill="#000"
        >
          {text.content}
        </text>
      ))}
    </svg>
  );
};
