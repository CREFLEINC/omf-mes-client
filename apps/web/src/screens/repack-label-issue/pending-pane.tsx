import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  PuButton,
  PuChip,
  PuEmpty,
  PuPager,
  useClientPage,
  useFitCount,
} from '../../patterns/pop-uniform';
import { ListOrderFoot, sortByTime, type ListOrder } from '../../patterns/pop-list-order';
import { PuSearchBox } from '../../patterns/pop-uniform/search-box';
import { localDateTimeText } from './formatting';
import type { PendingRepackRow } from './queries';

const t = messages.repackLabelIssue.pending;

export interface PendingPaneProps {
  rows: readonly PendingRepackRow[];
  selectedId: number | null;
  isLoading: boolean;
  isError: boolean;
  /**
   * 재발행 탭이면 찾기 칸 대신 `scan`(포장 라벨 스캔 칸)을 세우고, 줄에 발행 횟수를 보인다
   * (#295 시안).
   */
  scan?: ReactNode;
  disabled: boolean;
  onSelect: (row: PendingRepackRow) => void;
  onRetry: () => void;
}

/** 줄의 첫 글자 — 원 포장(합병은 `+` 로 잇는다). 재구성 사건을 못 찾은 줄은 번호와 사유. */
export const sourceTextOf = (row: PendingRepackRow): string =>
  row.repackEvent === 'none'
    ? t.noEvent(row.handlingUnitNo)
    : row.repackEvent === 'unmatched'
      ? t.unknownEvent(row.handlingUnitNo)
      : row.sourceNos.length === 0
        ? t.unknown
        : row.sourceNos.join(t.sourceJoin);

/** 찾기 칸: 새 포장 번호 · 원 포장 번호에 넣은 글자가 들어 있는 줄만 남긴다(화면 안 거르기). */
const matches = (row: PendingRepackRow, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (q === '') return true;

  return [row.handlingUnitNo, ...row.sourceNos].some((no) => no.toLowerCase().includes(q));
};

/**
 * 왼쪽 「발행 대기」 목록 — 자재 관리 LOT 라벨과 같은 카드 목록(#295 시안).
 * 목록은 서버가 한 번에 다 주므로(`labelIssued=false` 전 쪽) 화면이 구획 높이만큼 잘라 보인다.
 */
export const PendingPane = ({
  rows,
  selectedId,
  isLoading,
  isError,
  scan,
  disabled,
  onSelect,
  onRetry,
}: PendingPaneProps) => {
  const [query, setQuery] = useState('');
  const fitRef = useRef<HTMLDivElement>(null);
  const size = useFitCount(fitRef, { fallback: 4 });
  const isReissue = scan !== undefined;
  /* 재구성 일시로 [최신순 | 오래된순](사용자 지시 2026-11-19) — 처음은 최신순. */
  const [order, setOrder] = useState<ListOrder>('newest');
  const shown = sortByTime(
    isReissue ? rows : rows.filter((row) => matches(row, query)),
    order,
    (row) => row.occurredAt,
  );
  const page = useClientPage(shown, size);
  /* 스캔으로 고른 줄이 다른 쪽에 있으면 그 쪽을 보인다. */
  const selectedIndex = shown.findIndex((row) => row.handlingUnitId === selectedId);
  const { showIndex } = page;
  useEffect(() => {
    if (selectedIndex >= 0) showIndex(selectedIndex - (selectedIndex % Math.max(1, size)));
  }, [selectedIndex, showIndex, size]);
  const changeQuery = (next: string): void => {
    setQuery(next);
    page.setPage(1);
  };

  const body = ((): ReactNode => {
    if (isError) {
      return (
        <PuEmpty icon="bad" title={isReissue ? t.reissueLoadFailed : t.loadFailed}>
          <PuButton size="sm" onClick={onRetry}>
            {messages.common.retry}
          </PuButton>
        </PuEmpty>
      );
    }
    if (shown.length === 0) {
      if (isLoading) return <PuEmpty icon="list" title={t.loading} />;
      return !isReissue && query.trim() !== '' && rows.length > 0 ? (
        <PuEmpty icon="search" title={t.searchEmpty} />
      ) : (
        <PuEmpty icon="box" title={isReissue ? t.reissueEmpty : t.empty} />
      );
    }

    return null;
  })();

  return (
    <>
      {scan ?? (
        <PuSearchBox
          label={t.searchPlaceholder}
          title={t.searchTitle}
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={changeQuery}
        />
      )}
      {body ?? (
        <>
          <div
            ref={fitRef}
            className="pu-list pu-fit rpk-list"
            role="group"
            aria-label={isReissue ? t.reissueCaption : t.caption}
          >
            {page.items.map((row) => {
              const selected = row.handlingUnitId === selectedId;
              const sourceText = sourceTextOf(row);

              return (
                <button
                  key={row.handlingUnitId}
                  type="button"
                  className={selected ? 'pu-item is-selected' : 'pu-item'}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={t.selectRow(sourceText, row.handlingUnitNo)}
                  onClick={() => {
                    onSelect(row);
                  }}
                >
                  <span className="pu-item-top">
                    <span className="no" title={sourceText}>
                      {sourceText}
                    </span>
                    {row.repackTypeCode !== null && (
                      <span className="chips">
                        <PuChip tone="info">{t.repackType(row.repackTypeCode)}</PuChip>
                      </span>
                    )}
                  </span>
                  <span className="pu-item-sub">
                    <span>
                      {t.newColumn} <b>{t.newCount(row.newCount)}</b>
                    </span>
                    <span>
                      {t.remainderColumn} <b>{row.remainderNo ?? t.noRemainder}</b>
                    </span>
                  </span>
                  <span className="pu-item-sub">
                    <span>
                      {t.occurredColumn} <b>{localDateTimeText(row.occurredAt, t.unknown)}</b>
                    </span>
                    {row.issueCount !== null && (
                      <span>
                        {t.issuedColumn} <b>{t.issuedCount(row.issueCount)}</b>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <ListOrderFoot
            order={order}
            onOrder={(next) => {
              setOrder(next);
              page.setPage(1);
            }}
          >
            <PuPager
              total={page.total}
              page={page.page}
              pages={page.pages}
              onPage={page.setPage}
              label={t.sectionLabel}
            />
          </ListOrderFoot>
        </>
      )}
    </>
  );
};
