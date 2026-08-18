import { Button, type Column, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeActualQty, describeBookQty, describeQty } from './balances';
import {
  describeReference,
  toReference,
  type LotLookupResult,
  type ReferenceSource,
} from './lookups';
import { formatDateTime, type AdjustmentDetailView, type AdjustmentLineView } from './types';

const t = messages.stockAdjust;

/** `.wide-table`이 이 표에도 같은 최소 폭을 준다 — **표마다 자기 상수를 갖는다**. */
export const HISTORY_LINE_TABLE_MIN_WIDTH_PX = 928;

/** 「코드 · 이름」이 접히지 않고 한 줄에 들어가는 폭 — 흡수 열의 예산이다. */
export const HISTORY_LINE_ABSORBING_COLUMN_BUDGET_PX = 184;

/**
 * 이력 상세에서 장부는 **묻지 않은 상태로 고정이다.**
 *
 * 계약의 조정 라인이 차이 수량만 주고(실측) 지금 잔액을 불러 채우면 **조정 시점의 장부가 아닌
 * 값**이 그 자리에 선다 — 그 수로 파생한 실물은 사용자가 확인한 적 없는 값이다.
 * 표기를 지어내는 대신 **조정 대상 표와 같은 표기 함수**를 지나게 해 「—」로 세운다.
 *
 * **참조를 매 렌더 새로 만들지 않는다** — 이 값을 의존성에 둔 계산이 멈추지 않는다.
 */
const UNKNOWN_BOOK_QTY = { kind: 'notAsked' } as const;
const UNKNOWN_ACTUAL_QTY = { kind: 'unknown' } as const;

export interface HistoryLineColumnsInput {
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  lotLookup: LotLookupResult;
}

/**
 * 이력 상세의 라인 열 구성 — **조정 대상 표와 같은 「장부 · 실물 · 차이」 세 열이다**
 * (조심 ③ · C44).
 *
 * ⭐ **세 열을 그대로 둔다.** 장부와 실물이 늘 「—」인데도 열을 두는 이유는, 두 탭이 같은 읽기
 * 규칙을 유지해야 **차이가 결과 수량으로 읽히지 않기** 때문이다. 차이 하나만 남기면 그 수가
 * 「조정 뒤의 수량」으로 읽히는 길이 열린다 — 이 화면이 가장 비싸게 막아 온 오해다.
 *
 * **위치 열이 없다.** 위치 이름은 창고를 알아야 풀 수 있는데(계약이 위치 조회에 창고를 필수로
 * 요구한다) 조정 전표에는 창고가 없다 — 번호를 대신 낼 수는 없으므로(`omf-mes#44`) 열을 두지
 * 않고 그 사정을 표 아래 안내가 밝힌다.
 *
 * 열 폭의 도출(흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 줄 | 64px | 서버가 부여한 줄번호 |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 자재 LOT | 136px | LOT 번호 |
 * | 장부 | 112px | 수 + 단위 표기(지금은 「—」) |
 * | 실물 | 112px | 같은 위 |
 * | 차이 | 112px | 수 + 단위 표기 · **음수가 정상이다** |
 * | **지정 폭 합** | **536px** | |
 * | 흡수 열 예산 | 184px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **720px** | `58rem`(928px) 안에 든다 |
 */
export const buildHistoryLineColumns = ({
  itemLookup,
  uomLookup,
  lotLookup,
}: HistoryLineColumnsInput): Column<AdjustmentLineView>[] => {
  /**
   * 단위 이름. **못 풀었으면 빈 글자다** — 「알 수 없음」을 단위 자리에 붙이면 수량이 잘못된
   * 것처럼 읽힌다(조정 대상 표와 같은 규율).
   */
  const uomNameOf = (row: AdjustmentLineView): string => {
    const state = toReference(uomLookup, row.uomId);

    return state.kind === 'named' ? state.label : '';
  };

  return [
    { key: 'lineNo', header: t.historyLineTable.lineNo, width: '64px' },
    {
      key: 'item',
      header: t.historyLineTable.item,
      render: (row) => describeReference(toReference(itemLookup, row.itemId)),
    },
    {
      key: 'lot',
      header: t.historyLineTable.lot,
      width: '136px',
      /* LOT이 없는 품목이 실재한다 — 없는 것과 못 푼 것을 가른다. */
      render: (row) =>
        row.lotId === null ? t.values.empty : describeReference(toReference(lotLookup, row.lotId)),
    },
    {
      key: 'bookQty',
      header: t.historyLineTable.bookQty,
      width: '112px',
      render: (row) => describeBookQty(UNKNOWN_BOOK_QTY, uomNameOf(row)),
    },
    {
      key: 'actualQty',
      header: t.historyLineTable.actualQty,
      width: '112px',
      render: (row) => describeActualQty(UNKNOWN_ACTUAL_QTY, uomNameOf(row)),
    },
    {
      key: 'adjustmentQty',
      header: t.historyLineTable.adjustmentQty,
      width: '112px',
      /* ⭐ 음수가 정상이다(조심 ② · D-4) — 부호를 다듬지 않고 서버가 준 값을 그대로 낸다. */
      render: (row) => describeQty(row.adjustmentQty, uomNameOf(row)),
    },
  ];
};

