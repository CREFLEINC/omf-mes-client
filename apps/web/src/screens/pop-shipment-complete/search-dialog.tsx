import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import {
  PuButton,
  PuChip,
  PuDialog,
  PuNote,
  PuPager,
  puCx,
  useFitCount,
} from '../../patterns/pop-uniform';
import { PuSearchBox } from '../../patterns/pop-uniform/search-box';
import {
  SEARCH_PAGE_SIZE,
  formatQty,
  orderSearchRows,
  toSearchRow,
  type SearchRowView,
} from './model';
import { useShipmentRequestSearch } from './queries';

const t = messages.popShipmentComplete.search;

export interface SearchDialogProps {
  onClose: () => void;
  /** 고른 지시서의 코드(`SHPREQ:{no}`) — 스캔과 같은 길(`:lookup`)로 연다. */
  onPick: (code: string) => void;
}

/** 출하 불가 사유 요약 — 라인을 짚지 않은 피킹 부족(낼 피킹 LOT 없음)은 그 뜻대로 쓴다. */
const blockerText = (row: SearchRowView): string =>
  row.blockerSummary
    .map(({ code, count }) =>
      code === 'PICKING_SHORT' && row.noPickedLot ? t.noPickedLot : t.blockerCount[code](count),
    )
    .join(', ');

/**
 * 지시서 검색(시안 ②) — 지시서 번호·고객·품목 일부로 찾는다. 「출하 가능만 표시」는 켠 채로 열린다. 줄을 누르면
 * 스캔과 같은 확인 화면으로 간다.
 *
 * ⚠ 출하 완료된 지시서는 나오지 않는다 — 「출하 가능만 표시」가 켜졌으면 서버의 완료 대기 조건이, 꺼졌으면
 *   「출하가 남은 지시서만」이 거른다(`model.searchQueryOf`).
 * 창은 화면 안에 들고 구르지 않는다 — 결과는 목록 칸에 드는 만큼 쪽으로 나눠 아래 쪽 넘김(총 N건 ‹ n / m ›)으로 본다.
 */
export const SearchDialog = ({ onClose, onPick }: SearchDialogProps) => {
  const [q, setQ] = useState('');
  const [readyOnly, setReadyOnly] = useState(true);
  const [page, setPage] = useState(1);

  /*
   * 쪽 넘김(스크롤 없음) — 한 쪽 건수는 목록 칸에 드는 카드 수다(`useFitCount`, 선택 창 `pop-select` 와 같은 방식).
   * 서버가 쪽으로 주는 목록이라 그 건수로 쪽을 받는다(조회 조건은 같다).
   */
  const listRef = useRef<HTMLUListElement>(null);
  const size = useFitCount(listRef, { fallback: 3, max: SEARCH_PAGE_SIZE });
  const search = useShipmentRequestSearch({ q, readyOnly, page, size }, true);
  const rows = orderSearchRows((search.data?.items ?? []).map(toSearchRow));
  const total = search.data?.page.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, search.data?.page.size ?? size)));
  /*
   * 한 쪽에 다 들지 않으면 창 높이를 화면 끝까지 키워 목록 칸이 남은 높이를 갖는다 — 적으면 창은 내용만큼.
   * ⛔ 「받은 응답」의 쪽 수로 정한다(지금 잰 건수가 아니라). 잰 건수로 정하면 다시 받기 전에 창이 줄었다 늘었다
   *    하며 재기를 끝없이 되풀이한다(1700×1350 실측, 화면 오류).
   */
  const isPaged = pages > 1;

  /* 건수가 줄어 지금 쪽이 없어지면 마지막 쪽으로 당긴다. */
  useEffect(() => {
    if (search.data !== undefined && page > pages) setPage(pages);
  }, [search.data, page, pages]);

  const body = search.isError ? (
    <PuNote
      tone="bad"
      action={
        <PuButton size="sm" onClick={() => void search.refetch()}>
          {t.retry}
        </PuButton>
      }
    >
      {t.failed}
    </PuNote>
  ) : search.data === undefined ? (
    <PuNote>{t.loading}</PuNote>
  ) : rows.length === 0 ? (
    <div className="psc-search-empty" role="status">
      <b>{t.empty}</b>
      <span>{readyOnly ? t.emptyHintFiltered : t.emptyHint}</span>
    </div>
  ) : (
    <ul ref={listRef} className="pu-list pu-fit psc-search-list" aria-label={t.caption}>
      {rows.map((row) => (
        <li key={row.shipmentRequestId}>
          <button
            type="button"
            className="pu-item"
            aria-label={t.select(row.shipmentRequestNo)}
            onClick={() => onPick(row.code)}
          >
            <span className="pu-item-top">
              <span className="no">{row.shipmentRequestNo}</span>
              <span className="chips">
                <PuChip tone={row.ready ? 'ok' : 'bad'}>{row.ready ? t.ready : t.blocked}</PuChip>
              </span>
            </span>
            <span className="pu-item-sub">
              {row.customerName !== '' && (
                <span>
                  {t.customer} <b>{row.customerName}</b>
                </span>
              )}
              <span>
                {t.shipDate} <b>{row.requestedShipDate}</b>
              </span>
              {row.firstItem !== null && (
                <span>
                  {t.items}{' '}
                  <b>{t.itemsValue(row.firstItem.code, row.firstItem.name, row.moreItems)}</b>
                </span>
              )}
              <span>
                {t.summary}{' '}
                <b>
                  {t.summaryValue(
                    row.lineCount,
                    row.lotCount,
                    formatQty(row.picked),
                    formatQty(row.target),
                  )}
                </b>
              </span>
              {!row.ready && (
                <span className="psc-search-blocked">
                  {t.blockedWhy} <b>{blockerText(row)}</b>
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <PuDialog
      title={t.title}
      wide
      onClose={onClose}
      footer={<PuButton onClick={onClose}>{t.close}</PuButton>}
    >
      <div className={puCx('psc-search', isPaged && 'is-paged')}>
        {/* 찾기 칸 — 누르면 다른 화면 찾기 칸과 같은 창(글자판 · [검색])이 뜬다(`PuSearchBox`). */}
        <PuSearchBox
          label={t.queryLabel}
          heading={t.queryHeading}
          value={q}
          onChange={(value) => {
            setPage(1);
            setQ(value);
          }}
        />
        <label className="pu-check">
          <input
            type="checkbox"
            checked={readyOnly}
            onChange={(event) => {
              setPage(1);
              setReadyOnly(event.target.checked);
            }}
          />
          {t.readyOnly}
        </label>
        {body}
        <PuPager
          total={search.data === undefined ? null : total}
          page={Math.min(Math.max(1, search.data?.page.page ?? page), pages)}
          pages={pages}
          label={t.pageNav}
          onPage={setPage}
        />
      </div>
    </PuDialog>
  );
};
