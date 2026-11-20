import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { PuButton, PuChip, PuDialog, PuNote, PuPager } from '../../patterns/pop-uniform';
import { PuSearchBox } from '../../patterns/pop-uniform/search-box';
import { formatQty, orderSearchRows, toSearchRow, type SearchRowView } from './model';
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
 * 창은 화면 안에 들고, 결과가 많을 때만 목록이 구른다(찾기 칸 · 거르기 줄 · 쪽 넘김은 늘 보인다).
 */
export const SearchDialog = ({ onClose, onPick }: SearchDialogProps) => {
  const [q, setQ] = useState('');
  const [readyOnly, setReadyOnly] = useState(true);
  const [page, setPage] = useState(1);

  const search = useShipmentRequestSearch({ q, readyOnly, page }, true);
  const rows = orderSearchRows((search.data?.items ?? []).map(toSearchRow));

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
    <ul className="pu-list psc-search-list" aria-label={t.caption}>
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
      <div className="psc-search">
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
        <div className="psc-search-filter">
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
          <span className="psc-search-count">{t.count(search.data?.page.total ?? 0)}</span>
        </div>
        {body}
        {/* POP 쪽 넘김은 공통 `PuPager` 로 옮겼다(#295) — 건수는 거르기 줄 오른쪽이 이미 보인다. */}
        <PuPager
          total={search.data?.page.total ?? null}
          page={Math.max(1, search.data?.page.page ?? page)}
          pages={Math.max(
            1,
            Math.ceil((search.data?.page.total ?? 0) / Math.max(1, search.data?.page.size ?? 1)),
          )}
          label={t.pageNav}
          showTotal={false}
          onPage={setPage}
        />
      </div>
    </PuDialog>
  );
};
