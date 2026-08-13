import { messages } from '@omf-mes/i18n';

import type { BalanceView, ReceiptLineView } from './types';

/**
 * **폐기 수량의 상한을 정하는 유일한 자리**(계획 결정 4 · 완료 조건 C22~C24 · 감지기 M22·M31).
 *
 * 잔액 응답을 그 줄의 자재 LOT에 맞추고 **확인한 것과 확인하지 못한 것을 가른다.**
 * 상한이 여러 자리에서 따로 계산되면 표시와 저장 판정이 갈리는데, 이 화면에서 그 어긋남은
 * **잘못된 수량으로 승인까지 올라간 폐기 품의**로 남는다.
 *
 * ---
 *
 * **상한이 위치까지 좁혀지지 않는다는 한계를 밝힌다**(계획 결정 4 · 질문 게시).
 * `/inventory/balances`는 `groupBy` 축 **하나만** 채워 내리므로 LOT으로 묶으면 위치 축이
 * 접힌다. 그래서 이 상한은 **그 창고 그 LOT의 합계**이고, 같은 LOT이 두 위치에 나뉘어 있으면
 * 화면 상한이 실제보다 **느슨하다.** 느슨한 쪽이 안전하다 — 화면이 정당한 폐기를 막지 않고,
 * 초과분은 서버가 400으로 되돌린다(되돌릴 수 있는 실패다).
 *
 * **가용 수량을 쓰지 않는다**(감지기 M22). `availableQty`는 보유에서 예약·피킹·**보류**를 뺀
 * 값인데, 폐기 대상은 바로 그 **보류·차단된 재고**일 가능성이 크다 — 상한으로 쓰면
 * **폐기해야 할 것을 막는다.** 화면 타입에 그 자리조차 두지 않았다(`types.ts`).
 *
 * **창고는 「고른 전표의 창고」다.** 조건 줄의 창고가 아니다 — 조건 줄은 비어 있을 수 있고,
 * 값 목록이 확정되면 그 선택지가 폐기 대상 유형으로 **좁혀진다**(PR ①의 좁힘). 좁힌 조건을
 * 잔액의 축으로 쓰면 좁힘 밖 창고의 전표를 골랐을 때 남의 창고 잔액이 상한이 된다.
 * 이 파일은 그 창고를 받지 않고, 부르는 자리(`queries.ts`)가 상세 응답의 창고를 쓴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.disposalIssue;

/** 품목 하나의 잔액 조회 결과. **품목마다 한 번씩 부르므로 상태도 품목마다 갈린다.** */
export interface ItemBalance {
  itemId: number;
  entries: readonly BalanceView[];
  isLoading: boolean;
  isError: boolean;
  /** 그 품목의 잔액을 **전부 받지는 못했다.** 합계가 실제보다 적을 수 있다. */
  truncated: boolean;
}

/**
 * 잔액 조회 전체.
 *
 * **품목별로 나눠 들고 있는 것이 요점이다.** 한 품목의 실패를 전체 실패로 뭉치면 멀쩡히 받은
 * 품목의 줄까지 상한을 잃는다 — 그 줄들은 화면이 막아 줄 수 있는데도 못 막게 된다.
 * 표 아래 안내와 복구 버튼만 「하나라도」를 본다.
 */
export interface BalanceSource {
  items: readonly ItemBalance[];
  /** 하나라도 실패했는가 — 표 아래 사유와 「다시 시도」가 쓴다. */
  isError: boolean;
  /** 하나라도 잘렸는가 — 표 아래 사유가 쓴다(복구 버튼은 붙이지 않는다). */
  truncated: boolean;
}

/**
 * 왜 상한을 확인하지 못했는가.
 *
 * **화면에는 네 갈래를 한 문구(「확인하지 못함」)로 낸다** — 사용자가 할 조치가 같기 때문이다
 * (그대로 보내면 서버가 판정한다). 갈래를 타입에 남기는 것은 표 아래 안내가 **왜 그런지**를
 * 갈라 말하기 위해서이고, 무엇보다 **실패를 「목록에 없음」으로 뭉개지 않기** 위해서다
 * (`omf-mes#47`).
 */
export type OnHandUnknownReason = 'failed' | 'truncated' | 'notFound' | 'uomMismatch';

/**
 * 그 줄의 보유 수량.
 *
 * **세 갈래다**(감지기 M23) — 확인함 · 아직 오지 않음 · 확인하지 못함. 못 구한 것을 `0`이나
 * `Infinity`로 읽으면 정당한 폐기를 막거나 상한이 아예 없어진다.
 */
