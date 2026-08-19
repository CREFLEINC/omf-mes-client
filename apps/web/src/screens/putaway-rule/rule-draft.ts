import type { RuleView } from './types';

/**
 * 폼 초안의 값과 **그것이 달라졌는지**.
 *
 * 값이 전부 문자열인 이유는 디자인 시스템 입력칸이 문자열을 다루기 때문이다 —
 * 계약 표현(숫자·`null`)으로의 변환은 `rule-request.ts`가, 읽을 수 있는 값인지의 판정은
 * `rule-validation.ts`가 맡는다. **세 일을 한 파일에 섞지 않는다.**
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface RuleFormValues {
  /** 등록에서만 고른다. 수정 본문에 이 키가 없다 — 바꾸면 다른 규칙이다. */
  itemId: string;
  /** 등록에서만 고른다. 같은 이유다. */
  warehouseId: string;
  /** **비면 「창고 전체」**다. 값이 없는 것이 아니라 확정된 뜻이다. */
  locationId: string;
  capacityQty: string;
  uomId: string;
  priorityNo: string;
  remarks: string;
}

/**
 * 등록 폼의 우선순위 시작 값.
 *
 * **여기만 기본값을 지어낸다.** 계약의 생성 타입에서 `priorityNo`가 선택이 아니라
 * **기본값을 가진 필수**라(부록 A ⓐ 실측) 화면이 늘 값을 실어야 하고, 그 값은 계약이 적어 둔
 * 기본값과 같아야 한다. 나머지 칸은 비운 채 시작한다 — 고르지 않은 것과 고른 것을 가른다.
 */
export const DEFAULT_PRIORITY_NO = '100';

/**
 * 등록 폼의 시작 값.
 *
 * **창고만 미리 채운다.** 이 화면은 창고를 고르는 것으로 시작하고 목록도 그 창고로 서 있다 —
 * 비워 두면 사용자가 방금 고른 창고를 폼에서 한 번 더 고르게 되고, 다른 창고를 고르면
 * 만든 규칙이 지금 목록에 보이지 않는다.
 */
export const emptyRuleFormValues = (warehouseId: string): RuleFormValues => ({
  itemId: '',
  warehouseId,
  locationId: '',
  capacityQty: '',
  uomId: '',
  priorityNo: DEFAULT_PRIORITY_NO,
  remarks: '',
});

/**
 * 서버 값을 폼 값으로 옮긴다.
 *
 * `null`은 빈 칸이 된다 — 그것이 「비어 있다」의 폼 표현이다. **0은 빈 칸이 아니다**:
 * `||`로 줄이면 용량 0이나 우선순위 0이 사라져 다음 저장에서 다른 값이 된다.
 */
export const ruleToFormValues = (rule: RuleView): RuleFormValues => ({
  itemId: String(rule.itemId),
  warehouseId: String(rule.warehouseId),
  locationId: rule.locationId === null ? '' : String(rule.locationId),
  capacityQty: String(rule.capacityQty),
  uomId: String(rule.uomId),
  priorityNo: String(rule.priorityNo),
  remarks: rule.remarks ?? '',
});

/** 고친 것이 있는가. 값이 전부 문자열이라 값 비교로 판정한다 — 참조로 보면 늘 다르다. */
export const isSameRuleValues = (a: RuleFormValues, b: RuleFormValues): boolean =>
  a.itemId === b.itemId &&
  a.warehouseId === b.warehouseId &&
  a.locationId === b.locationId &&
  a.capacityQty === b.capacityQty &&
  a.uomId === b.uomId &&
  a.priorityNo === b.priorityNo &&
  a.remarks === b.remarks;

/**
 * 창고를 바꾸면 **위치를 함께 비운다.**
 *
 * 위치는 창고에 속한다 — 계약이 위치 조회에 창고를 필수로 요구하고, 다른 창고의 위치를 실은
 * 규칙은 성립하지 않는다. 비우지 않으면 선택칸에는 보이지 않는 위치 번호가 초안에 남아
 * **화면에 없는 값이 저장 본문에 실린다.**
 */
export const withWarehouse = (values: RuleFormValues, warehouseId: string): RuleFormValues => ({
  ...values,
  warehouseId,
  locationId: '',
});
