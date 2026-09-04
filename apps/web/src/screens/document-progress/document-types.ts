import type { paths } from '@omf-mes/api-client';

import type { SelectOption } from './types';

/** 계약이 문서 유형을 닫았다(코드 사전 2026-09-03) — 목록 질의값·상세 경로 조각이 같은 형이다. */
export type DocumentTypeCode =
  paths['/logistics/document-progress']['get']['parameters']['query']['documentTypeCode'];

/**
 * 고정 OpenAPI가 닫은 문서 유형을 한 표에서 관리한다. 이 값은 세 가지 일을 한꺼번에 한다.
 *
 * | 자리 | 이 값이 하는 일 | 비어 있으면 |
 * | --- | --- | --- |
 * | 유형 선택지 | 고를 수 있는 유형을 정한다 | 아무것도 고를 수 없다 |
 * | 목록 질의값·상세 경로 조각 | 계약에 **그대로** 실린다 | **목록 조회가 한 번도 나가지 않는다** |
 * | 고를 수 없는 유형 | 외주 2문서를 비활성하고 사유를 보인다(omf-mes#82) | 비활성할 대상이 없다 |
 * | **취소 리소스** | 취소 요청이 어느 계약 경로로 나가는지 정한다 | **취소 조작이 서지 않는다** |
 *
 * 넷을 따로 두면 서로 어긋날 수 있으므로 한 표에 담는다.
 *
 * ⭐ **취소 리소스 열은 계약이 주지 않는 값이다.** 목록·상세의 열쇠는 `documentTypeCode` 하나인데
 * 취소 오퍼레이션은 **리소스별 경로 셋**(`goods-receipts`·`inbound-receipts`·`goods-issues`)에
 * 걸려 있고, 둘을 잇는 값을 계약이 내려주지 않는다(계약 본문 스스로 「유형↔테이블 규약이 아직
 * 없다」고 적었다). 그래서 화면이 그 표를 자리표시로 **소유**한다 — ⛔ 유형 코드에서 리소스를
 * **지어내는 분기**를 만들지 않는다. 그것이 금지된 「유형↔후속 관계표」와 같은 형태다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 취소 오퍼레이션이 걸린 계약 경로 조각. **계약에 있는 셋뿐이다**(실측).
 *
 * 문자열이 아니라 세 값의 합집합인 이유: 이 값이 **경로로 그대로 나가므로**, 표에 오타가 들어가면
 * 화면이 없는 주소로 요청을 보낸다. 세 값으로 좁혀 두면 그 오타를 `tsc`가 잡는다.
 */
export type CancelResource = 'goods-receipts' | 'inbound-receipts' | 'goods-issues';

export interface DocumentTypeEntry {
  /** 계약에 실을 코드값 — 목록 질의값·상세 경로 조각으로 그대로 나간다 */
  code: DocumentTypeCode;
  /** 화면에 보일 이름. 설계가 코드와 함께 준다 */
  label: string;
  /**
   * 취소 오퍼레이션이 있는 유형이면 그 리소스. 없으면 `null` —
   * 계약의 취소 경로는 셋뿐이라 **덮는 여섯 유형 중 셋에는 취소가 없다.**
   */
  cancelResource: CancelResource | null;
  /** 고를 수 없는 유형의 사유(외주 2문서 — omf-mes#82). 고를 수 있으면 null */
  disabledReason: string | null;
}

/** 유형 표 — OpenAPI enum과 같은 9개만 둔다. */
export const DOCUMENT_TYPES: readonly DocumentTypeEntry[] = [
  { code: 'PURCHASE_ORDER', label: 'PURCHASE_ORDER', cancelResource: null, disabledReason: null },
  {
    code: 'INBOUND_RECEIPT',
    label: 'INBOUND_RECEIPT',
    cancelResource: 'inbound-receipts',
    disabledReason: null,
  },
  {
    code: 'GOODS_RECEIPT',
    label: 'GOODS_RECEIPT',
    cancelResource: 'goods-receipts',
    disabledReason: null,
  },
  {
    code: 'MATERIAL_ISSUE_REQUEST',
    label: 'MATERIAL_ISSUE_REQUEST',
    cancelResource: null,
    disabledReason: null,
  },
  { code: 'PICKING_ORDER', label: 'PICKING_ORDER', cancelResource: null, disabledReason: null },
  { code: 'STOCK_TRANSFER', label: 'STOCK_TRANSFER', cancelResource: null, disabledReason: null },
  {
    code: 'SUBCONTRACT_ISSUE',
    label: 'SUBCONTRACT_ISSUE',
    cancelResource: null,
    disabledReason: null,
  },
  {
    code: 'SUBCONTRACT_RECEIPT',
    label: 'SUBCONTRACT_RECEIPT',
    cancelResource: null,
    disabledReason: null,
  },
  {
    code: 'GOODS_ISSUE',
    label: 'GOODS_ISSUE',
    cancelResource: 'goods-issues',
    disabledReason: null,
  },
];

