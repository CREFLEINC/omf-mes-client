import { AlertBanner, Button, Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';

import { toLookupDisplayState, type LookupSource } from '../../patterns/lookup-display';

import {
  PENDING_ISSUE_LIMIT,
  PENDING_WINDOW_DAYS,
  type PendingLine,
  type PendingList,
} from './pending-list';

const t = messages.goodsIssueQr.pending;

export interface PendingPaneProps {
  list: PendingList;
  itemNames: LookupSource;
  lotNames: LookupSource;
  uomNames: LookupSource;
  onPick: (goodsIssueId: number, goodsIssueLineId: number) => void;
  onRefresh: () => void;
}

/**
 * **QR 발행 대기 목록** — 자재창고 담당이 관리자 웹 없이 「무엇을 찍어야 하는가」를 본다
 * (사용자 요구 2026-09-16 · ISSUE-QR-01 D5).
 *
 * ⛔ **「대기 없음」을 완전한 사실로 말하지 않는다.** 이 목록은 최근 창 안에서만 완전하다
 *    (`pending-list.ts` 머리말 — 서버에 미발행 축이 없다). 창 밖의 오래된 미발행 건이 숨어
 *    있을 수 있으므로 **창을 늘 함께 적는다.** 적지 않으면 담당이 찍어야 할 것을 못 찍고도
 *    다 찍은 줄 안다.
 *
 * ⚠ **번호 대신 이름을 쓴다.** 품목·LOT·단위는 다른 조회가 풀어 주고, 못 풀었으면 그 사실을
 *   말한다 — 내부 채번을 대신 찍지 않는다(저장소 공통 규율).
 */
export const PendingPane = ({
  list,
  itemNames,
  lotNames,
  uomNames,
  onPick,
  onRefresh,
}: PendingPaneProps) => {
  /* ⭐ 발행 여부 탭(사용자 지시 2026-09-21) — P-01-01 과 같은 짜임이다. */
  const [view, setView] = useState<'unissued' | 'issued'>('unissued');
  const rows = view === 'issued' ? list.issuedLines : list.lines;

  const label = (source: LookupSource, value: number): string => {
    const state = toLookupDisplayState(source, value);

    return state.kind === 'named' ? state.label : messages.common.reference.unknown;
  };

  const columns: Column<PendingLine>[] = [
    { key: 'goodsIssueNo', header: t.columnIssueNo, render: (row) => row.goodsIssueNo },
    {
      key: 'lineNo',
      header: t.columnLine,
      align: 'center',
      render: (row) => String(row.line.lineNo),
    },
    { key: 'item', header: t.columnItem, render: (row) => label(itemNames, row.line.itemId) },
    { key: 'lot', header: t.columnLot, render: (row) => label(lotNames, row.line.lotId) },
    {
      key: 'qty',
      header: t.columnQty,
      align: 'center',
      render: (row) => `${String(row.line.issueQty)} ${label(uomNames, row.line.uomId)}`,
    },
    {
      key: 'status',
      header: t.columnStatus,
      align: 'center',
      render: (row) =>
        row.reason.kind === 'notIssued' ? (
          <Chip variant="status" size="md" status="info">
            {t.statusNotIssued}
          </Chip>
        ) : row.reason.kind === 'issued' ? (
          /* 이미 찍힌 라인 — 다시 찍으려면 재발행 사유가 필요하다. */
          <Chip variant="status" size="md" status="success">
            {t.statusIssued(row.reason.issueCount)}
          </Chip>
        ) : (
          /* ⚠ 인쇄 실패는 **경고**다 — 기록은 남았는데 현장에 라벨이 없다. */
          <Chip variant="status" size="md" status="warning">
            {t.statusPrintFailed(row.reason.issueCount)}
          </Chip>
        ),
    },
    {
      key: 'pick',
      header: t.columnAction,
      align: 'center',
      /* ⭐ 단추 폭만큼만 잡아 남는 폭을 다른 열에 나눠 준다(사용자 지시 2026-09-17). */
      width: '9rem',
      render: (row) => (
        <Button
          variant="outlined"
          size="md"
          className="pop-touch-target"
          onClick={() => {
            onPick(row.goodsIssueId, row.line.goodsIssueLineId);
          }}
        >
          {t.pick}
        </Button>
      ),
    },
  ];

  return (
    <section className="pop-section pop-giqr-pending-pane" aria-label={t.sectionLabel}>
      {/*
       * ⭐ **`pane-title` 은 감싸는 줄이 지닌다 — 표제가 아니라**(전례 `pop-repack-head`).
       *
       * 구획의 붙박이 표제 규칙(`pop.css` 의 `.pop-section > .pane-title:first-child`)은
       * **구획의 직계 자식**만 겨냥한다. 표제를 줄 안에 감싸 두고 표제에 이름을 달면 그
       * 규칙이 닿지 않아, 이 구획의 표제만 홀로 안쪽으로 들여쓰고 굴려도 따라오지 않는다.
       */}
      <div className="pane-title pop-giqr-pending-head">
        <h2>{t.sectionLabel}</h2>
        <Button variant="outlined" size="md" className="pop-touch-target" onClick={onRefresh}>
          {t.refresh}
        </Button>
      </div>

      {/* ⚠ 창을 늘 적는다 — 「없다」와 「창 밖에 있다」가 같아 보이면 안 된다. */}
      <p className="field-note">{t.window(PENDING_WINDOW_DAYS, PENDING_ISSUE_LIMIT)}</p>

      {/*
       * ⭐ **발행 여부로 목록을 가른다**(사용자 지시 2026-09-21 · 자재 LOT 라벨 발행과 같은 모양).
       *    찍은 라인이 목록에서 빠지면 라벨이 찢어졌을 때 다시 찍을 길이 없다.
       */}
      <div
        className="pop-material-lot-filter pop-giqr-pending-filter"
        role="group"
        aria-label={t.filter.label}
      >
        {(['unissued', 'issued'] as const).map((each) => (
          <button
            key={each}
            type="button"
            className={`pop-material-lot-filter-item ${popTouchClass('normal')}`}
            aria-pressed={view === each}
            onClick={() => {
              setView(each);
            }}
          >
            {t.filter[each]}
          </button>
        ))}
      </div>

      {list.isError ? (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.failed}</AlertBanner>
        </div>
      ) : list.isLoading ? (
        <p className="field-note">{t.loading}</p>
      ) : rows.length === 0 ? (
        <p className="field-note">
          {view === 'issued'
            ? t.issuedEmpty
            : list.issuedCount === 0
              ? t.empty
              : t.allIssued(list.issuedCount)}
        </p>
      ) : (
        <Table
          density="compact"
          getRowId={(row: PendingLine) => String(row.line.goodsIssueLineId)}
          columns={columns}
          rows={[...rows]}
        />
      )}

      {/* 창 밖에 더 있다는 사실 — 목록이 다 보여 준 것이 아니다. */}
      {list.truncated && <p className="field-note">{t.truncated}</p>}
    </section>
  );
};
