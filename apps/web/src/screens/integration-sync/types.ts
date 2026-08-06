import type { components } from '@omf-mes/api-client';

/**
 * W-06-10 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * **상세 표현에 전문(`payload`)을 두지 않는다.** 계약의 `IntegrationMessageDetail`에는 있지만
 * 화면 타입에는 담지 않는다 — 담으면 언젠가 렌더된다(이슈 omf-mes-client#11 §4 「비활성 + 사유」).
 */

export type IntegrationMessageRow = components['schemas']['IntegrationMessage'];
export type PageMeta = components['schemas']['PageMeta'];

/** 일괄 처리 결과. **부분 실패를 허용한다** — 전체를 되돌리지 않는다. */
export type BatchResult = components['schemas']['BatchResult'];

/**
 * 상세 표시. 계약의 상세 응답에서 **전문을 뺀 것**이며 목록 행과 같은 항목만 갖는다.
 * 별칭이라 구조가 같아도 이름을 따로 두는 이유는, 「여기에 payload가 없다」가 이 이름의 뜻이기 때문이다.
 */
export type MessageDetailView = IntegrationMessageRow;

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface MessageListResult {
  items: IntegrationMessageRow[];
  page: PageMeta;
}
