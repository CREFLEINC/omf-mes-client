import { messages } from '@omf-mes/i18n';
import { useRef, useState, type ReactNode } from 'react';

import {
  PuButton,
  PuChip,
  PuEmpty,
  PuIcon,
  PuPager,
  useClientPage,
  useFitCount,
} from '../../patterns/pop-uniform';
import { localDateTimeText } from './formatting';
import type { PendingRepackRow } from './queries';

const t = messages.repackLabelIssue.pending;

export interface PendingPaneProps {
  rows: readonly PendingRepackRow[];
  selectedId: number | null;
  isLoading: boolean;
  isError: boolean;
  /** 배포본에서 서버에 목록 조건이 없어 목록 자체를 세울 수 없는 상태인가(#1095). */
  isUnsupported: boolean;
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
  isUnsupported,
  disabled,
  onSelect,
  onRetry,
}: PendingPaneProps) => {
  const [query, setQuery] = useState('');
  const fitRef = useRef<HTMLDivElement>(null);
  const size = useFitCount(fitRef, { fallback: 4 });
  const shown = rows.filter((row) => matches(row, query));
  const page = useClientPage(shown, size);

  const body = ((): ReactNode => {
    /* 서버가 아직 이 목록 조건을 주지 않는다 — 다시 해도 같으므로 재시도 단추를 두지 않는다. */
    if (isUnsupported) return <PuEmpty icon="list" title={t.unsupported} />;
    if (isError) {
      return (
        <PuEmpty icon="bad" title={t.loadFailed}>
          <PuButton size="sm" onClick={onRetry}>
            {messages.common.retry}
          </PuButton>
        </PuEmpty>
      );
    }
    if (shown.length === 0) {
      if (isLoading) return <PuEmpty icon="list" title={t.loading} />;
      return query.trim() !== '' && rows.length > 0 ? (
        <PuEmpty icon="search" title={t.searchEmpty} />
      ) : (
        <PuEmpty icon="box" title={t.empty} />
      );
    }

    return null;
  })();

  return (
    <>
      <div className="pu-input pu-search">
        <PuIcon name="search" />
        <input
          value={query}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            page.setPage(1);
          }}
        />
      </div>
      {body ?? (
        <>
          <div ref={fitRef} className="pu-list pu-fit rpk-list" role="group" aria-label={t.caption}>
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
                  </span>
                </button>
              );
            })}
          </div>
          <PuPager
            total={page.total}
            page={page.page}
            pages={page.pages}
            onPage={page.setPage}
            label={t.sectionLabel}
          />
        </>
      )}
    </>
  );
};
