import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toDecimalText } from './decimal-text';

type BomComponent = components['schemas']['BomComponent'];

/**
 * 구성품 한 줄을 표에 낼 문자열로 옮기는 순수 함수들.
 *
 * **스크랩률에 100을 곱하지 않는다.** 계약이 「0~1 비율이며 퍼센트가 아니다」라 못 박았다(A-8) —
 * 곱하면 사용자가 넣지 않은 값이 보이고, 그 값을 근거로 판단이 내려진다.
 *
 * **수를 반올림하거나 자릿수를 맞추지 않는다.** 표기만 편다(`toDecimalText`) —
 * 자릿수를 손대면 원본 자료가 화면에서 다른 값이 된다.
 */

const t = messages.itemExtendedAttrs.component;

/**
 * 스크랩률 표기. **비율 그대로다** — `0.05`는 「0.05」이지 「5%」가 아니다.
 * 지수 표기만 펴서 사람이 읽게 한다(`1e-8` → `0.00000001`).
 */
export const scrapRateText = (scrapRate: number): string => toDecimalText(scrapRate);

/** 소요량 한 칸 — 「수량 단위」. 둘은 따로 읽히지 않으므로 한 칸에 담는다. */
export const requiredQtyText = (requiredQty: number, uomLabel: string): string =>
  t.values.quantity(toDecimalText(requiredQty), uomLabel);

/**
 * 공정 한 칸 — 「등록 공정 · 실사용 공정」.
 * 계약이 「다를 수 있다」고 적었고, 두 값이 같을 때가 많아 나란히 놓아야 비교된다.
 */
export const processText = (registeredLabel: string, actualLabel: string): string =>
  t.values.process(registeredLabel, actualLabel);

/**
 * 확장 표시 — **켜진 것만** 낸다.
 *
 * 꺼진 것까지 내면 칸이 늘 두 줄이 되어 「켜져 있다」는 사실이 눈에 띄지 않는다.
 * 둘 다 꺼져 있으면 빈 목록이고, 그때는 값 없음 표기를 낸다.
 */
export const extensionLabels = (component: BomComponent): string[] => {
  const labels: string[] = [];

  if (component.lotTraceRequired) labels.push(t.values.lotTraceRequired);
  if (component.backflushAllowed) labels.push(t.values.backflushAllowed);

  return labels;
};

/**
 * 줄 액션의 접근 이름.
 *
 * **순서만으로는 부족하고 이름만으로도 부족하다.** 같은 품목이 여러 줄에 나올 수 있고
 * (계약이 그것을 막지 않는다), 이름을 못 받은 줄은 전부 「알 수 없음」이 된다 —
 * 둘을 함께 붙여야 서로 구분된다. 옆 세 자원이 쓰는 형태와 같다.
 */
export const componentRowName = (sequenceNo: number, itemLabel: string): string =>
  `${String(sequenceNo)}. ${itemLabel}`;
