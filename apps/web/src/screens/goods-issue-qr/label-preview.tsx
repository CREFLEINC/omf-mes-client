import { encodeQr } from '@omf-mes/ui';
import { messages } from '@omf-mes/i18n';

import {
  canDrawHangul,
  layoutMaterialLotLabel,
  materialLotLabelMeasure,
  rasterizeHangul,
  type MaterialLotLabelFields,
} from '../../patterns/label/lot-label-tspl';

const t = messages.goodsIssueQr.preview;

/** 줄 높이(점) — `lot-label-tspl` 의 `lineHeight` 와 같은 셈. */
const lineHeight = (point: number): number => Math.ceil(point * (203 / 72));

/**
 * 라벨 미리 보기 — **인쇄와 같은 자리**(`layoutMaterialLotLabel`)를 1 점 = 1 단위로 그린다(시안 P0102-After).
 *
 * ⭐ 줄 크기·자르기·LOT 줄 가운데 줄임(D-16)이 종이와 같다 — 글은 그 줄의 폭(`width`)에 맞춰 늘이거나 줄여 그린다.
 * ⭐ QR 은 실제로 읽히는 무늬다(`encodeQr`). 실을 값은 분할 LOT 번호뿐이다.
 */
export const LabelPreview = ({ fields }: { fields: MaterialLotLabelFields }) => {
  const layout = layoutMaterialLotLabel(
    fields,
    materialLotLabelMeasure(canDrawHangul() ? rasterizeHangul : undefined),
  );
  const matrix = encodeQr(layout.qr.content);
  const cell = layout.qr.side / matrix.size;

  return (
    <figure className="pop-split-label" aria-label={fields.lotNo}>
      <svg
        viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
        role="img"
        aria-label={layout.texts.map((line) => line.content).join(' / ')}
      >
        <rect width={layout.width} height={layout.height} fill="#fff" />
        <g fill="#000" shapeRendering="crispEdges">
          {matrix.modules.flatMap((row, y) =>
            row.map((dark, x) =>
              dark ? (
                <rect
                  key={`${String(x)}-${String(y)}`}
                  x={layout.qr.x + x * cell}
                  y={layout.qr.y + y * cell}
                  width={cell}
                  height={cell}
                />
              ) : null,
            ),
          )}
        </g>
        {layout.texts.map((line) => (
          <text
            key={line.field}
            data-field={line.field}
            x={line.x}
            y={line.y + lineHeight(line.point) * 0.82}
            fontSize={lineHeight(line.point) * 0.9}
            fontWeight={line.field === 'itemCode' || line.field === 'qty' ? 700 : 400}
            textLength={line.width}
            lengthAdjust="spacingAndGlyphs"
          >
            {line.content}
          </text>
        ))}
      </svg>
      <figcaption>{t.guide}</figcaption>
    </figure>
  );
};