/** ERP 적재 표기 — **세 갈래다.** 값이 오지 않는 갈래를 거짓으로 접지 않는다(계약 선택 필드). */
export const describeErp = (erpMessageQueued: boolean | null): string => {
  if (erpMessageQueued === null) return t.result.erpUnknown;

  return erpMessageQueued ? t.result.erpQueued : t.result.erpNotQueued;
};

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface HistoryDetailPaneProps {
  detail: AdjustmentDetailView;
  /**
   * 대상 실사의 이름. **참조 자체가 아니라 이름만 받는다** — 번호를 문자열로 만드는 자리가
   * 이 부품에 없다(`omf-mes#44`). 참조가 아예 없는 줄은 화면이 「—」를 넘긴다.
   */
  countName: string;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  lotLookup: LotLookupResult;
  /** 이름 풀이가 실패했는가. **복구 수단은 그 실패가 보이는 자리에 있어야 한다** */
  hasReferenceError: boolean;
  onRetryReferences: () => void;
}

/**
 * 고른 조정 전표의 상세 — **머리와 라인이 한 요청으로 온다**(C44).
 *
 * **코드를 뜻으로 옮기지 않는다**(공유계약 G-2). 사유·상태의 값 목록이 확정되지 않아 화면이
 * 뜻을 붙이면 값이 정해질 때 조용히 틀린다 — 서버가 준 글자를 그대로 낸다.
 *
 * ⛔ **승인·반려 조작이 없다**(조심 ① · D-3 · C42). 되찾아 읽는 자리이고, 결재는 결재함이
 * 소유한다. **결재 진행도 그리지 않는다** — 이 구획이 답하는 물음은 「무엇을 얼마나 조정했나」다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const HistoryDetailPane = ({
  detail,
  countName,
  itemLookup,
  uomLookup,
  lotLookup,
  hasReferenceError,
  onRetryReferences,
}: HistoryDetailPaneProps) => {
  const { summary, lines } = detail;

  const summaryItems: SummaryItem[] = [
    {
      key: 'inventoryAdjustmentNo',
      label: t.historySummary.inventoryAdjustmentNo,
      value: summary.inventoryAdjustmentNo,
    },
    { key: 'countRef', label: t.historySummary.countRef, value: countName },
    { key: 'reason', label: t.historySummary.reason, value: summary.reasonCode },
    { key: 'status', label: t.historySummary.status, value: summary.statusCode },
    {
      key: 'adjustedAt',
      label: t.historySummary.adjustedAt,
      /* **전기 여부의 판정 근거가 이 값의 유무 하나다**(C35) — 상태 코드를 읽지 않는다. */
      value:
        summary.adjustedAt === null ? t.historyTable.notPosted : formatDateTime(summary.adjustedAt),
    },
    { key: 'erp', label: t.historySummary.erp, value: describeErp(summary.erpMessageQueued) },
    {
      key: 'lineCount',
      label: t.historySummary.lines,
      /* **표의 줄 수와 같은 수다** — 두 자리에서 각자 세면 갈릴 자리가 생긴다. */
      value: t.historySummary.lineCount(lines.length),
    },
  ];

  return (
    <>
      {/*
       * 값 표기다 — 폼 컨트롤을 잠그지 않는다. `role="group"`을 명시해 제목줄 전체가 하나의
       * 이름을 갖게 한다.
       */}
      <div role="group" aria-label={t.historySummary.label}>
        <dl className="filter-bar">
          {summaryItems.map((item) => (
            <div className="field-cell" key={item.key}>
              <dt className="field-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="wide-table">
        <Table
          density="compact"
          columns={buildHistoryLineColumns({ itemLookup, uomLookup, lotLookup })}
          rows={lines}
          /* 미지정이면 인덱스가 React key가 되어 다른 전표를 고를 때 앞 줄이 남아 보인다. */
          getRowId={(row) => String(row.inventoryAdjustmentLineId)}
        />
      </div>

      {/*
       * **두 열이 비는 이유와 없는 열의 이유를 함께 적는다.** 값을 지어내지 않는 대신 왜
       * 없는지를 말해야, 사용자가 화면이 빠뜨린 것으로 읽지 않는다.
       */}
      <p className="field-note">{t.historyLineTable.qtyNote}</p>
      <p className="field-note">{t.historyLineTable.locationNote}</p>

      {/*
       * **말하는 셋과 되살리는 셋이 같다.** 등록 탭의 문구는 넷을 말하는데 이 구획에는 위치
       * 열이 없다 — 넷을 말하면 여기 있지도 않은 것을 가리키게 된다.
       */}
      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.historyReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
