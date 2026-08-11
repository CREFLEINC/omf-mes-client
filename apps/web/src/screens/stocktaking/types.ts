import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * W-01-04 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **실사 전표를 읽고 쓴다.** 읽기는 `GET /inventory/counts`·같은 경로의 상세와
 * `/lines`·창고·위치이고, 쓰기는 개시·라인 치환·마감 셋이다(PR ②~④).
 * **이 PR은 읽기까지다** — 쓰기 요청을 만드는 자리가 이 슬라이스에 아직 없다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type InventoryCountResponse = components['schemas']['InventoryCount'];
type InventoryCountSummaryResponse = components['schemas']['InventoryCountSummary'];
type InventoryCountLineResponse = components['schemas']['InventoryCountLine'];
type InventoryCountDetailResponse = components['schemas']['InventoryCountDetailResponse'];

export type PageMeta = components['schemas']['PageMeta'];

const t = messages.stocktaking;

/**
 * 화면이 다루는 실사 전표 한 건.
 *
 * **계약 응답의 값을 전부 옮긴다** — 이 스키마는 필드가 일곱뿐이고 그중 여섯이 화면에 보인다.
 * `warehouseId`는 이름을 푸는 열쇠이고 화면에 그대로 나오지 않는다(#44).
 *
 * `statusCode`는 **표시용일 뿐 분기용이 아니다**(계획 결정 2 · 공유계약 G-2). 값 집합이
 * 확정되지 않아 화면이 값으로 단계를 판정하면 값이 정해질 때 조용히 틀린다.
 */
