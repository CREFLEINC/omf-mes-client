import type { components } from '@omf-mes/api-client';

/**
 * W-06-05 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다 —
 * 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

/**
 * 외부 시스템 수신본. **원본 4열**(`itemCode`·`itemName`·`itemTypeCode`·`baseUomId`)과
 * **확장 속성**이 한 객체에 섞여 있다 — 그 경계를 서버가 강제하지 않으므로
 * 요청 본문을 만드는 자리(`item-attrs-mappers.ts`)가 키를 열거해 지킨다.
 */
export type Item = components['schemas']['Item'];
export type PageMeta = components['schemas']['PageMeta'];

/**
 * 선택 목록의 원본 항목. 사용 여부를 함께 들고 있어야
 * 「사용 중인 것 + 지금 고른 값」만 선택지로 낼 수 있다.
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * 좌 페인의 조회 조건. URL이 소유하며 화면 상태로 복제하지 않는다.
 *
 * **품목 유형 조건을 두지 않는다** — 계약에 `itemTypeCode` 쿼리가 있으나 값 목록이 미정이라
 * 선택지를 만들 수 없고, 자유 입력 필터는 바로 옆 검색어 칸과 구분되지 않는다.
 *
 * `includeInactive`는 **켜졌을 때만** 서버로 보낸다. 계약의 기본값이 false라
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 */
export interface ItemFilters {
  q: string;
  includeInactive: boolean;
}