export type OnHand =
  | { kind: 'known'; qty: number; uomId: number }
  | { kind: 'loading' }
  | { kind: 'unknown'; reason: OnHandUnknownReason };

/**
 * 그 줄의 보유 수량을 잔액 응답에서 찾는다.
 *
 * 순서가 뜻을 정한다 — **실패 · 미도착 · 잘림이 「목록에 없음」보다 앞선다.** 못 받았거나 덜
 * 받은 목록으로 「그 LOT이 없다」를 판정하면, 정상 잔액이 있는 줄에 「확인하지 못함」이 아니라
 * 실은 더 나쁜 판정(0으로 읽어 막기)이 붙을 길이 열린다.
 */
export const toOnHand = (source: BalanceSource, line: ReceiptLineView): OnHand => {
  const item = source.items.find((candidate) => candidate.itemId === line.itemId);

  /* 그 품목의 조회가 아직 만들어지지도 않았다 — 「없다」가 아니라 「아직」이다. */
  if (item === undefined) return { kind: 'loading' };
  if (item.isError) return { kind: 'unknown', reason: 'failed' };
  if (item.isLoading) return { kind: 'loading' };
  if (item.truncated) return { kind: 'unknown', reason: 'truncated' };

  /*
   * **축이 LOT인 줄만 본다.** 계약은 축을 한 번에 하나만 채워 내리는데 **목이 요청과 다른
   * 축의 줄을 돌려주는 것이 실측됐다.** 축이 `ITEM`인 줄은 그 품목의 **전 LOT을 합친 값**이라
   * 한 LOT의 상한으로 쓰면 상한이 실제보다 몇 배 느슨해진다 — 그 줄로 확인했다고 말하느니
   * 확인하지 못한 것으로 두는 편이 정확하고, 막지 않으므로 업무도 서지 않는다.
   */
  const rows = item.entries.filter(
    (entry) => entry.groupBy === 'LOT' && entry.lotId === line.lotId,
  );

  if (rows.length === 0) return { kind: 'unknown', reason: 'notFound' };

  /*
   * **단위가 다르면 견주지 않는다.** 화면에는 단위를 옮기는 수단이 없으므로, 다른 단위의
   * 수량을 상한으로 쓰면 100과 5를 비교하는 셈이 된다.
   */
  if (rows.some((row) => row.uomId !== line.uomId)) {
    return { kind: 'unknown', reason: 'uomMismatch' };
  }

  return {
    kind: 'known',
    qty: rows.reduce((sum, row) => sum + row.onHandQty, 0),
    uomId: line.uomId,
  };
};

/**
 * 상한 판정 결과. **「막지 않는다」와 「재지 못했다」를 가른다** — 둘을 뭉치면 상한을 못 구한
 * 줄이 「통과했다」로 읽혀, 화면이 확인한 적 없는 것을 확인한 척하게 된다.
 */
export type QtyLimit =
  | { kind: 'within' }
  | { kind: 'over'; message: string }
  | { kind: 'unmeasured' };

/**
 * 친 수량이 상한 안인가.
 *
 * **확인하지 못한 줄은 막지 않는다**(계획 결정 4 · 완료 조건 C24). 상한은 보조 정보이고 최종
 * 판정은 서버가 한다 — 잔액 조회가 실패했다고 폐기 업무 전체를 세우면, LOT이 많은 창고에서는
 * 정당한 폐기가 영영 불가능해진다. 초과분은 400으로 되돌아오며 그 실패는 되돌릴 수 있다.
 */
export const checkQtyLimit = (qty: number, onHand: OnHand): QtyLimit => {
  if (onHand.kind !== 'known') return { kind: 'unmeasured' };
  if (qty <= onHand.qty) return { kind: 'within' };

  return { kind: 'over', message: t.errors.qtyOverOnHand(onHand.qty) };
};

/** 보유 수량 칸에 보이는 글자. 세 갈래의 문구가 서로 달라야 뜻이 구분된다. */
export const describeOnHand = (onHand: OnHand, uomName: string): string => {
  switch (onHand.kind) {
    case 'known':
      return t.lineTable.onHandQtyPair(onHand.qty, uomName);
    case 'loading':
      return t.values.onHandLoading;
    case 'unknown':
      return t.values.onHandUnknown;
  }
};
