import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { isCountUom, parseQtyInput } from '../../patterns/package-qty';
import type { SplitLookupLocation } from './queries';

/**
 * P-04-08 의 판정과 문구 고르기 — 화면에서 떼어 시험한다.
 *
 * ⭐ 막는 조건은 서버가 정한다(조회의 `blocked` · 분리 409 `code`). 화면은 code 로 문구만 고른다(research R-8).
 */
/* 부를 때 읽는다 — 단말 언어(`setLocale`)를 모듈이 실릴 때 붙잡지 않는다. */
const words = () => messages.productLotSplit;

/** 막힌 이유 code 9종(조회 LOT 단위 6 + 위치 단위 3). `SEMI_FINISHED_LOT` 은 공정 반제품(피처 016). */
export const SPLIT_BLOCK_CODES = [
  'SEMI_FINISHED_LOT',
  'NOT_PRODUCTION_LOT',
  'SPLIT_SERIAL_LOT',
  'INVALID_STATE',
  'LOT_SPLIT_UNCONFIRMED',
  'LOT_ALREADY_RESERVED',
  'PUTAWAY_PENDING',
  'NOT_PRODUCT_WAREHOUSE',
  'MIXED_STOCK_STATUS',
] as const;

export type SplitBlockCode = (typeof SPLIT_BLOCK_CODES)[number];

export const isSplitBlockCode = (code: string | undefined): code is SplitBlockCode =>
  code !== undefined && (SPLIT_BLOCK_CODES as readonly string[]).includes(code);

export interface BlockView {
  title: string;
  body: string;
}

/** 분리 시각(공장 시각) `MM-DD HH:mm`. 못 읽으면 받은 그대로. */
export const shortAt = (value: string): string => (formatPlantDateTime(value) ?? value).slice(5);

/**
 * 막힌 이유 → 제목 한 줄 + 할 일 한 줄. `detail` 은 조회가 실어 주는 값(상태 · 분리 시각 · 지시서 번호)이고
 * 분리 409 에는 없다 — 그때는 값 없는 문구를 쓴다.
 */
export const blockViewOf = (code: string | undefined, detail: string | null = null): BlockView => {
  const t = words();

  switch (code) {
    case 'INVALID_STATE': {
      const state = detail === null ? '' : (t.blocked.states[detail] ?? detail);
      return {
        title:
          state === ''
            ? t.blocked.INVALID_STATE.titleNoState
            : t.blocked.INVALID_STATE.title(state),
        body: t.blocked.INVALID_STATE.body,
      };
    }
    case 'LOT_SPLIT_UNCONFIRMED':
      return {
        title: t.blocked.LOT_SPLIT_UNCONFIRMED.title,
        body:
          detail === null
            ? t.blocked.LOT_SPLIT_UNCONFIRMED.bodyNoTime
            : t.blocked.LOT_SPLIT_UNCONFIRMED.body(shortAt(detail)),
      };
    case 'LOT_ALREADY_RESERVED':
      return {
        title: t.blocked.LOT_ALREADY_RESERVED.title,
        body:
          detail === null
            ? t.blocked.LOT_ALREADY_RESERVED.bodyNoRequest
            : t.blocked.LOT_ALREADY_RESERVED.body(detail),
      };
    case 'SEMI_FINISHED_LOT':
    case 'NOT_PRODUCTION_LOT':
    case 'SPLIT_SERIAL_LOT':
    case 'PUTAWAY_PENDING':
    case 'NOT_PRODUCT_WAREHOUSE':
    case 'MIXED_STOCK_STATUS':
      return t.blocked[code];
    default:
      return t.blocked.unknown;
  }
};

/** 서버 거절에서 업무 code 를 꺼낸다 — 409 는 충돌 봉투(`conflict`)나 몸체만(`http`) 둘 다로 온다. */
export const conflictCodeOf = (error: ApiError): string | undefined =>
  error.kind === 'conflict' || error.kind === 'http' ? error.code : undefined;

/** 분리 409 가 실은 문구 값 — 스캔 조회의 `blocked.detail` 과 같은 값이다. 없으면 null. */
export const conflictDetailOf = (error: ApiError): string | null =>
  (error.kind === 'conflict' || error.kind === 'http') && error.detail !== undefined
    ? error.detail
    : null;

/** 400 RANGE — 수량 범위 밖(서버 판정). 화면 판정과 같은 문구로 보인다. */
export const isRangeRejection = (error: ApiError): boolean =>
  error.kind === 'validation' && error.errors.some((item) => item.code === 'RANGE');

export type QtyProblem = 'range' | 'integer';

/**
 * 수량 칸 판정 — 0 < 수량 < 그 위치 보유, 정수 단위(EA)는 정수만. 비었으면 판정하지 않는다(null · 단추만 꺼짐).
 * 서버가 다시 본다(400 RANGE) — 화면 판정은 누르기 전에 알리는 것뿐이다.
 */
export const qtyProblemOf = (
  text: string,
  location: SplitLookupLocation | null,
  uomCode: string | null,
): QtyProblem | null => {
  const qty = parseQtyInput(text);
  if (qty === null || location === null) return null;
  if (isCountUom(uomCode) && !Number.isInteger(qty)) return 'integer';
  if (!(qty > 0) || !(qty < location.onHandQty)) return 'range';

  return null;
};

/** 위치 타일을 고를 수 있는가 — 서버의 `selectable` 그대로(LOT · 위치 막힘을 함께 본 값). */
export const selectableLocations = (
  locations: readonly SplitLookupLocation[],
): SplitLookupLocation[] => locations.filter((location) => location.selectable);

/**
 * 처음 고를 위치 — 고를 수 있는 위치가 하나뿐이면 그것(시안 「하나면 자동 선택」). 둘 이상이면 작업자가 고른다.
 */
export const initialLocationId = (locations: readonly SplitLookupLocation[]): number | null => {
  const selectable = selectableLocations(locations);

  return selectable.length === 1 ? (selectable[0]?.locationId ?? null) : null;
};

/**
 * 위치 타일 이름 — 서버가 창고마다 두는 적치 대기 자리(`systemRoleCode` PUTAWAY_STAGING)는 시스템 코드 대신
 * 「적치 대기」(공용 이름, `patterns/system-location`).
 */
export const locationNameOf = (
  location: Pick<SplitLookupLocation, 'locationCode' | 'systemRoleCode'>,
): string =>
  location.systemRoleCode === 'PUTAWAY_STAGING'
    ? messages.warehouseLocation.values.systemRoles.PUTAWAY_STAGING
    : location.locationCode;

/** LOT 번호 끝 일곱 자 — 미리보기에서 원래 · 새 LOT 을 라벨과 대조하는 꼬리. */
export const lotTail = (lotNo: string): string =>
  lotNo.length <= 7 ? lotNo : `…${lotNo.slice(-7)}`;

/** 정수면 정수로, 소수면 받은 그대로 — 뺄셈의 부동소수 꼬리를 걷는다. */
export const subtractQty = (total: number, part: number): number =>
  Math.round((total - part) * 1_000_000) / 1_000_000;
