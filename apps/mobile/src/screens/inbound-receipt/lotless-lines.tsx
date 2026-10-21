import { AlertBanner, DatePicker, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import { useItemLabels, type SupplierSummary } from '../../patterns/masters';
import {
  activeFilterCount,
  emptyLotlessFilter,
  matchesLotlessFilter,
  shortDate,
  type LotlessDone,
  type LotlessFilter,
} from './lotless';
import { usePurchaseOrdersLines } from './queries';
import { remainingQtyOf, type PurchaseOrder, type PurchaseOrderLine } from './receipt';
import './lotless-lines.css';

const t = messages.inboundReceipt;

/**
 * 보고 있는 구매 발주(와 품목) - 이름표와 값을 한 줄씩. 2-2 품목 목록과 3 수량 확인이 같은 모양으로
 * 쓴다(사용자 지시 2026-10-21).
 */
export const LotlessOrderInfo = ({ rows }: { rows: { label: string; value: string }[] }) => (
  <dl className="lotless__order-info">
    {rows.map((row) => (
      <div key={row.label}>
        <dt>{row.label}</dt>
        <dd>{row.value}</dd>
      </div>
    ))}
  </dl>
);

export interface LotlessLinesProps {
  /** 미마감 자재 P/O 전부. 라벨이 없어 품목으로 좁히지 못한 목록이다. */
  orders: readonly PurchaseOrder[];
  /** 공급사 이름. 못 받았으면 번호로 보인다. */
  suppliers: readonly SupplierSummary[] | undefined;
  /** 품목을 보고 있는 자재 P/O. 없으면 입고 예정 목록이다. 수량에서 돌아와도 남게 흐름이 붙든다. */
  orderId: number | null;
  onOrder: (purchaseOrderId: number | null) => void;
  /** 입고 예정 목록의 거르기. 흐름이 붙든다. */
  filter: LotlessFilter;
  onFilter: (filter: LotlessFilter) => void;
  /** 지금 고른 라인. 수량에서 돌아왔을 때 그 행을 고른 것으로 보인다. */
  pickedLineId: number | null;
  onPick: (order: PurchaseOrder, line: PurchaseOrderLine) => void;
  queuedFor: (purchaseOrderLineId: number) => number;
  uomOf: (uomId: number) => string;
  /** 한꺼번에 받으려고 체크한 라인. 등록 단추는 화면 바닥 바에 있다. */
  checked: readonly number[];
  onChecked: (lineIds: number[]) => void;
  /** 방금 한꺼번에 등록한 결과. 표 위에 남겨 무엇을 넣었는지 보인다. */
  done: LotlessDone | null;
}

/** 머리의 「모두 선택」. 일부만 체크했으면 반쯤 찬 상태로 보인다 - 그 상태는 속성으로만 걸린다. */
const SelectAll = ({
  state,
  label,
  onChange,
}: {
  state: 'none' | 'some' | 'all';
  label: string;
  onChange: (next: boolean) => void;
}) => {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current !== null) {
      ref.current.indeterminate = state === 'some';
    }
  }, [state]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="lotless__check"
      aria-label={label}
      checked={state === 'all'}
      onChange={(event) => {
        onChange(event.target.checked);
      }}
    />
  );
};

/**
 * 라벨이 없을 때 받을 품목을 고른다 — 입고 예정(자재 P/O) 목록 → 누른 자재 P/O 의 품목 목록.
 *
 * 라벨이 있으면 제품코드로 자재 P/O 를 좁히지만, 없으면 그럴 수 없다. 입고 예정을 공급사 · 자재
 * P/O · 발주일 · 입고예정일 칸의 표로 보이고 공급사명 · 기간으로 거른다. 행을 누르면 그 자재 P/O 의
 * 품목 표로 간다(사용자 지시 2026-10-21).
 *
 * 두 표 모두 컬럼 머리가 있고 행은 한 줄이다. 표 안에서 스크롤해도 머리는 위에 붙어 있다.
 * 품목 행에는 자재 P/O 번호도 라인 번호도 적지 않는다 - 고른 자재 P/O 는 표 위에 한 번 적는다.
 *
 * 품목 행마다 체크 칸이 있다. 거의 다 문제없이 들어오므로 이상 없는 행은 체크해(「모두 선택」)
 * 남은 수량 그대로 한꺼번에 등록하고, 문제가 있는 행만 품목명을 눌러 수량 단계에서 따로 처리한다
 * (사용자 지시 2026-10-21).
 */
