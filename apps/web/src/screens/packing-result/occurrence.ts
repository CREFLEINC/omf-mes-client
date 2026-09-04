import type { components } from '@omf-mes/api-client';

/**
 * 포장 확정 본문에 **언제 일어난 일인가**를 얹는다.
 *
 * 계약이 `HandlingUnitPack`에 `businessDate`·`occurredAt`을 필수로 요구한다(공유계약 C-8).
 * 두 값의 뜻이 다르다 — `occurredAt`은 **이 화면에서 [포장 확정]을 누른 순간**이고,
 * `businessDate`는 그 순간이 속한 **영업일**이다.
 *
 * ⚠ **영업일 산출 규칙(야간조 경계 등)은 아직 계약에 없다.** 이 화면의 포장은 누르는 그 자리에서
 * 만들어지므로 **누른 순간의 로컬 날짜**를 쓴다 — 지난 전표를 나중에 처리하는 화면
 * (`disposal-issue`)과 달리 「전표의 날짜」라는 다른 후보가 없다.
 *
 * ⛔ **본문을 만드는 자리에서 찍지 않는다.** 본문은 렌더마다 다시 만들어지므로 그 자리에서
 * 시각을 찍으면 값이 매 렌더 달라진다. **보내는 순간에 한 번** 얹는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type HandlingUnitPack = components['schemas']['HandlingUnitPack'];

/** 시각 두 칸을 뺀 본문. 화면이 사용자의 입력만으로 만들 수 있는 부분이다. */
export type HandlingUnitPackDraft = Omit<HandlingUnitPack, 'businessDate' | 'occurredAt'>;

/** 로컬 날짜 `YYYY-MM-DD`. `toISOString()`은 UTC라 자정 근처에서 하루가 밀린다. */
const toBusinessDate = (now: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const withOccurrence = (draft: HandlingUnitPackDraft, now: Date): HandlingUnitPack => ({
  ...draft,
  businessDate: toBusinessDate(now),
  occurredAt: now.toISOString(),
});
