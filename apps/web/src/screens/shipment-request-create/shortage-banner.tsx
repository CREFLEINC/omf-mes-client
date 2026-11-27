import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { AvailableQtyLookup } from './lookups';
import { readQty } from './validation';
import type { ShipmentRequestLineDraft } from './types';

const t = messages.shipmentRequestCreate;

/**
 * 배정 수량이 가용 수량을 넘는 줄인가. **가용 수량을 모르는 동안은(로딩·실패) 부족으로 세지
 * 않는다** — 모르는 것을 「부족하다」로 단언하면 사실이 아닌 경고가 뜬다.
 */
/** 배정 수량이 가용보다 얼마나 많은가 — 부족하지 않거나 가용을 모르면 `null`. */
export const shortageQtyOf = (
  line: ShipmentRequestLineDraft,
  available: AvailableQtyLookup,
): number | null => {
  const allocated = readQty(line.allocatedQty);

  if (allocated.kind !== 'qty' || allocated.value <= 0) return null;

  const itemId = line.itemId === '' ? null : Number(line.itemId);
  const warehouseId = line.warehouseId === '' ? null : Number(line.warehouseId);
  /* 고른 창고의 가용으로 본다(피처 012 FR-006a) — 창고를 안 고른 줄은 모르므로 부족으로 세지 않는다. */
  const state = available.of(itemId, warehouseId);

  return state.kind === 'qty' && allocated.value > state.value
    ? allocated.value - state.value
    : null;
};

export const isShortageLine = (
  line: ShipmentRequestLineDraft,
  available: AvailableQtyLookup,
): boolean => shortageQtyOf(line, available) !== null;

export const countShortageLines = (
  lines: readonly ShipmentRequestLineDraft[],
  available: AvailableQtyLookup,
): number => lines.filter((line) => isShortageLine(line, available)).length;

export interface ShortageBannerProps {
  count: number;
}

/**
 * 가용 부족 경고 — **막지 않는다**(완료 조건 C5). 라인 표의 「가용」 열이 줄마다의 사실을
 * 보이고, 이 배너는 그것을 한눈에 훑는 요약이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ShortageBanner = ({ count }: ShortageBannerProps) => {
  if (count === 0) return null;

  /* 줄에는 부족 수량을, 표 아래에는 진행할 수 있다는 사실을 한 줄로(사용자 개선안 · #360). */
  return (
    <p className="iqc-inspection-action-note sr-shortage-summary" data-tone="warning" role="status">
      <Icon name="warning" size={16} aria-hidden />
      <strong>{t.shortage.title(count)}</strong>
      <span>{t.shortage.description}</span>
    </p>
  );
};
