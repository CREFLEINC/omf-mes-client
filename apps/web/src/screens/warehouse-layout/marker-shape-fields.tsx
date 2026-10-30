import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { MARKER_MIN_SIZE, type MarkerShape } from './layout-draft';

const t = messages.warehouseLayout;

const MIN_PERCENT = Math.round(MARKER_MIN_SIZE * 100);

export interface MarkerShapeFieldsProps {
  shape: MarkerShape;
  disabled: boolean;
  /** 바꾼 칸만 준다 — 범위 묶기는 `shapeMarker` 가 한다. */
  onChange: (shape: Partial<MarkerShape>) => void;
}

/** 비율(0~1)을 사람이 읽는 백분율로 — 소수 첫째 자리까지. */
const toPercent = (ratio: number): string => String(Math.round(ratio * 1000) / 10);

interface NumberCellProps {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}

/**
 * 숫자 칸 하나 — 치는 동안은 글자 그대로 두고, 수가 되면 바로 반영한다. 빈 칸 · 수 아닌 값은 반영하지 않고, 칸을 떠나면
 * 지금 값으로 되돌린다. 그래야 「12」를 치려고 「1」을 지나는 사이에 표식이 튀어도 칸이 지워지지 않는다.
 */
const NumberCell = ({ label, value, min, max, step, disabled, onCommit }: NumberCellProps) => {
  const [text, setText] = useState<string | null>(null);

  return (
    <TextField
      size="sm"
      type="number"
      label={label}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={text ?? value}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = Number(event.target.value);
        if (event.target.value !== '' && Number.isFinite(parsed)) onCommit(parsed);
      }}
      onBlur={() => {
        setText(null);
      }}
    />
  );
};

/**
 * 고른 표식의 크기 · 회전 칸(사용자 지시 2026-10-30). 판의 손잡이는 포인터 전용이라, 자판으로도 같은 일을 하는 자리다.
 * 너비 · 높이는 도면 폭 · 높이에 대한 백분율, 회전은 도(시계 방향).
 */
export const MarkerShapeFields = ({ shape, disabled, onChange }: MarkerShapeFieldsProps) => (
  <div className="marker-shape-fields" role="group" aria-label={t.map.shape}>
    <NumberCell
      label={t.map.width}
      value={toPercent(shape.width)}
      min={MIN_PERCENT}
      max={100}
      step={1}
      disabled={disabled}
      onCommit={(value) => {
        onChange({ width: value / 100 });
      }}
    />
    <NumberCell
      label={t.map.height}
      value={toPercent(shape.height)}
      min={MIN_PERCENT}
      max={100}
      step={1}
      disabled={disabled}
      onCommit={(value) => {
        onChange({ height: value / 100 });
      }}
    />
    <NumberCell
      label={t.map.rotation}
      value={String(shape.rotation)}
      min={0}
      max={359}
      step={15}
      disabled={disabled}
      onCommit={(value) => {
        onChange({ rotation: value });
      }}
    />
  </div>
);