export const LotlessLines = ({
  orders,
  suppliers,
  orderId,
  onOrder,
  filter,
  onFilter,
  pickedLineId,
  onPick,
  queuedFor,
  uomOf,
  checked,
  onChecked,
  done,
}: LotlessLinesProps) => {
  const [query, setQuery] = useState('');
  /* 다 받은 라인은 고를 일이 드물다. 기본으로 거르고, 끄면 흐리게 함께 보인다. */
  const [openOnly, setOpenOnly] = useState(true);
  /* 거르기 칸은 접어 둔다 - 펼쳐 두면 표가 화면 아래로 밀린다. 걸린 조건 수는 단추가 말한다. */
  const [filterOpen, setFilterOpen] = useState(false);
  const [itemFilterOpen, setItemFilterOpen] = useState(false);
  const order = orderId === null ? undefined : orders.find((o) => o.purchaseOrderId === orderId);
  const loaded = usePurchaseOrdersLines(order === undefined ? [] : [order]);
  const labels = useItemLabels(loaded.lines.map((each) => each.line.itemId));
  const nameOf = (id: number) =>
    suppliers?.find((each) => each.partnerId === id)?.partnerName ?? t.lotless.supplierUnknown(id);

  if (order === undefined) {
    const active = activeFilterCount(filter);
    /* 입고 예정일이 가까운 것부터. 예정일이 없으면 뒤로, 그다음은 공급사명 차례. */
    const rows = orders
      .filter((each) => matchesLotlessFilter(each, nameOf(each.supplierId), filter))
      .sort(
        (a, b) =>
          (a.expectedReceiptDate ?? '9999').localeCompare(b.expectedReceiptDate ?? '9999') ||
          nameOf(a.supplierId).localeCompare(nameOf(b.supplierId)),
      );

    return (
      <>
        <div className="lotless__head">
          <span className="lotless__count">{t.lotless.orderCount(rows.length)}</span>
          <button
            type="button"
            className="lotless__toggle"
            aria-expanded={filterOpen}
            aria-controls="lotless-filter"
            onClick={() => {
              setFilterOpen((current) => !current);
            }}
          >
            <Icon name="filter_list" size={20} />
            {active === 0 ? t.lotless.filter.open : t.lotless.filter.openActive(active)}
          </button>
        </div>

        <div id="lotless-filter" className="lotless__filters" hidden={!filterOpen}>
          <TextField
            label={t.lotless.filter.supplierName}
            placeholder={t.lotless.filter.supplierNamePlaceholder}
            size="lg"
            fullWidth
            type="search"
            leadingIcon={<Icon name="search" size={20} />}
            value={filter.supplierName}
            onChange={(event) => {
              onFilter({ ...filter, supplierName: event.target.value });
            }}
          />
          <div className="lotless__field">
            <div className="lotless__period-head">
              <span id="lotless-period-label">{t.lotless.filter.period}</span>
              {/* 기간을 무엇에 대는가. 둘 중 하나라 나란히 선 단추다. */}
              <div className="lotless__basis" role="group" aria-label={t.lotless.filter.basis}>
                {(['expected', 'ordered'] as const).map((basis) => (
                  <button
                    key={basis}
                    type="button"
                    aria-pressed={filter.basis === basis}
                    onClick={() => {
                      onFilter({ ...filter, basis });
                    }}
                  >
                    {basis === 'expected'
                      ? t.lotless.filter.basisExpected
                      : t.lotless.filter.basisOrdered}
                  </button>
                ))}
              </div>
            </div>
            <DatePicker
              mode="range"
              clearable
              size="lg"
              className="lotless__period"
              aria-labelledby="lotless-period-label"
              placeholder={t.lotless.filter.periodAll}
              value={filter.period}
              onChange={(period) => {
                onFilter({ ...filter, period });
              }}
            />
          </div>
          {active === 0 ? null : (
            <button
              type="button"
              className="lotless__clear"
              onClick={() => {
                onFilter(emptyLotlessFilter);
              }}
            >
              <Icon name="close" size={20} />
              {t.lotless.filter.clear}
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="receipt__note">{orders.length === 0 ? t.po.none : t.lotless.filter.none}</p>
        ) : (
          <div className="lotless__table-wrap">
            <table className="lotless__table lotless__table--orders">
              <caption className="lotless__hidden">{t.lotless.orders}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.lotless.columns.supplier}</th>
                  <th scope="col">{t.lotless.columns.order}</th>
                  <th
                    scope="col"
                    className="lotless__date"
                    aria-label={t.lotless.columns.orderDate}
                  >
                    {t.lotless.columns.orderDateShort}
                  </th>
                  {/* 칸이 좁아 머리는 줄여 적고, 낭독기에는 온 이름을 준다. */}
                  <th
                    scope="col"
                    className="lotless__date"
                    aria-label={t.lotless.columns.expectedDateFull}
                  >
                    {t.lotless.columns.expectedDate}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((each) => {
                  const supplier = nameOf(each.supplierId);

                  return (
                    <tr key={each.purchaseOrderId}>
                      <td>
                        {/* 행 전체가 누르는 자리다. 단추가 행을 덮는다. */}
                        <button
                          type="button"
                          className="lotless__pick"
                          aria-label={t.lotless.orderRow(
                            supplier,
                            each.purchaseOrderNo,
                            each.orderDate,
                            each.expectedReceiptDate ?? '—',
                          )}
                          onClick={() => {
                            setQuery('');
                            onOrder(each.purchaseOrderId);
                          }}
                        >
                          {supplier}
                        </button>
                      </td>
                      <td className="lotless__code">{each.purchaseOrderNo}</td>
                      <td className="lotless__date">{shortDate(each.orderDate)}</td>
                      <td className="lotless__date">{shortDate(each.expectedReceiptDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  const needle = query.trim().toLocaleLowerCase();
  const rows = loaded.lines
    .map((each) => ({
      ...each,
      item: labels.get(each.line.itemId),
      remaining: remainingQtyOf(each.line, queuedFor(each.line.purchaseOrderLineId)),
    }))
    .filter((each) => !openOnly || each.remaining > 0)
    .filter(
      (each) =>
        needle === '' ||
        (each.item !== undefined &&
          `${each.item.itemName} ${each.item.itemCode}`.toLocaleLowerCase().includes(needle)),
    )
    /* 받을 것이 남은 행을 앞에, 그 안에서는 품목명 차례로. */
    .sort(
      (a, b) =>
        Number(a.remaining <= 0) - Number(b.remaining <= 0) ||
        (a.item?.itemName ?? '').localeCompare(b.item?.itemName ?? ''),
    );

  /* 체크할 수 있는 행 - 받을 것이 남은 것. 다 받은 행은 한꺼번에 실을 수량이 없다. */
  const checkable = rows
    .filter((each) => each.remaining > 0)
    .map((each) => each.line.purchaseOrderLineId);
  const checkedHere = checkable.filter((id) => checked.includes(id));
  const allState: 'none' | 'some' | 'all' =
    checkedHere.length === 0 ? 'none' : checkedHere.length === checkable.length ? 'all' : 'some';

  return (
    <>
      {/*
       * 보고 있는 구매 발주 - 공급사와 발주번호를 이름표와 함께 적는다(사용자 지시 2026-10-21).
       * 구매 발주 목록으로는 앱바의 「이전 단계」로 돌아간다 - 여기에 같은 단추를 두지 않는다.
       */}
      <LotlessOrderInfo
        rows={[
          { label: t.lotless.info.supplier, value: nameOf(order.supplierId) },
          { label: t.lotless.info.order, value: order.purchaseOrderNo },
        ]}
      />

      {/* 몇 건이 걸렸는가와 「받을 것만」 · 「필터」. 거르기를 바꾸면 이 수가 먼저 바뀐다. */}
      <div className="lotless__head">
        <span className="lotless__count">{t.lotless.count(rows.length)}</span>
        <span className="lotless__head-actions">
          <button
            type="button"
            className="lotless__toggle"
            aria-pressed={openOnly}
            onClick={() => {
              setOpenOnly((current) => !current);
            }}
          >
            {/* 행의 체크 칸과 헷갈리지 않게 켜고 끄는 모양으로 보인다. */}
            <Icon name={openOnly ? 'toggle_on' : 'toggle_off'} size={24} />
            {t.lotless.openOnly}
          </button>
          {/* 품목 찾기는 2-1 처럼 접어 둔다(사용자 지시 2026-10-21). 찾는 말이 있으면 단추가 말한다. */}
          <button
            type="button"
            className="lotless__toggle"
            aria-expanded={itemFilterOpen}
            aria-controls="lotless-item-filter"
            onClick={() => {
              setItemFilterOpen((current) => !current);
            }}
          >
            <Icon name="filter_list" size={20} />
            {needle === '' ? t.lotless.itemFilter.open : t.lotless.itemFilter.openActive(1)}
          </button>
        </span>
      </div>

      <div id="lotless-item-filter" className="lotless__filters" hidden={!itemFilterOpen}>
        <TextField
          label={t.lotless.searchLabel}
          placeholder={t.lotless.searchPlaceholder}
          size="lg"
          fullWidth
          type="search"
          leadingIcon={<Icon name="search" size={20} />}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>

      {/*
       * 방금 한꺼번에 등록한 것. 무엇을 얼마나 넣었는지 다시 보인다(현장 요청 2026-09-21). 등록된 행은
       * 받을 것이 없어져 표에서 빠진다 - 남은 행이 문제를 따로 처리할 것들이다.
       */}
      {done === null ? null : (
        <AlertBanner
          variant={
            done.outcome === 'sent' ? 'success' : done.outcome === 'queued' ? 'warning' : 'error'
          }
          title={t.lotless.bulk.done[done.outcome](done.items.length)}
        >
          {done.items.map((each) => `${each.name} ${each.qty}`).join(' · ')}
        </AlertBanner>
      )}

      {loaded.pending ? <p role="status">{t.po.linesLoading}</p> : null}
      {loaded.failed ? <AlertBanner variant="error" title={t.po.linesLoadFailed} /> : null}
      {!loaded.pending && rows.length === 0 ? (
        <p className="receipt__note">
          {needle === '' ? t.lotless.none : t.lotless.noMatch(query.trim())}
        </p>
      ) : null}

      {rows.length === 0 ? null : (
        <div className="lotless__table-wrap">
          <table className="lotless__table lotless__table--items">
            <caption className="lotless__hidden">{t.lotless.items}</caption>
            <thead>
              <tr>
                <th scope="col" className="lotless__check-cell">
                  <SelectAll
                    state={allState}
                    label={t.lotless.bulk.selectAll}
                    onChange={(next) => {
                      onChecked(
                        next
                          ? [...new Set([...checked, ...checkable])]
                          : checked.filter((id) => !checkable.includes(id)),
                      );
                    }}
                  />
                </th>
                <th scope="col">{t.lotless.columns.itemName}</th>
                <th scope="col">{t.lotless.columns.itemCode}</th>
                <th scope="col" className="lotless__num">
                  {t.lotless.columns.receivedOfOrdered}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ line, item, remaining }) => {
                const name = item === undefined ? t.po.itemUnknown : item.itemName;
                const code = item === undefined ? '—' : item.itemCode;
                /*
                 * 이미 받은 수량/발주 수량(사용자 지시 2026-10-21). 받은 수에는 담긴 채 아직 못 간
                 * 것도 넣는다 - 넣지 않으면 한꺼번에 등록한 뒤에도 0 으로 보인다.
                 */
                const receivedSoFar = line.orderedQty - Math.max(remaining, 0);
                /*
                 * 체크하면 입고 수량이 발주 수량으로 찬다 - 등록하면 그렇게 된다는 것을 미리 보인다.
                 * 바뀐 수는 파랗게 강조한다(사용자 지시 2026-10-21).
                 */
                const filled = remaining > 0 && checked.includes(line.purchaseOrderLineId);
                const shownReceived = filled ? line.orderedQty : receivedSoFar;
                const qty = `${String(shownReceived)}/${String(line.orderedQty)} ${uomOf(line.uomId)}`;
                const picked = pickedLineId === line.purchaseOrderLineId;

                return (
                  <tr
                    key={line.purchaseOrderLineId}
                    className={[
                      picked ? 'lotless__row--picked' : '',
                      remaining <= 0 ? 'lotless__row--closed' : '',
                    ]
                      .filter((each) => each !== '')
                      .join(' ')}
                  >
                    <td className="lotless__check-cell">
                      <input
                        type="checkbox"
                        className="lotless__check"
                        aria-label={t.lotless.bulk.selectRow(name)}
                        disabled={remaining <= 0}
                        checked={checked.includes(line.purchaseOrderLineId)}
                        onChange={(event) => {
                          const id = line.purchaseOrderLineId;

                          onChecked(
                            event.target.checked
                              ? [...checked, id]
                              : checked.filter((each) => each !== id),
                          );
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="lotless__pick"
                        aria-label={t.lotless.itemRow(name, code, qty)}
                        aria-pressed={picked}
                        onClick={() => {
                          onPick(order, line);
                        }}
                      >
                        {name}
                      </button>
                    </td>
                    <td>{code}</td>
                    <td className="lotless__num">
                      <span className={filled ? 'lotless__filled' : undefined}>
                        {String(shownReceived)}
                      </span>
                      {`/${String(line.orderedQty)} ${uomOf(line.uomId)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};
