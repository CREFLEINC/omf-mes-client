import type { DispositionList, ProductionResultCreate, WorkOrder } from './types';

export const REWORK_WORK_ORDER_TYPE_CODE = 'REWORK';

export type QuantityKey = 'goodQty' | 'defectQty' | 'holdQty' | 'scrapQty';
export type QuantityDrafts = Record<QuantityKey, string>;

export const EMPTY_QUANTITIES: QuantityDrafts = {
  goodQty: '',
  defectQty: '',
  holdQty: '',
  scrapQty: '',
};

export const readQuantity = (value: string): number => {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const quantityTotal = (drafts: QuantityDrafts): number =>
  Object.values(drafts).reduce((sum, value) => sum + readQuantity(value), 0);

export type QuantityVerdict = 'empty' | 'partial' | 'complete' | 'exceeded';

export const quantityVerdict = (total: number, target: number): QuantityVerdict => {
  if (total <= 0) return 'empty';
  if (total > target) return 'exceeded';
  if (total < target) return 'partial';
  return 'complete';
};

export const reworkDispositionProgress = (items: DispositionList['items']) =>
  items
    .filter((item) => item.dispositionTypeCode === REWORK_WORK_ORDER_TYPE_CODE)
    .reduce(
      (progress, item) => ({
        target: progress.target + item.decisionQty,
        completed: progress.completed + item.followUpQty,
        remaining: progress.remaining + Math.max(0, item.decisionQty - item.followUpQty),
      }),
      { target: 0, completed: 0, remaining: 0 },
    );

/**
 * 판정 일자 — **월·일까지만**(스펙 §3 ①의 `08-07`).
 *
 * ⛔ 계약이 준 문자열에서 **글자 그대로** 꺼낸다. `Date` 로 바꿔 다시 찍으면 표시가 단말
 * 시간대에 따라 흔들려 같은 판정이 단말마다 다른 날로 보인다(전례 `P-02-12`).
 */
const DECIDED_ON_PATTERN = /^\d{4}-(\d{2}-\d{2})/u;

export const decidedOnText = (value: string): string =>
  DECIDED_ON_PATTERN.exec(value)?.[1] ?? value;

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

export const toOffsetDateTime = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `${at.getFullYear()}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}T${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:${pad(at.getSeconds(), 2)}${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * ⛔⛔ **`resultSourceCode` 는 다시 필수다**(2026-09-11 전달본). 설계 변동 공지
 * `CREFLEINC/omf-mes#507` 은 이 칸을 계약 `required` 에서 빼고 「화면이 보내지 않는다」로
 * 정리했었는데, 지금 생성 타입은 다시 `resultSourceCode: "MANUAL" | "IOT"` 를 필수로 요구한다
 * — 그런데 계약 설명은 그대로 「⭐ 서버가 안다 — 화면이 고르는 값이 아니다」다. **required 인데
 * 화면이 고르지 말라는 값**이라는 모순이다(`production-result/save-request.ts` 가 같은 모순을
 * 먼저 보고했다 — 중복 보고). 이 화면도 `usePopIdentity`·`NumericKeypad` 로 사람이 수량을
 * 직접 치는 POP 단말이라 `IOT` 일 수 없어, 남는 `MANUAL` 을 싣는다 — 지어낸 값이 아니라
 * 계약의 두 갈래 중 이 화면에 해당하는 유일한 값이다. 다만 이 판단(재작업 실적도
 * production-result 와 같은 「수기 입력」으로 볼지)은 확실하지 않다 — 보고 대상.
 */
export const toProductionResult = (
  workOrder: WorkOrder,
  drafts: QuantityDrafts,
  occurredAt: Date,
): ProductionResultCreate => ({
  workOrderId: workOrder.workOrderId,
  goodQty: readQuantity(drafts.goodQty),
  defectQty: readQuantity(drafts.defectQty),
  holdQty: readQuantity(drafts.holdQty),
  scrapQty: readQuantity(drafts.scrapQty),
  reworkQty: 0,
  uomId: workOrder.uomId,
  occurredAt: toOffsetDateTime(occurredAt),
  resultSourceCode: 'MANUAL',
});
