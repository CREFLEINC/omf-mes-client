import { messages } from '@omf-mes/i18n';

import type { DuplicateCheck } from './duplicate-check';
import type { RouteFormValues } from './types';

/**
 * 결재선 폼의 검증과 **저장 가능 판정 한 곳**.
 *
 * 판정을 화면에 흩으면 버튼이 막는 조건과 보내는 자리가 막는 조건이 갈린다 — 그때
 * 「버튼은 눌리는데 아무 일도 없는」 자리나 반대로 「버튼은 잠겼는데 서버는 받는」 자리가 생긴다.
 * 버튼의 비활성 사유와 제출 직전의 재판정이 **같은 함수**를 부른다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.approvalRoute;

export type RouteFormMode = 'create' | 'edit';

/**
 * 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준이다.
 *
 * **입력칸이 있는 넷만 담는다.** 입력칸 없는 이름을 채우면 그 오류가 인라인으로 흘러가
 * 어디에도 보이지 않는다 — `isActive`·`steps`가 여기 없는 이유다.
 * 끄기·켜기 쓰기는 대응하는 입력칸이 아예 없어 `knownFields`가 **빈 배열**이다.
 */
export const ROUTE_FORM_FIELDS: readonly string[] = [
  'approvalTypeCode',
  'businessUnitId',
  'minValue',
  'maxValue',
];

/** 친 글자를 값 구간의 한쪽으로 읽은 결과. **빈 칸은 오류가 아니다** — 「그 방향으로 제한하지 않는다」는 뜻이다. */
export type RangeParse =
  { kind: 'empty' } | { kind: 'invalid' } | { kind: 'number'; value: number };

/**
 * `Number()`는 빈 문자열과 공백을 `0`으로 읽고 `Infinity`를 숫자로 읽는다 — 둘 다 여기서
 * 걸러 낸다. 걸러 내지 않으면 요청 본문에 `0`(비운 칸이 하한 0이 된다)이나
 * `null`(직렬화한 `Infinity`)이 실린다.
 *
 * **음수와 소수를 막지 않는다.** 계약이 이 값에 하한도 형식도 두지 않았고, 1차에서는
 * 이 구간으로 아무것도 고르지 않는다 — 없는 규칙을 화면이 지어내지 않는다.
 */
export const parseRangeValue = (raw: string): RangeParse => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  return Number.isFinite(value) ? { kind: 'number', value } : { kind: 'invalid' };
};

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **등록과 수정을 가른다** — 계약의 `ApprovalRouteCreate`는 승인 유형을 필수로 요구하고
 * `ApprovalRouteUpdate`에는 그 키가 아예 없다. 한 벌로 합치면 수정에서도 유형을 검사하게 되어,
 * 값 목록이 비어 있는 동안 **고칠 수도 없는 화면**이 된다.
 *
 * **활성 중복은 여기서 보지 않는다.** 그것은 폼 값만으로 판정할 수 없고(서버 상태가 근거다)
 * 판정하지 못하는 갈래가 있어 `saveBlockedReason`이 따로 다룬다.
 */
export const validateRouteForm = (
  values: RouteFormValues,
  mode: RouteFormMode,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (mode === 'create' && values.approvalTypeCode.trim() === '') {
    errors.approvalTypeCode = t.validation.approvalTypeRequired;
  }

  const min = parseRangeValue(values.minValue);
  const max = parseRangeValue(values.maxValue);

  if (min.kind === 'invalid') errors.minValue = t.validation.valueNotNumber;
  if (max.kind === 'invalid') errors.maxValue = t.validation.valueNotNumber;

  /*
   * **둘 다 있을 때만 비교한다**(계약 `ck_approval_route_range`). 한쪽만 있을 때 비교하면
   * 비어 있는 쪽이 `0`으로 읽혀 「100 이상」이 「상한 0보다 크다」로 판정된다.
   * 읽을 수 없는 값끼리 비교해 봐야 뜻이 없으므로 형식 오류가 앞선다.
   */
  if (min.kind === 'number' && max.kind === 'number' && max.value < min.value) {
    errors.maxValue = t.validation.maxLessThanMin;
  }

  return errors;
};

export interface SaveGate {
  mode: RouteFormMode;
  values: RouteFormValues;
  /** 승인 유형 선택지의 개수. **0이면 등록만 잠긴다** — 수정 본문에는 유형이 없다. */
  approvalTypeOptionCount: number;
  isDirty: boolean;
  duplicate: DuplicateCheck;
}

/**
 * 저장이 막힌 사유. `null`이면 저장할 수 있다.
 *
 * **값 목록 미확정이 잠그는 범위는 등록 하나뿐이다**(`omf-mes#64`). 앞 화면들에서는 필수 코드가
 * 비면 주 기능 전체가 잠겼는데, 여기서는 이미 있는 결재선을 고치고 끄고 켜는 일이 그대로 열린다 —
 * 그 사실을 사유 문구가 함께 말한다.
 *
 * **활성 중복을 마지막에 본다.** 앞의 사유들은 폼 값만으로 판정되지만 이것은 서버 조회에
 * 기대므로, 먼저 고칠 수 있는 것을 먼저 말한다.
 */
export const saveBlockedReason = (gate: SaveGate): string | null => {
  if (gate.mode === 'create') {
    if (gate.approvalTypeOptionCount === 0) return t.actionReasons.createPendingCode;
    if (gate.values.approvalTypeCode.trim() === '') return t.actionReasons.createNoType;
  } else if (!gate.isDirty) {
    return t.actionReasons.saveNoChanges;
  }

  return gate.duplicate.kind === 'blocked' ? t.actionReasons.duplicateActive : null;
};

export interface ActivateGate {
  stepCount: number;
  duplicate: DuplicateCheck;
}

/**
 * 「다시 사용」이 막힌 사유. `null`이면 켤 수 있다.
 *
 * 계약이 **단계 0**과 **활성 중복**을 각각 400으로 막는다. 화면이 먼저 막는 이유는
 * 사용자가 확인 창까지 지나간 뒤에 거절을 받으면 무엇이 잘못됐는지 알 수 없기 때문이다.
 *
 * **단계 0을 먼저 낸다** — 그것이 사용자가 먼저 해야 할 일이고, 중복을 풀어도 단계가 없으면
 * 여전히 켤 수 없다.
 */
export const activateBlockedReason = (gate: ActivateGate): string | null => {
  if (gate.stepCount === 0) return t.actionReasons.activateNoSteps;

  return gate.duplicate.kind === 'blocked' ? t.actionReasons.activateDuplicate : null;
};
