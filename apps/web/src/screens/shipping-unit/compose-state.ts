/**
 * P-04-05 의 **판단**만 모은 자리 — 무엇을 할 수 있고 무엇이 막혀 있는가.
 *
 * ⭐ **화면에서 떼어 둔다.** 이 화면은 되돌릴 수 없는 조작(마감)을 갖고 있어, 「지금 마감할 수
 *    있는가」를 렌더 코드 사이에 흩어 두면 그 판정을 시험이 못 붙든다. 순수 함수로 두면
 *    경계(상자 0개 · 이미 마감 · 만드는 중)를 낱낱이 밟을 수 있다.
 */

import { foldRows } from '../../patterns/label/fold';

import type { ShippingUnitDetail, ShippingUnitItemTotal } from './types';

/** 화면이 지금 하고 있는 일. 겹쳐 일어나지 않는다 — 한 번에 하나다. */
export type ComposeBusy = 'idle' | 'creating' | 'adding' | 'removing' | 'closing';

export interface ComposeState {
  /** 고른 출하. 고르기 전에는 `null` 이다. */
  shipmentId: number | null;
  /** 만든 출하 단위. 만들기 전에는 `null` 이다. */
  unit: ShippingUnitDetail | null;
  /** 만들 단위의 유형. 고르기 전에는 `null`. */
  typeCode: string | null;
  busy: ComposeBusy;
}

export const INITIAL_STATE: ComposeState = {
  shipmentId: null,
  unit: null,
  typeCode: null,
  busy: 'idle',
};

const isBusy = (state: ComposeState): boolean => state.busy !== 'idle';

const isOpen = (unit: ShippingUnitDetail | null): boolean => unit?.statusCode === 'OPEN';

/** 새 출하 단위를 만들 수 있는가 — 출하를 고르고 유형을 골랐을 때. */
export const canCreateUnit = (state: ComposeState): boolean =>
  !isBusy(state) && state.shipmentId !== null && state.typeCode !== null;

/**
 * 상자를 읽을 수 있는가.
 *
 * ⛔ **마감된 단위에는 못 넣는다.** 서버도 막지만(409), 칸을 열어 두면 담당이 읽고 나서야
 *    막힌 것을 안다 — 스캐너를 들고 상자 앞에 선 사람에게는 그 한 번이 큰 낭비다.
 */
export const canScanBox = (state: ComposeState): boolean => !isBusy(state) && isOpen(state.unit);

/** 상자를 뺄 수 있는가 — 마감 전에만(설계 §5-6). */
export const canRemoveBox = (state: ComposeState): boolean => canScanBox(state);

/**
 * 마감할 수 있는가.
 *
 * ⛔ **상자가 없으면 못 한다**(설계 §4-6 — 서버가 422). 화면이 먼저 막아, 되돌릴 수 없는
 *    조작을 눌렀다가 거절당하는 일을 없앤다.
 */
export const canClose = (state: ComposeState): boolean =>
  !isBusy(state) && isOpen(state.unit) && (state.unit?.boxes.length ?? 0) > 0;

/** 이미 마감했는가 — 그러면 다음 할 일은 「새 단위」다(설계 §5-5). */
export const isClosed = (state: ComposeState): boolean => state.unit?.statusCode === 'CLOSED';

/**
 * 이 상자가 이미 이 단위에 들어 있는가.
 *
 * ⭐ **같은 상자를 다시 읽는 일은 흔하다**(스캐너가 두 번 쏜다). 서버는 멱등으로 받지만
 *    (설계 §4-4), 화면이 먼저 알면 **쓸데없는 호출과 깜빡임을 줄인다.**
 */
export const hasBox = (state: ComposeState, handlingUnitNo: string): boolean =>
  (state.unit?.boxes ?? []).some((box) => box.handlingUnitNo === handlingUnitNo.trim());

/** 미리보기에 세울 품목 줄 수. 라벨과 **같은 수**여야 한다 — 본 것과 나온 것이 갈리면 안 된다. */
export const PREVIEW_ITEM_ROWS = 3;

export interface PreviewRows {
  shown: ShippingUnitItemTotal[];
  hidden: number;
}

/**
 * 미리보기의 품목별 합.
 *
 * ⛔ **화면이 합하지 않는다.** 서버가 준 `itemTotals` 를 그대로 접어 보인다 — 받은 상자 목록을
 *    세면 목록이 일부일 때 **화면과 라벨이 다른 수를 말한다.**
 */
export const previewRows = (unit: ShippingUnitDetail | null): PreviewRows =>
  foldRows(unit?.itemTotals ?? [], PREVIEW_ITEM_ROWS);
