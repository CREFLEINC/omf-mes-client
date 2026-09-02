import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { AvailableQtyLookup } from './lookups';
import { readQty } from './validation';
import type { ShipmentRequestLineDraft } from './types';

const t = messages.shipmentRequestCreate;

/**
 * 배정 수량이 가용 수량을 넘는 줄인가. **가용 수량을 모르는 동안은(로딩·실패) 부족으로 세지
 * 않는다** — 모르는 것을 「부족하다」로 단언하면 사실이 아닌 경고가 뜬다.
 */
export const isShortageLine = (
  line: ShipmentRequestLineDraft,
  available: AvailableQtyLookup,
): boolean => {
  const allocated = readQty(line.allocatedQty);

  if (allocated.kind !== 'qty' || allocated.value <= 0) return false;

  const itemId = line.itemId === '' ? null : Number(line.itemId);
  const state = available.of(itemId);

  return state.kind === 'qty' && allocated.value > state.value;
};

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

  return (
    <div className="banner-slot">
      <AlertBanner variant="warning" title={t.shortage.title}>
        {t.shortage.description(count)}
      </AlertBanner>
    </div>
  );
};
