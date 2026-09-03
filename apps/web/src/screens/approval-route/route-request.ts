import type { components } from '@omf-mes/api-client';

import { parseRangeValue } from './route-validation';
import type { RouteFormValues, RouteView } from './types';

/**
 * 폼 값 ↔ 계약 본문의 **유일한 경계**.
 *
 * 두 방향을 한 파일에 둔다 — 「무엇을 받아 왔는가」와 「무엇을 내보내는가」가 떨어져 있으면
 * 한쪽만 고쳐도 티가 나지 않고, 그 어긋남은 저장한 뒤에야 드러난다.
 *
 * ## `PUT`은 부분 수정이 아니다
 *
 * 계약이 못 박았다 — **보내지 않은 필드는 비워진다.** 사업부를 비우면 전 사업부 공통이 되고
 * 값 구간을 비우면 전 구간이 된다. 그래서 `toRouteUpdate`는 **세 필드를 늘 명시해 싣는다.**
 * 서버 동작은 생략과 같지만(목 실측: 빈 본문 `{}`도 200) **화면이 무엇을 보내는지가 코드에서
 * 읽혀야** 한다 — 생략으로 비우면 「빠뜨린 것」과 「비우려는 것」이 코드에서 구별되지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type ApprovalRouteCreate = components['schemas']['ApprovalRouteCreate'];
export type ApprovalRouteUpdate = components['schemas']['ApprovalRouteUpdate'];

/** 등록 폼의 시작 값. **기본값을 지어내지 않는다** — 고르지 않은 것과 고른 것을 가른다. */
export const emptyRouteFormValues = (): RouteFormValues => ({
  approvalTypeCode: '',
  businessUnitId: '',
  minValue: '',
  maxValue: '',
});

/**
 * 서버 값을 폼 값으로 옮긴다.
 *
 * `null`은 빈 칸이 된다 — 그것이 「비어 있다」의 폼 표현이다. **0은 빈 칸이 아니다**:
 * `||`로 줄이면 하한 0이 사라져 다음 저장에서 「전 구간」이 된다.
 */
export const routeToFormValues = (route: RouteView): RouteFormValues => ({
  approvalTypeCode: route.approvalTypeCode,
  businessUnitId: route.businessUnitId === null ? '' : String(route.businessUnitId),
  minValue: route.minValue === null ? '' : String(route.minValue),
  maxValue: route.maxValue === null ? '' : String(route.maxValue),
});

/** 고친 것이 있는가. 폼 값이 전부 문자열이라 값 비교로 판정한다 — 참조로 보면 늘 다르다. */
export const isSameRouteValues = (a: RouteFormValues, b: RouteFormValues): boolean =>
  a.approvalTypeCode === b.approvalTypeCode &&
  a.businessUnitId === b.businessUnitId &&
  a.minValue === b.minValue &&
  a.maxValue === b.maxValue;

/** 1부터 매겨지는 식별자만 값으로 본다 — `?bu=abc` 같은 값이 `NaN`으로 서버에 나가지 않게 한다. */
const IDENTIFIER = /^\d+$/;

/**
 * 선택칸의 사업부 값을 계약 표현으로 옮긴다. **빈 칸이 곧 「전 사업부 공통」이다** —
 * 특별한 값이 아니라 값이 없는 것이다.
 *
 * 활성 중복 판정도 이 함수를 지난다 — 「무엇이 전 사업부 공통인가」가 두 자리에서 갈리면
 * 저장은 막는데 판정은 통과시키는(또는 그 반대인) 어긋남이 생긴다.
 */
export const toBusinessUnitId = (raw: string): number | null =>
  IDENTIFIER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;

/**
 * 값 구간 한쪽의 계약 표현.
 *
 * **읽을 수 없는 값은 `null`로 보낸다.** 검증(`validateRouteForm`)이 그 상태의 저장을 먼저
 * 막으므로 여기 오지 않지만, 온다면 `NaN`·`Infinity`를 직렬화한 `null`이 실리는 것과 결과가
 * 같다 — 뜻이 흔들리는 값을 만들지 않고 「비움」으로 못 박는다.
 */
const toRangeValue = (raw: string): number | null => {
  const parsed = parseRangeValue(raw);

  return parsed.kind === 'number' ? parsed.value : null;
};

/**
 * 등록 본문.
 *
 * **`isActive`를 싣지 않는다** — 계약이 받지 않는다(신규는 항상 사용 중이다).
 * **승인 유형의 앞뒤 공백을 턴다** — 목이 공백만인 값을 201로 받으므로 막는 곳이 화면뿐이다.
 */
export const toRouteCreate = (values: RouteFormValues): ApprovalRouteCreate => ({
  approvalTypeCode: values.approvalTypeCode.trim() as ApprovalRouteCreate['approvalTypeCode'],
  businessUnitId: toBusinessUnitId(values.businessUnitId),
  minValue: toRangeValue(values.minValue),
  maxValue: toRangeValue(values.maxValue),
});

/**
 * 수정 본문 — **세 필드뿐이고 셋을 늘 명시한다.**
 *
 * `approvalTypeCode`가 없다: 계약이 「바꾸면 다른 결재선이다」로 그 키를 뺐다.
 * `isActive`가 없다: 사용 여부는 전용 액션으로만 바뀐다.
 */
export const toRouteUpdate = (values: RouteFormValues): ApprovalRouteUpdate => ({
  businessUnitId: toBusinessUnitId(values.businessUnitId),
  minValue: toRangeValue(values.minValue),
  maxValue: toRangeValue(values.maxValue),
});
