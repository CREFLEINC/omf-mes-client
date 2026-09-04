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

/**
 * 확장 속성 폼 값. 문자열이 많은 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이고,
 * 계약은 선택 항목을 널로 표현한다. 그 경계는 `item-attrs-mappers.ts`가 한 곳에서 넘는다.
 *
 * **여기에 원본 4열이 없다.** 폼에 담지 않으면 실수로도 요청 본문에 실을 수 없다 —
 * 서버가 원본 열의 편집을 막지 않으므로(계약 실측) 화면이 형태로 경계를 지킨다.
 *
 * **`isActive`도 없다.** 계약이 요청에 필수로 요구하지만 화면에 컨트롤을 두지 않는다 —
 * 저장할 때 **조회한 값을 그대로 되돌려 싣는다**(결정 3). 폼 값으로 두면 어딘가에서
 * 기본값이 끼어들어 미사용 품목이 조용히 되살아난다.
 */
export interface ItemAttrsFormValues {
  /** MES가 소유하는 다국어 표시명. 비우면 요청에 `null`이 실린다. */
  nameKo: string;
  nameVi: string;
  /** 개발품이면 생산 실적 ERP 송신 대상에서 제외된다. */
  developmentItem: boolean;
  /** 계약이 「LOT 관리 유형」 코드를 「LOT 관리 여부」 불리언으로 바꿨다(코드 사전 2026-09-03). */
  lotControlled: boolean;
  /** LOT 생성 시 쓰는 기본 보관 단위. 비우면 요청에 `null`이 실린다. */
  defaultLotStorageUomId: string;
  /** 생산 LOT 기본크기. 비우면 요청에 `null`이 실린다. */
  defaultProductionLotSize: string;
  serialControlTypeCode: string;
  /**
   * 「유효기한 관리」 토글. **계약 필드가 아니다** —
   * `shelfLifeDays`의 널 여부를 사람이 다루는 형태로 옮긴 것이다(계약 §8-2).
   */
  shelfLifeManaged: boolean;
  /** 토글 ON이면 필수. OFF이면 요청에 `null`이 실린다 */
  shelfLifeDays: string;
  inspectionRequired: boolean;
  fifoPolicyCode: string;
  negativeStockAllowed: boolean;
  /** 계약이 널을 허용한다 — 비우는 것이 정상 값이다 */
  storageConditionCode: string;
  /** 계약이 널을 허용한다. 값이 있으면 **0을 넘어야** 한다(`exclusiveMinimum`) */
  openedShelfLifeHours: string;
}
