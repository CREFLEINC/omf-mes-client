import type { components } from '@omf-mes/api-client';

import type { RuleFormValues } from './rule-draft';
import { parseIdentifier, parseIntegerValue, parseNumber } from './rule-validation';

/**
 * 폼 값 → 계약 본문의 **유일한 경계**.
 *
 * ## `PUT`은 부분 수정이 아니다
 *
 * 계약이 수정 본문의 다섯 키 중 셋을 필수로 두었고 나머지 둘(위치·비고)은 선택이다.
 * 선택 키를 **생략으로 비우지 않고 `null`을 명시해 싣는다** — 서버 동작이 같더라도
 * 생략으로 비우면 「빠뜨린 것」과 「비우려는 것」이 코드에서 구별되지 않는다.
 *
 * ## 만들 수 없으면 `null`을 낸다
 *
 * 읽을 수 없는 값을 `0`으로 메우면 **번호 0으로 나가는 요청**이 생긴다. 검증이 그 상태의
 * 저장을 먼저 막지만, 보내는 자리도 스스로 한 번 더 본다 — 막는 곳이 화면뿐인 자리가 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type PutawayRuleCreate = components['schemas']['PutawayRuleCreate'];
export type PutawayRuleUpdate = components['schemas']['PutawayRuleUpdate'];

/** 비고는 **비우면 `null`**이다. 빈 문자열을 보내면 「빈 글자를 적어 둔 것」이 되어 뜻이 다르다. */
const toRemarks = (raw: string): string | null => {
  const text = raw.trim();

  return text === '' ? null : text;
};

/** 양수 용량만 값으로 본다 — 계약이 「0 은 넣을 수 없다」로 못 박았다. */
const toCapacityQty = (raw: string): number | null => {
  const parsed = parseNumber(raw);

  return parsed.kind === 'number' && parsed.value > 0 ? parsed.value : null;
};

/** 정수 우선순위만 값으로 본다. 소수·빈 칸은 만들 수 없는 본문이다. */
const toPriorityNo = (raw: string): number | null => {
  const parsed = parseIntegerValue(raw);

  return parsed.kind === 'number' ? parsed.value : null;
};

/**
 * 등록 본문.
 *
 * **`priorityNo`를 늘 싣는다.** 계약 정본에서 `required`가 아니지만 기본값이 있어 생성 타입에서는
 * 선택이 아니다(부록 A ⓐ 실측) — 폼이 늘 값을 들고 있고 그 값을 그대로 보낸다.
 *
 * **`isActive`를 싣지 않는다** — 계약이 받지 않는다(신규는 항상 사용 중이다).
 */
export const toRuleCreate = (values: RuleFormValues): PutawayRuleCreate | null => {
  const itemId = parseIdentifier(values.itemId);
  const warehouseId = parseIdentifier(values.warehouseId);
  const uomId = parseIdentifier(values.uomId);
  const capacityQty = toCapacityQty(values.capacityQty);
  const priorityNo = toPriorityNo(values.priorityNo);

  if (
    itemId === null ||
    warehouseId === null ||
    uomId === null ||
    capacityQty === null ||
    priorityNo === null
  ) {
    return null;
  }

  return {
    itemId,
    warehouseId,
    /* 비운 위치는 **「창고 전체」라는 값**이다. 생략하지 않고 `null`을 명시해 싣는다. */
    locationId: parseIdentifier(values.locationId),
    capacityQty,
    uomId,
    priorityNo,
    remarks: toRemarks(values.remarks),
  };
};

/**
 * 수정 본문 — **품목과 창고가 없다.**
 *
 * 계약이 「바꾸면 다른 규칙이다」로 두 키를 뺐다. 폼이 그 값을 들고 있어도 여기서 실리지 않는다 —
 * 실을 자리가 없다는 사실이 이 함수의 형태로 드러난다.
 */
export const toRuleUpdate = (values: RuleFormValues): PutawayRuleUpdate | null => {
  const uomId = parseIdentifier(values.uomId);
  const capacityQty = toCapacityQty(values.capacityQty);
  const priorityNo = toPriorityNo(values.priorityNo);

  if (uomId === null || capacityQty === null || priorityNo === null) return null;

  return {
    locationId: parseIdentifier(values.locationId),
    capacityQty,
    uomId,
    priorityNo,
    remarks: toRemarks(values.remarks),
  };
};