/**
 * 값 목록이 아직 오지 않았는가.
 *
 * **표를 인자로 받는다.** 함수 안에서 상수를 직접 읽으면 「채워졌을 때 무엇이 달라지는가」를
 * 감지기가 잴 수 없어 그 자리가 죽은 가지가 된다 — 자리표시 규율의 핵심이 이 인자다.
 */
export const isDocumentTypeListPending = (entries: readonly DocumentTypeEntry[]): boolean =>
  entries.length === 0;

/** 표에서 그 코드의 줄을 찾는다. 없으면 null — 표에 없는 코드는 이 화면이 다루는 유형이 아니다. */
export const findDocumentType = (
  code: string,
  entries: readonly DocumentTypeEntry[],
): DocumentTypeEntry | null => entries.find((entry) => entry.code === code) ?? null;

/**
 * 조회에 쓸 수 있는 유형인가 — **표에 있고 고를 수 있는** 줄만 돌려준다.
 *
 * 「표에 있는가」와 「고를 수 있는가」를 한 자리에서 함께 판정하는 이유는, 갈리면 손으로 고친
 * 주소(`?ty=…`)가 **비활성 유형으로 조회를 내보내는** 길이 되기 때문이다. 비활성은 화면이
 * 정한 사실이므로 화면의 어느 경로에서도 같게 지켜져야 한다.
 */
export const findSelectableDocumentType = (
  code: string,
  entries: readonly DocumentTypeEntry[],
): DocumentTypeEntry | null => {
  const entry = findDocumentType(code, entries);

  if (entry === null) return null;

  return entry.disabledReason === null ? entry : null;
};

/**
 * 이 유형의 취소가 **어느 계약 경로로 나가는가.** 없으면 `null` — 그러면 취소 조작이 서지 않는다.
 *
 * ⭐ **표를 인자로 받는다**(자리표시 규율). 함수 안에서 상수를 읽으면 「표를 채우면 취소가
 * 살아난다」를 감지기가 잴 수 없다.
 *
 * ⭐ **고를 수 있는 줄에서만 읽는다** — 목록·상세와 **같은 잣대**다(`findSelectableDocumentType`).
 * 갈리면 손으로 고친 주소(`?ty=…`)가 **비활성 유형으로 취소 요청을 내보내는** 길이 된다.
 * 비활성은 화면이 정한 사실이므로 화면의 어느 경로에서도 같게 지켜져야 한다.
 */
export const cancelResourceOf = (
  code: string,
  entries: readonly DocumentTypeEntry[],
): CancelResource | null => findSelectableDocumentType(code, entries)?.cancelResource ?? null;

/**
 * 표를 선택지로 옮긴다.
 *
 * **차례를 바꾸지 않는다.** 값이 어떤 차례로 오는지가 뜻일 수 있다(업무 흐름 순서 등).
 *
 * **고를 수 없는 유형을 목록에서 빼지 않는다.** 빼면 「왜 그 유형이 없는지」를 화면 어디에서도
 * 읽을 수 없다 — 두되 비활성하고, 사유는 조건 줄이 글자로 낸다.
 */
export const toDocumentTypeOptions = (entries: readonly DocumentTypeEntry[]): SelectOption[] =>
  entries.map((entry) => ({
    value: entry.code,
    label: entry.label,
    ...(entry.disabledReason === null ? {} : { disabled: true }),
  }));

/**
 * 고를 수 없는 유형의 사유를 한 줄로 모은다. 없으면 `undefined` —
 * 빈 안내를 그리면 이유 없이 공간만 차지한다.
 *
 * **이름과 사유를 함께 낸다.** 사유만 내면 어느 유형이 막힌 것인지 알 수 없고,
 * 이름만 내면 왜 막혔는지 알 수 없다.
 *
 * **줄 사이를 가운뎃점으로 가른다.** 공백 하나로 이으면 둘 이상 막혔을 때 앞 사유의 끝과 뒤
 * 이름의 시작이 한 문장처럼 붙어 읽힌다 — 지금은 막히는 유형이 둘뿐이라 잘 드러나지 않지만,
 * 경계가 보이지 않는 것은 값이 늘 때 조용히 나빠지는 자리다.
 */
export const describeDisabledTypes = (
  entries: readonly DocumentTypeEntry[],
): string | undefined => {
  const blocked = entries.filter((entry) => entry.disabledReason !== null);

  if (blocked.length === 0) return undefined;

  return blocked.map((entry) => `${entry.label}: ${entry.disabledReason ?? ''}`).join(' · ');
};
