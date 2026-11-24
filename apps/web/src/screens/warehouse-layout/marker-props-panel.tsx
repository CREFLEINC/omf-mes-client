import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { locationShownName } from '../../patterns/location-tree';
import { levelNameOf } from '../../patterns/location-tree-cell';
import type { MarkerShape } from './layout-draft';
import { MarkerShapeFields } from './marker-shape-fields';
import type { LocationView } from './types';

const t = messages.warehouseLayout;

export interface MarkerPropsPanelProps {
  /** 고른 위치 — 없으면 놓는 방법을 안내한다. */
  location: LocationView | undefined;
  /** 그 위치의 표식 — 없으면 아직 도면에 없다. */
  marker: MarkerShape | undefined;
  disabled: boolean;
  onShapeChange: (shape: Partial<MarkerShape>) => void;
  onRemove: () => void;
}

/**
 * 배치도 수정 창 오른쪽 속성 판(안 A, 사용자 결정 2026-11-24) — 고른 위치의 이름 · 코드 · 단계, 표식의 너비 · 높이 · 회전,
 * [도면에서 빼기]. 판의 손잡이는 포인터 전용이라 자판으로도 같은 일을 하는 자리다.
 */
export const MarkerPropsPanel = ({
  location,
  marker,
  disabled,
  onShapeChange,
  onRemove,
}: MarkerPropsPanelProps) => (
  <section className="layout-editor-props" aria-label={t.editor.props}>
    {location === undefined ? (
      <p className="field-note">{t.editor.propsEmpty}</p>
    ) : (
      <>
        <div className="layout-editor-props-head">
          <strong>{locationShownName(location)}</strong>
          <span className="field-note">
            {[location.locationCode, levelNameOf(location)].filter(Boolean).join(' · ')}
          </span>
        </div>
        {marker === undefined ? (
          <p className="field-note">{t.editor.propsNotPlaced}</p>
        ) : (
          <>
            <MarkerShapeFields shape={marker} disabled={disabled} onChange={onShapeChange} />
            <Button variant="outlined" size="sm" disabled={disabled} onClick={onRemove}>
              {t.map.remove}
            </Button>
          </>
        )}
      </>
    )}
  </section>
);
