import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  Dialog,
  EmptyState,
  Icon,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type FormEvent } from 'react';

import { PopRowHead, PopRowInfo, PopRowPair } from '../../patterns/pop-list-row';
import { PuPager } from '../../patterns/pop-uniform';
import { formatQty, orderSearchRows, toSearchRow, type SearchRowView } from './model';
import { useShipmentRequestSearch } from './queries';

const t = messages.popShipmentComplete.search;

export interface SearchDialogProps {
  onClose: () => void;
  /** 고른 지시서의 코드(`SHPREQ:{no}`) — 스캔과 같은 길(`:lookup`)로 연다. */
  onPick: (code: string) => void;
}

const blockerText = (row: SearchRowView): string =>
  row.blockerSummary.map(({ code, count }) => t.blockerCount[code](count)).join(', ');

/**
 * 찾기(시안 ②) — 지시서 번호·고객·품목 일부로 찾는다. 「완료 대기만」은 켠 채로 열린다. 줄을 누르면 스캔과
 * 같은 확인 화면으로 간다.
 *
 * ⚠ 출하 완료된 지시서는 나오지 않는다 — 「완료 대기만」이 켜졌으면 서버의 완료 대기 조건이, 꺼졌으면
 *   「출하가 남은 지시서만」이 거른다(`model.searchQueryOf`).
 */
export const SearchDialog = ({ onClose, onPick }: SearchDialogProps) => {
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [readyOnly, setReadyOnly] = useState(true);
  const [page, setPage] = useState(1);

  const search = useShipmentRequestSearch({ q, readyOnly, page }, true);
  const rows = orderSearchRows((search.data?.items ?? []).map(toSearchRow));

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setPage(1);
    setQ(draft);
  };

  const body = search.isError ? (
    <AlertBanner
      variant="error"
      action={
        <Button variant="outlined" onClick={() => void search.refetch()}>
          {t.retry}
        </Button>
      }
    >
      {t.failed}
    </AlertBanner>
  ) : search.data === undefined ? (
    <p className="field-note">{t.loading}</p>
  ) : rows.length === 0 ? (
    readyOnly ? (
      <EmptyState
        size="sm"
        icon={<Icon name="inventory_2" size={32} aria-hidden />}
        title={t.emptyReady}
        description={t.emptyReadyHint}
        action={
          <Button
            variant="outlined"
            onClick={() => {
              setPage(1);
              setReadyOnly(false);
            }}
          >
            {t.turnOffReadyOnly}
          </Button>
        }
      />
    ) : (
      <EmptyState size="sm" title={t.empty} description={t.emptyHint} />
    )
  ) : (
    <ul className="pop-ship-search-list" aria-label={t.caption}>
      {rows.map((row) => (
        <li key={row.shipmentRequestId}>
          <button
            type="button"
            className="pop-ship-search-row"
            aria-label={t.select(row.shipmentRequestNo)}
            onClick={() => onPick(row.code)}
          >
            <PopRowHead
              title={row.shipmentRequestNo}
              chips={
                <Chip
                  variant="status"
                  size="md"
                  status={row.ready ? 'success' : 'error'}
                  leadingIcon={
                    <Icon name={row.ready ? 'check_circle' : 'block'} size={18} aria-hidden />
                  }
                >
                  {row.ready ? t.ready : t.blocked(row.blockedCount)}
                </Chip>
              }
            />
            <PopRowInfo>
              {row.customerName !== '' && (
                <PopRowPair label={t.customer}>{row.customerName}</PopRowPair>
              )}
              <PopRowPair label={t.shipDate}>{row.requestedShipDate}</PopRowPair>
              {row.firstItem !== null && (
                <PopRowPair label={t.items}>
                  {t.itemsValue(row.firstItem.code, row.firstItem.name, row.moreItems)}
                </PopRowPair>
              )}
              <PopRowPair label={t.summary}>
                {t.summaryValue(
                  row.lineCount,
                  row.lotCount,
                  formatQty(row.picked),
                  formatQty(row.target),
                )}
              </PopRowPair>
              {!row.ready && (
                <PopRowPair label={t.blockedWhy}>
                  <span className="pop-ship-search-row__blocked">{blockerText(row)}</span>
                </PopRowPair>
              )}
            </PopRowInfo>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog
      open
      size="lg"
      className="pop-ship-search"
      title={t.title}
      onClose={onClose}
      footer={
        <Button size="xl" variant="outlined" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      <form className="pop-ship-search-bar" onSubmit={submit}>
        <TextField
          label={t.queryLabel}
          placeholder={t.queryPlaceholder}
          value={draft}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="outlined">
          {t.find}
        </Button>
        <Checkbox
          checked={readyOnly}
          onChange={(event) => {
            setPage(1);
            setReadyOnly(event.target.checked);
          }}
        >
          {t.readyOnly}
        </Checkbox>
        <span className="pop-ship-search-count">{t.count(search.data?.page.total ?? 0)}</span>
      </form>
      <p className="field-note">{t.note}</p>
      {body}
      {/* POP 쪽 넘김은 공통 `PuPager` 로 옮겼다(#295) — 건수는 위 칸이 이미 보인다. */}
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
    </Dialog>
  );
};
