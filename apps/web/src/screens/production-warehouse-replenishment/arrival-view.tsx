import { AlertBanner, Button, Checkbox, Dialog, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import { InfoTip } from '../../patterns/info-tip';
import { SaveErrorBanner } from '../../patterns/master';
import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import type {
  ReplenishmentArrival,
  ReplenishmentSettings,
  ShopfloorReceiptBulkResult,
} from './api-types';
import { hasChangedFilters } from '../../patterns/filter-more';
import { EMPTY_ARRIVAL, type ArrivalFilters } from './filters';
import { useBulkReceive } from './mutations';
import { OriginChip } from './progress-view';
import { replenishmentKeys, useArrivalList, useLocationNames } from './queries';
import { ReceiveDialog } from './receive-dialog';
import { plantMinute, qtyWithUom } from './types';
import { ListEmptyRow } from '../../patterns/list-empty';
import { PageNav } from '../../patterns/page-nav';
import { LoadErrorAlert } from '../../patterns/load-error-banner';

const t = messages.productionWarehouseReplenishment;
const ta = t.arrival;

/** 서로 다른 품목 수 — 같은 품목의 LOT 여러 줄은 한 품목이다(G2 확인 3). */
export const distinctItems = (row: ReplenishmentArrival): number =>
  new Set(row.lines.map((line) => line.itemId)).size;

/** 경과 이 일수 이상이면 노랑(표시만, 알림 없음 — 시안 검토 3). */
export const ELAPSED_WARN_DAYS = 3;

/** 일괄 수령 상한(계약 §3). */
export const BULK_LIMIT = 100;

export interface ArrivalViewProps {
  plantId: number;
  productionWarehouses: ReplenishmentSettings['warehouses'];
  filters: ArrivalFilters;
  page: number;
  onSearch: (filters: ArrivalFilters) => void;
  onReset: () => void;
  onPage: (page: number) => void;
  /** 한 쪽 건수와 고를 크기(10 · 20 · 50) — 바꾸면 첫 쪽으로 간다(품질 화면과 같다 · #360). */
  pageSize: number;
  pageSizes: readonly number[];
  onPageSize: (size: number) => void;
}

type BulkStep = 'confirm' | 'result' | null;

/** 보기 3 — 도착 대기(US2). 출고 전표마다 수령: 고른 장은 일괄(차이 없음), 행은 하나씩(차이 사유). */
export const ArrivalView = ({
  plantId,
  productionWarehouses,
  filters,
  page,
  onSearch,
  onReset,
  onPage,
  pageSize,
  pageSizes,
  onPageSize,
}: ArrivalViewProps) => {
  const queryClient = useQueryClient();
  const blockId = useId();
  const [draft, setDraft] = useState<ArrivalFilters>(filters);
  const [draftSource, setDraftSource] = useState(filters);
  if (JSON.stringify(draftSource) !== JSON.stringify(filters)) {
    setDraftSource(filters);
    setDraft(filters);
  }
  /* 「초기화」는 처음 값과 다를 때만 보인다(C-6). 주소가 그대로여도 고친 값은 되돌린다. */
  const isChanged = hasChangedFilters(EMPTY_ARRIVAL, draft, filters);
  const reset = (): void => {
    setDraft(EMPTY_ARRIVAL);
    onReset();
  };
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [receiving, setReceiving] = useState<ReplenishmentArrival | null>(null);
  const [bulkStep, setBulkStep] = useState<BulkStep>(null);
  const [bulkResult, setBulkResult] = useState<ShopfloorReceiptBulkResult | null>(null);
  /** 결과 창이 번호를 찾도록 보낸 장을 기억한다(받은 뒤 목록에서 빠진다). */
  const [sent, setSent] = useState<ReplenishmentArrival[]>([]);
  const list = useArrivalList(plantId, filters, page, pageSize);

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: replenishmentKeys.all });
  };

  const bulk = useBulkReceive((result) => {
    setBulkResult(result);
    setBulkStep('result');
    setChecked(new Set());
  });

  const rows = list.data?.items ?? [];
  const locationNames = useLocationNames(
    rows.map((row) => ({ id: row.destinationLocationId, code: row.destinationLocationCode })),
  );
  /* 목록이 바뀌면(받음 · 조회) 사라진 장의 고름을 버린다. */
  const selected = rows.filter((row) => checked.has(row.goodsIssueId));
  const allChecked = rows.length > 0 && selected.length === rows.length;

  const toggle = (id: number): void =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filterBar = (
    <section className="replenishment-filters" aria-label={ta.filters.label}>
      <div className="replenishment-filter-row">
        <Select
          aria-label={ta.filters.productionWarehouse}
          value={draft.warehouse}
          options={[
            { value: '', label: t.common.all },
            ...productionWarehouses.map((row) => ({
              value: String(row.warehouseId),
              label: row.warehouseName,
            })),
          ]}
          onChange={(value) => setDraft({ ...draft, warehouse: value })}
        />
        <DateRangeFields
          hideLabels
          clearable
          startLabel={ta.filters.periodFrom}
          endLabel={ta.filters.periodTo}
          from={draft.from}
          to={draft.to}
          onChange={(from, to) => setDraft({ ...draft, from, to })}
        />
        <Button
          onClick={() => {
            refresh();
            onSearch(draft);
          }}
        >
          {t.common.search}
        </Button>
        {isChanged && (
          <Button variant="outlined" onClick={reset}>
            {t.common.reset}
          </Button>
        )}
        {/* 어떤 출고가 이 목록에 오는지는 조회 줄 끝 ⓘ 로 둔다(관리웹 정리 시안 A). */}
        <InfoTip text={ta.lead} />
      </div>
    </section>
  );

  const itemCell = (row: ReplenishmentArrival): ReactNode => {
    const [only] = row.lines;
    if (row.lines.length === 1 && only !== undefined) {
      return (
        <>
          <span className="replenishment-code">{only.itemCode}</span>{' '}
          {`${only.itemName}, ${only.lotNo}`}
        </>
      );
    }
    const open = expanded.has(row.goodsIssueId);
    return (
      <>
        <Button
          variant="text"
          size="sm"
          aria-expanded={open}
          aria-label={ta.expand(row.goodsIssueNo)}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(row.goodsIssueId)) next.delete(row.goodsIssueId);
              else next.add(row.goodsIssueId);
              return next;
            });
          }}
        >
          {distinctItems(row) === 1 && only !== undefined
            ? ta.lotCount(`${only.itemCode} ${only.itemName}`, row.lines.length)
            : ta.itemCount(distinctItems(row))}
        </Button>
        {open && (
          <ul className="replenishment-result-list">
            {row.lines.map((line) => (
              <li key={line.goodsIssueLineId}>
                {`${line.itemCode} ${line.itemName}, ${line.lotNo}, ${qtyWithUom(line.issueQty, line.uomCode)}`}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  const body = (): ReactNode => {
    if (list.isError) {
      return <LoadErrorAlert error={list.error} onRetry={() => void list.refetch()} />;
    }
    if (list.data === undefined) return <Skeleton variant="rect" height="16rem" />;

    const total = list.data.page.total;
    const blocked = selected.length === 0 || selected.length > BULK_LIMIT;
    return (
      <>
        <div className="replenishment-table-scroll">
          <table className="replenishment-table is-wrap-head" aria-label={ta.listLabel}>
            <thead>
              <tr>
                <th scope="col">
                  <Checkbox
                    aria-label={ta.selectAll}
                    checked={allChecked}
                    onChange={(event) =>
                      setChecked(
                        event.target.checked
                          ? new Set(rows.map((row) => row.goodsIssueId))
                          : new Set(),
                      )
                    }
                  />
                </th>
                <th scope="col">{ta.columns.goodsIssueNo}</th>
                <th scope="col">{ta.columns.requestNo}</th>
                <th scope="col">{ta.columns.origin}</th>
                <th scope="col">{ta.columns.productionWarehouse}</th>
                <th scope="col">{ta.columns.destination}</th>
                <th scope="col">{ta.columns.itemLot}</th>
                <th scope="col" className="is-number">
                  {ta.columns.qty}
                </th>
                <th scope="col">{ta.columns.issuedAt}</th>
                <th scope="col">{ta.columns.elapsed}</th>
                <th scope="col">
                  <span className="visually-hidden">{ta.columns.action}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <ListEmptyRow colSpan={11} title={ta.empty} /> : null}
              {rows.map((row) => {
                const [only] = row.lines;
                const late = row.elapsedDays >= ELAPSED_WARN_DAYS;
                return (
                  /* 행 어디를 눌러도 하나씩 받기 창(C-1). 키보드는 「하나씩 받기」 단추가 맡는다. */
                  <tr
                    key={row.goodsIssueId}
                    className="is-clickable"
                    aria-selected={checked.has(row.goodsIssueId)}
                    onClick={() => setReceiving(row)}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        aria-label={ta.selectRow(row.goodsIssueNo)}
                        checked={checked.has(row.goodsIssueId)}
                        onChange={() => toggle(row.goodsIssueId)}
                      />
                    </td>
                    <td className="replenishment-code">{row.goodsIssueNo}</td>
                    <td className="replenishment-code">{row.issueRequestNo}</td>
                    <td>
                      <OriginChip origin={row.replenishmentOriginCode} />
                    </td>
                    <td>{row.productionWarehouseName}</td>
                    <td>
                      {locationNames.get(row.destinationLocationId) ?? row.destinationLocationCode}
                    </td>
                    <td className="is-wrap">{itemCell(row)}</td>
                    <td className="is-number">
                      {/* 한 품목(여러 LOT 포함)이면 출고 수량 합, 여러 품목이면 단위가 갈려 더하지 않는다. */}
                      {distinctItems(row) === 1 && only !== undefined
                        ? qtyWithUom(
                            row.lines.reduce((sum, line) => sum + line.issueQty, 0),
                            only.uomCode,
                          )
                        : t.common.none}
                    </td>
                    <td>{plantMinute(row.issuedAt)}</td>
                    <td className={late ? 'replenishment-late' : undefined}>
                      {ta.elapsed(row.elapsedDays)}
                    </td>
                    <td>
                      <Button
                        variant="outlined"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setReceiving(row);
                        }}
                      >
                        {ta.receiveOne}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? null : (
          <>
            <div className="replenishment-actions">
              <span className="replenishment-actions-end">
                {blocked && (
                  <span id={blockId} className="field-note">
                    {ta.bulkBlocked}
                  </span>
                )}
                <Button
                  disabled={blocked}
                  aria-describedby={blocked ? blockId : undefined}
                  onClick={() => {
                    bulk.reset();
                    setBulkStep('confirm');
                  }}
                >
                  {ta.bulk(selected.length)}
                </Button>
                {/* 수령은 재고를 옮기지 않고 도착만 기록한다 — 수령 단추 옆 ⓘ(관리웹 정리 시안 A). */}
                <InfoTip text={ta.footNote} />
              </span>
            </div>
            {/* 쪽 이동은 공용 줄 — 「총 N건 · N건 ▾」 + [처음] [이전] n / m [다음] [마지막](품질 화면과 같다 · #360). */}
            <PageNav
              meta={{ page, size: pageSize, total }}
              sizes={pageSizes}
              buttonSize="md"
              onChangePage={onPage}
              onChangeSize={onPageSize}
            />
          </>
        )}
      </>
    );
  };

  const noOf = (id: number): string =>
    sent.find((row) => row.goodsIssueId === id)?.goodsIssueNo ?? String(id);
  const results = bulkResult?.results ?? [];
  const receivedCount = results.filter((each) => each.outcome === 'RECEIVED').length;

  return (
    <>
      {filterBar}
      {body()}
      {receiving !== null && (
        <ReceiveDialog
          arrival={receiving}
          onClose={() => setReceiving(null)}
          onStale={() => {
            setReceiving(null);
            refresh();
          }}
        />
      )}
      <Dialog
        className="dialog-icon-check"
        open={bulkStep === 'confirm'}
        onClose={() => setBulkStep(null)}
        title={t.bulkDialog.title(selected.length)}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={() => setBulkStep(null)}>
              {t.bulkDialog.cancel}
            </Button>
            <Button
              loading={bulk.isSaving}
              onClick={() => {
                const now = new Date().toISOString();
                setSent(selected);
                bulk.write({
                  businessDate: plantToday(),
                  receivedAt: now,
                  goodsIssueIds: selected.map((row) => row.goodsIssueId),
                });
              }}
            >
              {t.bulkDialog.submit}
            </Button>
          </>
        }
      >
        <p className="dialog-text">{t.bulkDialog.body}</p>
        {bulk.error !== null && <SaveErrorBanner error={bulk.error} />}
      </Dialog>
      <Dialog
        open={bulkStep === 'result'}
        onClose={() => setBulkStep(null)}
        title={t.bulkResult.title}
        size="sm"
        footer={<Button onClick={() => setBulkStep(null)}>{t.bulkResult.close}</Button>}
      >
        <div className="replenishment-result">
          {receivedCount > 0 && (
            <AlertBanner variant="success">
              <span className="replenishment-banner-line">
                {t.bulkResult.received(receivedCount)}
              </span>
              <span className="replenishment-banner-line">{t.bulkResult.putaway}</span>
            </AlertBanner>
          )}
          {results
            .filter((each) => each.outcome === 'ALREADY_RECEIVED')
            .map((each) => (
              <AlertBanner key={each.goodsIssueId} variant="info">
                {t.bulkResult.already(noOf(each.goodsIssueId))}
              </AlertBanner>
            ))}
          {results
            .filter((each) => each.outcome === 'FAILED')
            .map((each) => (
              <AlertBanner key={each.goodsIssueId} variant="error">
                {t.bulkResult.failed(noOf(each.goodsIssueId), each.message ?? '')}
              </AlertBanner>
            ))}
        </div>
      </Dialog>
    </>
  );
};