export interface CountView {
  inventoryCountId: number;
  inventoryCountNo: string;
  countTypeCode: string;
  warehouseId: number;
  plannedDate: string;
  blindCount: boolean;
  statusCode: string;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toCountView = (data: InventoryCountResponse): CountView => ({
  inventoryCountId: data.inventoryCountId,
  inventoryCountNo: data.inventoryCountNo,
  countTypeCode: data.countTypeCode,
  warehouseId: data.warehouseId,
  plannedDate: data.plannedDate,
  blindCount: data.blindCount,
  statusCode: data.statusCode,
});

/**
 * 실사 진행 요약 — **서버가 계산해 상세 응답에 함께 내려준다**(착수 이슈 §6 ⭐).
 *
 * 화면은 이 넷을 **세지 않는다.** 창고 하나의 라인이 수백~수천 건이라 전 라인을 받아 세면
 * 쪽과 어긋나고, 라인 목록의 `page.total`로 대신해도 위치로 좁혀 받은 수라 합계가 다르다.
 */
export interface CountSummaryView {
  plannedCount: number;
  countedCount: number;
  uncountedCount: number;
  varianceCount: number;
}

export const toCountSummaryView = (data: InventoryCountSummaryResponse): CountSummaryView => ({
  plannedCount: data.plannedCount,
  countedCount: data.countedCount,
  uncountedCount: data.uncountedCount,
  varianceCount: data.varianceCount,
});

/** 상세 응답 한 벌. 헤더와 요약이 **한 번의 조회로 함께 온다**. */
export interface CountDetailView {
  count: CountView;
  summary: CountSummaryView;
}

export const toCountDetailView = (data: InventoryCountDetailResponse): CountDetailView => ({
  count: toCountView(data.inventoryCount),
  summary: toCountSummaryView(data.summary),
});

/**
 * **계약이 필수라고 말해도 런타임에 없을 수 있는 수량을 읽는다**(계획 결정 4 · 어긋남 1).
 *
 * 병합 스펙은 `systemQty`를 `required`에 두는데 그 설명은 「블라인드 실사에서는 내려보내지
 * 않는다」다. 타입을 믿고 그대로 쓰면 블라인드 응답에서 `undefined`가 수량 자리에 그려진다.
 *
 * **`??`를 쓰지 않는 이유**는 0 때문이다 — 계약이 `minimum: 0`이라 0은 정상 값이고,
 * `??`는 0을 통과시키지만 `||`는 뭉갠다. 여기서는 「수가 왔는가」만 본다.
 */
const readOptionalQty = (value: number | undefined): number | null =>
  typeof value === 'number' ? value : null;

/**
 * 화면이 다루는 실사 라인 한 줄.
 *
 * **카운트 시각(`countedAt`)·담당자(`countedBy`)를 담지 않는다**(계획 결정 9). 착수 이슈 §4가
 * 「카운트 시각 컬럼이 비지 않도록 설계돼 있어 그것만으로는 미실사를 판정할 수 없다」고 밝힌
 * 값이라, 표에 내면 사용자가 실사 여부로 읽는다. 타입에 자리를 두지 않으면 화면으로 샐 경로도 없다.
 * **요청에는 싣는다** — 계약 필수이며 그 조립은 PR ③에 있다.
 *
 * `systemQty`·`varianceQty`가 `null`이면 **보이지 않는 것**이고, 그것이 곧 블라인드 실사다.
 */
export interface CountLineView {
  inventoryCountLineId: number;
  lineNo: number;
  locationId: number;
  itemId: number;
  /** nullable — 값이 없으면 **빈 값이지 참조 실패가 아니다**(W-01-10 전례). */
  lotId: number | null;
  /** **블라인드에서는 오지 않는다.** `null`이 그 사실이다. */
  systemQty: number | null;
  countedQty: number;
  /** 서버가 계산한다(`readOnly`). 화면은 다시 계산하지 않는다. 블라인드에서는 `null`일 수 있다. */
  varianceQty: number | null;
  uomId: number;
  varianceReasonCode: string | null;
}

/** 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toCountLineView = (data: InventoryCountLineResponse): CountLineView => ({
  inventoryCountLineId: data.inventoryCountLineId,
  lineNo: data.lineNo,
  locationId: data.locationId,
  itemId: data.itemId,
  lotId: data.lotId ?? null,
  systemQty: readOptionalQty(data.systemQty),
  countedQty: data.countedQty,
  varianceQty: readOptionalQty(data.varianceQty),
  uomId: data.uomId,
  // `??`를 쓴다 — 빈 문자열은 서버가 보낸 값이라 `null`로 뭉개면 그 사실이 사라진다.
  varianceReasonCode: data.varianceReasonCode ?? null,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface CountListResult {
  items: CountView[];
  page: PageMeta;
}

/**
 * 쓰기 결과 — **슬롯 하나에 갈래 셋**(계획 결정 14).
 *
 * 쓰기가 셋이고(개시 · 위치 저장 · 마감) 결과도 셋인데, 화면에 구획을 셋 두면 셋이 동시에
 * 보이는 상태가 생긴다 — **어느 갈래가 보이는지 타입이 정하고** 새 결과가 앞 결과를 덮는다.
 * 수명 표의 「결과 구획」이 열 하나로 서는 근거도 이것이다.
 *
 * **이 PR에는 갈래가 하나뿐이다.** PR ③이 `saved`(치환한 줄 수), PR ④가 `closed`(상태 코드와
 * 요약)를 더한다 — 그때 `kind`로 가르는 자리가 `result-pane.tsx`에 생긴다. 지금 갈래를 미리
 * 세우지 않는 것은 쓰이지 않는 갈래가 먼저 서 있으면 어느 것이 실제로 나오는지 읽을 수 없기
 * 때문이다.
 *
 * **내부 번호를 담지 않는다**(#44). 만들어진 실사의 내부 번호는 화면이 주소(`ct`)로만 쓰며,
 * 이 타입에 자리가 없어 결과 구획으로 샐 경로가 없다.
 */
export type ResultView = { kind: 'opened'; countNo: string };

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부는 선택지를 거르는 데 쓰지 않고 표식을 붙이는 데 쓴다.** 지금은 쓰지 않는
 * 창고를 대상으로 한 과거 실사가 실제로 있고, 미사용 값을 빼면 그 실사를 조건으로 찾을 방법이 사라진다.
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

/** 값 목록이 확정되지 않은 코드 셋. 선택지와 자리표시는 `code-options.ts`가 소유한다. */
export type StocktakingCodeKey = 'countType' | 'status' | 'varianceReason';

/**
 * 블라인드 여부의 표기. **읽히는 말로 낸다** — `true`·`false`를 그대로 내면 값이 읽히지 않는다.
 *
 * 목록 표의 칸과 고른 실사의 제목줄이 **같은 함수**를 쓴다. 자리마다 따로 만들면 한쪽이
 * 「Y/N」이 되는 식으로 갈린다.
 */
export const describeBlindCount = (blindCount: boolean): string =>
  blindCount ? t.values.blindYes : t.values.blindNo;
