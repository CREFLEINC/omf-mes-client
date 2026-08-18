import { messages } from '@omf-mes/i18n';

import type { DuplicateCheck } from './duplicate-check';
import type { RuleFormValues } from './rule-draft';

/**
 * 폼의 검증과 **저장 가능 판정 한 곳**.
 *
 * 판정을 화면에 흩으면 버튼이 막는 조건과 보내는 자리가 막는 조건이 갈린다 — 그때
 * 「버튼은 눌리는데 아무 일도 없는」 자리나 「버튼은 잠겼는데 서버는 받는」 자리가 생긴다.
 * 버튼의 비활성 사유와 제출 직전의 재판정이 **같은 함수**를 부른다.
 *
 * **위치 용량 초과는 여기 없다.** 그것은 경고일 뿐 저장을 막지 않는다(`omf-mes#84` ·
 * `capacity-note.ts`) — 막는 것과 알리는 것을 한 파일에 섞으면 언젠가 하나가 다른 쪽으로 샌다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.putawayRule;

export type RuleFormMode = 'create' | 'edit';

/**
 * 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준이다.
 *
 * **입력칸이 실제로 있는 이름만 담는다.** 입력칸 없는 이름을 채우면 그 오류가 인라인으로
 * 흘러가 어디에도 보이지 않는다 — `isActive`가 여기 없는 이유다(사용 여부는 전용 액션으로만
 * 바뀐다).
 *
 * 수정에서 품목·창고 칸은 잠기지만 **이름은 그대로 둔다** — 서버가 그 칸에 붙여 보낸 오류를
 * 배너로 올리면 어느 칸의 문제인지 사라진다.
 */
export const RULE_FORM_FIELDS: readonly string[] = [
  'itemId',
  'warehouseId',
  'locationId',
  'capacityQty',
  'uomId',
  'priorityNo',
  'remarks',
];

/** 친 글자를 수로 읽은 결과. **빈 칸과 읽을 수 없는 값을 가른다** — 사용자가 할 일이 다르다. */
export type NumberParse =
  { kind: 'empty' } | { kind: 'invalid' } | { kind: 'number'; value: number };

/**
 * `Number()`는 빈 문자열과 공백을 `0`으로 읽고 `Infinity`를 숫자로 읽는다 — 둘 다 여기서
 * 걸러 낸다. 걸러 내지 않으면 요청 본문에 `0`(비운 칸이 용량 0이 된다)이나
 * `null`(직렬화한 `Infinity`)이 실린다.
 */
export const parseNumber = (raw: string): NumberParse => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  return Number.isFinite(value) ? { kind: 'number', value } : { kind: 'invalid' };
};

/** 우선순위는 정수다. 소수를 보내면 계약이 400으로 되돌린다 — 보내기 전에 화면이 말한다. */
export const parseIntegerValue = (raw: string): NumberParse => {
  const parsed = parseNumber(raw);

  if (parsed.kind !== 'number') return parsed;

  return Number.isInteger(parsed.value) ? parsed : { kind: 'invalid' };
};

/** 1부터 매겨지는 식별자만 값으로 본다 — 고르지 않은 칸이 `NaN`으로 서버에 나가지 않게 한다. */
const IDENTIFIER = /^\d+$/;

export const parseIdentifier = (raw: string): number | null => {
  const text = raw.trim();

  return IDENTIFIER.test(text) && Number(text) >= 1 ? Number(text) : null;
};

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **등록과 수정을 가른다** — 계약의 `PutawayRuleUpdate`에는 품목·창고 키가 아예 없다
 * (「바꾸면 다른 규칙이다」). 한 벌로 합치면 수정에서도 두 칸을 검사하게 되고, 잠겨 있어
 * 고칠 수도 없는 칸이 저장을 막는다.
 *
 * **위치는 검사하지 않는다** — 비어 있는 것이 정상 값(창고 전체 규칙)이다.
 */
export const validateRuleForm = (
  values: RuleFormValues,
  mode: RuleFormMode,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (mode === 'create') {
    if (parseIdentifier(values.itemId) === null) errors.itemId = t.validation.itemRequired;
    if (parseIdentifier(values.warehouseId) === null) {
      errors.warehouseId = t.validation.warehouseRequired;
    }
  }

  const capacity = parseNumber(values.capacityQty);

  if (capacity.kind === 'empty') errors.capacityQty = t.validation.capacityRequired;
  if (capacity.kind === 'invalid') errors.capacityQty = t.validation.capacityNotNumber;
  /* 계약이 「0 은 넣을 수 없다」로 못 박았다. 음수도 같은 자리에서 막는다 — 담을 수 없는 양이다. */
  if (capacity.kind === 'number' && capacity.value <= 0) {
    errors.capacityQty = t.validation.capacityNotPositive;
  }

  if (parseIdentifier(values.uomId) === null) errors.uomId = t.validation.uomRequired;

  const priority = parseIntegerValue(values.priorityNo);

  if (priority.kind === 'empty') errors.priorityNo = t.validation.priorityRequired;
  if (priority.kind === 'invalid') errors.priorityNo = t.validation.priorityNotInteger;

  return errors;
};

export interface SaveGate {
  mode: RuleFormMode;
  isDirty: boolean;
  duplicate: DuplicateCheck;
}

/**
 * 저장이 막힌 사유. `null`이면 저장할 수 있다.
 *
 * **필수 누락은 버튼을 잠그지 않는다.** 잠그면 사용자가 무엇이 모자란지 알 길이 사유 한 줄뿐인데
 * 모자란 칸은 여럿일 수 있다 — 저장을 눌렀을 때 **각 칸 옆에** 말하는 쪽이 정확하다.
 *
 * **활성 중복은 마지막에 본다.** 앞의 사유는 폼 값만으로 판정되지만 이것은 서버 조회에 기대므로,
 * 먼저 고칠 수 있는 것을 먼저 말한다. **판정하지 못한 갈래(`unknown`)는 막지 않는다** —
 * 계약이 같은 조건을 400으로 다시 검사하므로, 조회 하나가 실패했다고 마스터 관리가 멈추면 안 된다.
 */
export const saveBlockedReason = (gate: SaveGate): string | null => {
  if (gate.mode === 'edit' && !gate.isDirty) return t.actionReasons.saveNoChanges;

  return gate.duplicate.kind === 'blocked' ? t.actionReasons.duplicateActive : null;
};
