import type { components } from '@omf-mes/api-client';

/**
 * W-06-14 화면 슬라이스의 계약과 화면 타입.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type PutawayRule = components['schemas']['PutawayRule'];
export type UncoveredItem = components['schemas']['UncoveredItem'];
export type PageMeta = components['schemas']['PageMeta'];

/** 선택 목록의 원본 항목. 사용 여부를 함께 들고 있어야 미사용 값에 표식을 붙일 수 있다. */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

/**
 * **`disabled`를 두지 않는다.** 디자인 시스템 `Select`는 옵션별 잠금을 지원하지만 이 회차에
 * 그 값을 설정하는 자리가 없다 — 이 화면은 고를 수 없는 값을 잠그는 대신 ` (미사용)` 표식만
 * 붙인다(미사용 값도 조건으로는 고를 수 있어야 한다). 정의만 남기면 「이 슬라이스에 그 기능이
 * 없다」가 타입 수준의 사실이 되지 못하고, 죽은 통로가 다음 사본으로 전파된다
 * (사본 체크리스트 7번).
 */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * 조회 조건. **주소가 소유하며 화면 상태로 복제하지 않는다.**
 *
 * 번호가 문자열인 이유는 디자인 시스템 선택칸이 문자열을 다루기 때문이다.
 * 계약 표현(숫자)으로의 변환은 `filters.ts`가 맡는다.
 *
 * **`activeOnly`가 계약 파라미터와 방향이 반대다.** 계약은 `includeInactive`다 —
 * 화면 어휘를 이 마스터의 운용에 맞추고(끈 규칙을 다시 켜는 것이 정상 운용이다)
 * 뒤집는 자리를 `filters.ts` 한 곳에 둔다.
 */
export interface RuleFilters {
  /** 비면 아직 고르지 않은 것이다 — 그때는 목록도 규칙 없는 품목도 부르지 않는다. */
  warehouseId: string;
  /** 비면 「전체 품목」이다. */
  itemId: string;
  activeOnly: boolean;
}

/**
 * 목록 행이 쓰는 적치 규칙 표시 값.
 *
 * **계약의 세 상태를 화면의 두 상태로 줄이는 것이 이 타입의 일이다.** 계약의 선택 필드는
 * `undefined`(응답에 없음)·`null`(비움)·값 셋을 갖는데 화면에서 그 앞 둘은 같은 뜻이다.
 * 줄이지 않으면 읽는 자리마다 `?? null`이 흩어지고, 한 자리라도 빠뜨리면 그 자리에서만
 * 「비었다」와 「안 왔다」가 갈린다.
 */
export interface RuleView {
  putawayRuleId: number;
  itemId: number;
  warehouseId: number;
  /** `null`이면 **창고 전체 규칙**이다. 값이 없는 것이지 잘못된 것이 아니다. */
  locationId: number | null;
  capacityQty: number;
  uomId: number;
  /** 작을수록 먼저 권장한다. 이 방향은 데이터에 적혀 있지 않고 계약이 정한 것이다. */
  priorityNo: number;
  remarks: string | null;
  isActive: boolean;
}

/** `??`는 0과 빈 문자열을 통과시킨다. `||`로 줄이면 용량 0이 「없음」이 되어 뜻이 바뀐다. */
const toNullableNumber = (value: number | null | undefined): number | null => value ?? null;
const toNullableText = (value: string | null | undefined): string | null => value ?? null;

export const toRuleView = (rule: PutawayRule): RuleView => ({
  putawayRuleId: rule.putawayRuleId,
  itemId: rule.itemId,
  warehouseId: rule.warehouseId,
  locationId: toNullableNumber(rule.locationId),
  capacityQty: rule.capacityQty,
  uomId: rule.uomId,
  priorityNo: rule.priorityNo,
  remarks: toNullableText(rule.remarks),
  isActive: rule.isActive,
});
