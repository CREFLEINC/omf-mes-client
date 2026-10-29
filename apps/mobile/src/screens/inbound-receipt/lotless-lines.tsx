import { AlertBanner, DatePicker, Icon, TextField, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import { useColumnResize } from '../../patterns/column-resize';
import { fillAboveBarRef, fillHeightRef } from '../../patterns/fill-height';
import { ListLoading } from '../../patterns/list-loading';
import { useItemLabels, type SupplierSummary } from '../../patterns/masters';
import {
  activeFilterCount,
  matchesLotlessFilter,
  shortDate,
  type LotlessDone,
  type LotlessFilter,
} from './lotless';
import { usePurchaseOrdersLines } from './queries';
import { remainingQtyOf, type PurchaseOrder, type PurchaseOrderLine } from './receipt';
import './lotless-lines.css';

const t = messages.inboundReceipt;

/** 고정폭 글꼴 한 자의 폭(em). P/O No. 칸을 번호 길이에 맞출 때 쓴다 - 한 자만큼 여유를 둔 값이다. */
const MONO_CH = 0.68;

/**
 * 보고 있는 구매 발주(와 품목) - 이름표와 값을 한 줄씩. 2-2 품목 목록과 3 수량 확인이 같은 모양으로
 * 쓴다(사용자 지시 2026-10-21).
 */
export const LotlessOrderInfo = ({
  rows,
}: {
  rows: { label: string; value: string; strong?: boolean }[];
}) => (
  <dl className="lotless__order-info">
    {rows.map((row) => (
      <div key={row.label} className={row.strong ? 'lotless__order-info-strong' : undefined}>
        <dt>{row.label}</dt>
        <dd>{row.value}</dd>
      </div>
    ))}
  </dl>
);

export interface LotlessLinesProps {
  /** 미마감 자재 P/O 전부. 라벨이 없어 품목으로 좁히지 못한 목록이다. */
  orders: readonly PurchaseOrder[];
  /** 입고 예정을 (다시) 받는 중. 그동안은 받아 둔 목록 대신 로딩을 보인다. */
  ordersLoading: boolean;
  /** 구매 발주 목록에 들어올 때마다 부른다 - 목록을 새로 받는다(사용자 지시 2026-10-22). */
  onEnterOrders: () => void;
  /** 공급사 이름. 못 받았으면 번호로 보인다. */
  suppliers: readonly SupplierSummary[] | undefined;
  /**
   * 품목을 보고 있는 자재 P/O. 없으면 입고 예정 목록이다. 수량에서 돌아와도 남게 흐름이 붙든다.
   * 목록에서 번호로 다시 찾지 않는다 - 다 받아 미마감 목록에서 빠져도 품목 표가 남아야 한다.
   */
  order: PurchaseOrder | null;
  onOrder: (order: PurchaseOrder | null) => void;
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
 * 라벨이 있으면 제품코드로 자재 P/O 를 좁히지만, 없으면 그럴 수 없다. 입고 예정을 P/O No. · 공급사
 * · 납기예정일 칸의 표로 보이고 공급사명 · 기간으로 거른다. 행을 누르면 그 자재 P/O 의 품목 표로
 * 간다(사용자 지시 2026-10-21, 칸 2026-10-22).
 *
 * 두 표 모두 컬럼 머리가 있고 행은 한 줄이다. 표 안에서 스크롤해도 머리는 위에 붙어 있다. 머리
 * 경계를 끌어 칸 폭을 바꾼다(사용자 지시 2026-10-22).
 * 품목 행에는 자재 P/O 번호도 라인 번호도 적지 않는다 - 고른 자재 P/O 는 표 위에 한 번 적는다.
 *
 * 품목 행마다 체크 칸이 있다. 거의 다 문제없이 들어오므로 이상 없는 행은 체크해(「모두 선택」)
 * 남은 수량 그대로 한꺼번에 등록하고, 문제가 있는 행만 품목명을 눌러 수량 단계에서 따로 처리한다
 * (사용자 지시 2026-10-21).
 */
export const LotlessLines = ({
  orders,
  ordersLoading,
  onEnterOrders,
  suppliers,
  order: openedOrder,
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
  /*
   * 다 받은 라인도 기본으로 함께 보인다 - 초록 바탕으로 무엇이 끝났는지 보여야 한다(사용자 지시
   * 2026-10-21). 「받을 것만」을 켜면 거른다.
   */
  const [openOnly, setOpenOnly] = useState(false);
  /* 일부만 받고 남은 품목만 보기(사용자 지시 2026-10-22). 「필터」 안에 둔다. */
  const [partialOnly, setPartialOnly] = useState(false);
  const toast = useToast();
  /* 거르기 칸은 접어 둔다 - 펼쳐 두면 표가 화면 아래로 밀린다. 걸린 조건 수는 단추가 말한다. */
  const [filterOpen, setFilterOpen] = useState(false);
  const [itemFilterOpen, setItemFilterOpen] = useState(false);
  const order = openedOrder ?? undefined;
  const loaded = usePurchaseOrdersLines(order === undefined ? [] : [order], { fresh: true });
  /*
   * 입고 예정 목록에서는 자재 P/O 마다 라인을 읽어 입하가 다 끝났는지 본다 - 목록 응답에는 라인
   * 수량이 없다. 같은 조회라 행을 눌러 품목 표로 가도 다시 묻지 않는다.
   */
  const everyLine = usePurchaseOrdersLines(order === undefined ? orders : []);
  const labels = useItemLabels(loaded.lines.map((each) => each.line.itemId));
  /*
   * 남는 폭은 입고 예정 표에서는 공급사, 품목 표에서는 품목이 가진다. 칸 구성이 바뀌면 키를
   * 바꾼다 - 남긴 폭이 다른 칸에 걸린다.
   */
  const orderColumns = useColumnResize('lotless-order-columns-v2', 1);
  /* 체크 | No. | 품목 | 수량 - 품목이 남는 폭을 가진다. */
  const itemColumns = useColumnResize('lotless-item-columns-v3', 2);
  const inOrders = order === undefined;
  const enterOrders = useRef(onEnterOrders);
  enterOrders.current = onEnterOrders;
  useEffect(() => {
    if (inOrders) enterOrders.current();
  }, [inOrders]);
  const nameOf = (id: number) =>
    suppliers?.find((each) => each.partnerId === id)?.partnerName ?? t.lotless.supplierUnknown(id);

  if (order === undefined) {
    const active = activeFilterCount(filter);
    /*
     * 입하가 다 끝난 자재 P/O - 라인을 다 읽었고 라인마다 받을 것이 남지 않았다(담긴 채 아직 못 간
     * 것도 받은 것으로 센다). 초록 바탕으로 가른다(사용자 지시 2026-10-21). 라인을 못 읽었으면
     * 끝났다고 단정하지 않는다.
     */
    const isDone = (purchaseOrderId: number) => {
      const lines = everyLine.lines.filter(
        (each) => each.order.purchaseOrderId === purchaseOrderId,
      );

      return (
        lines.length > 0 &&
        lines.every(
          (each) => remainingQtyOf(each.line, queuedFor(each.line.purchaseOrderLineId)) <= 0,
        )
      );
    };
    /*
     * 받을 것이 남은 자재 P/O 를 앞에(2-2 와 같은 차례). 그 안에서는 입고 예정일이 가까운 것부터,
     * 예정일이 없으면 뒤로, 그다음은 공급사명 차례.
     */
    const rows = orders
      .filter((each) => matchesLotlessFilter(each, nameOf(each.supplierId), filter))
      .sort(
        (a, b) =>
          Number(isDone(a.purchaseOrderId)) - Number(isDone(b.purchaseOrderId)) ||
          (a.expectedReceiptDate ?? '9999').localeCompare(b.expectedReceiptDate ?? '9999') ||
          nameOf(a.supplierId).localeCompare(nameOf(b.supplierId)),
      );

    /* 머리 「P/O No.」 보다 좁게는 잡지 않는다. */
    const poChars = Math.max(7, ...rows.map((each) => each.purchaseOrderNo.length));

    return (
      <>
        <div className="lotless__head">
          <span className="lotless__count">{t.lotless.orderCount(rows.length)}</span>
          <span className="lotless__head-actions">
            {/* 입하 완료 건만 - 접지 않고 「필터」 왼쪽에 늘 둔다(사용자 지시 2026-10-22). */}
            <button
              type="button"
              className="lotless__toggle"
              aria-pressed={filter.doneOnly}
              onClick={() => {
                onFilter({ ...filter, doneOnly: !filter.doneOnly });
              }}
            >
              <Icon name={filter.doneOnly ? 'toggle_on' : 'toggle_off'} size={24} />
              {t.lotless.filter.doneOnly}
            </button>
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
          </span>
        </div>

        {/*
         * 기간은 접지 않고 늘 보인다(사용자 지시 2026-10-22) - 기준 단추와 기간 칸을 한 줄에 낮게 둔다.
         * 공급사명 찾기만 「필터」 안에 접힌다.
         */}
        <div className="lotless__period-row">
          {/* 기간은 납기예정일에만 댄다 - 발주일 기준은 뺐다(사용자 지시 2026-10-22). */}
          <span className="lotless__period-label">{t.lotless.filter.basisExpected}</span>
          <DatePicker
            mode="range"
            clearable
            size="sm"
            className="lotless__period"
            aria-label={t.lotless.filter.period}
            placeholder={t.lotless.filter.periodAll}
            value={filter.period}
            onChange={(period) => {
              onFilter({ ...filter, period });
            }}
          />
        </div>

        <div id="lotless-filter" className="lotless__filters" hidden={!filterOpen}>
          <TextField
            aria-label={t.lotless.filter.supplierName}
            placeholder={t.lotless.filter.supplierNamePlaceholder}
            size="md"
            fullWidth
            type="search"
            leadingIcon={<Icon name="search" size={20} />}
            value={filter.supplierName}
            onChange={(event) => {
              onFilter({ ...filter, supplierName: event.target.value });
            }}
          />
          {active === 0 ? null : (
            <button
              type="button"
              className="lotless__clear"
              onClick={() => {
                onFilter({ ...filter, supplierName: '' });
              }}
            >
              <Icon name="close" size={20} />
              {t.lotless.filter.clear}
            </button>
          )}
        </div>

        {ordersLoading ? (
          <ListLoading label={t.po.loading} />
        ) : rows.length === 0 ? (
          <p className="receipt__note">
            {orders.length === 0 && !filter.doneOnly ? t.po.none : t.lotless.filter.none}
          </p>
        ) : (
          /* 표는 화면 바닥까지 - 넘치지 않고 밑에 빈자리도 남기지 않는다(사용자 지시 2026-10-22). */
          <div className="lotless__table-wrap" ref={fillHeightRef}>
            <table className="lotless__table lotless__table--orders">
              <caption className="lotless__hidden">{t.lotless.orders}</caption>
              <thead>
                <tr>
                  {/*
                   * P/O No. 칸은 지금 보이는 가장 긴 번호에 맞춘다 - 번호는 잘리면 안 되고, 남는 폭은
                   * 공급사명이 가져 덜 잘린다(사용자 지시 2026-10-22). 끌어 정한 폭이 있으면 그것이 이긴다.
                   */}
                  <th
                    scope="col"
                    style={orderColumns.styleOf(0) ?? { width: `${String(poChars * MONO_CH)}em` }}
                  >
                    {t.lotless.columns.order}
                    {orderColumns.handle(0, t.lotless.columns.resize(t.lotless.columns.order))}
                  </th>
                  <th scope="col" style={orderColumns.styleOf(1)}>
                    {t.lotless.columns.supplier}
                    {orderColumns.handle(1, t.lotless.columns.resize(t.lotless.columns.supplier))}
                  </th>
                  {/* 칸이 좁아 머리는 줄여 적을 수 있고, 낭독기에는 온 이름을 준다. */}
                  <th
                    scope="col"
                    className="lotless__date"
                    style={orderColumns.styleOf(2)}
                    aria-label={t.lotless.columns.expectedDateFull}
                  >
                    {t.lotless.columns.expectedDate}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((each) => {
                  const supplier = nameOf(each.supplierId);
                  const done = isDone(each.purchaseOrderId);
                  const rowLabel = t.lotless.orderRow(
                    each.purchaseOrderNo,
                    supplier,
                    each.expectedReceiptDate ?? '—',
                  );

                  return (
                    <tr
                      key={each.purchaseOrderId}
                      className={done ? 'lotless__row--closed' : undefined}
                    >
                      <td className="lotless__code">
                        {/*
                         * 행 전체가 누르는 자리다. 단추가 행을 덮는다. 입하가 끝난 자재 P/O 도 눌러
                         * 무엇을 받았는지 품목 표로 본다 - 품목 행은 그 안에서 막힌다.
                         */}
                        <button
                          type="button"
                          className="lotless__pick"
                          aria-label={done ? `${rowLabel} · ${t.lotless.closed}` : rowLabel}
                          onClick={() => {
                            setQuery('');
                            onOrder(each);
                          }}
                        >
                          {each.purchaseOrderNo}
                        </button>
                      </td>
                      <td>{supplier}</td>
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
    .map((each) => {
      const remaining = remainingQtyOf(each.line, queuedFor(each.line.purchaseOrderLineId));

      return {
        ...each,
        item: labels.get(each.line.itemId),
        remaining,
        /* 일부를 받았고 아직 남은 것 - 담긴 채 못 간 것도 받은 것으로 센다. */
        partial: remaining > 0 && remaining < each.line.orderedQty,
      };
    })
    .filter((each) => !openOnly || each.remaining > 0)
    .filter((each) => !partialOnly || each.partial)
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
  /*
   * 「모두 선택」이 고르는 행 - 부분 입하한 것은 뺀다(사용자 지시 2026-10-22). 남은 수량을 그대로
   * 넣으면 부분 입하가 무색해진다. 하나씩 체크하면 넣을 수 있다.
   */
  const partialIds = rows
    .filter((each) => each.partial)
    .map((each) => each.line.purchaseOrderLineId);
  const forAll = checkable.filter((id) => !partialIds.includes(id));
  const checkedHere = forAll.filter((id) => checked.includes(id));
  /* 처음 받을 때도, 받아 둔 것을 다시 받을 때도 - 조금 전 행을 보이지 않는다. */
  const linesLoading = loaded.pending || loaded.fetching;
  const checkedInOrder = loaded.lines.filter((each) =>
    checked.includes(each.line.purchaseOrderLineId),
  ).length;
  const allState: 'none' | 'some' | 'all' =
    checkedHere.length === 0 ? 'none' : checkedHere.length === forAll.length ? 'all' : 'some';
  const filterCount = Number(needle !== '') + Number(partialOnly);

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
        <span className="lotless__count">
          {/* 받는 동안은 조금 전 건수를 적지 않는다. */}
          {linesLoading ? t.lotless.items : t.lotless.count(rows.length)}
          {/* 체크한 수는 여기서 말한다 - 등록 단추 글자는 고정이다(사용자 지시 2026-10-22). */}
          {checkedInOrder === 0 ? null : (
            <span className="lotless__checked">{` ${t.lotless.bulk.checkedCount(checkedInOrder)}`}</span>
          )}
        </span>
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
            {filterCount === 0
              ? t.lotless.itemFilter.open
              : t.lotless.itemFilter.openActive(filterCount)}
          </button>
        </span>
      </div>

      <div id="lotless-item-filter" className="lotless__filters" hidden={!itemFilterOpen}>
        <button
          type="button"
          className="lotless__toggle lotless__filter-toggle"
          aria-pressed={partialOnly}
          onClick={() => {
            setPartialOnly((current) => !current);
          }}
        >
          <Icon name={partialOnly ? 'toggle_on' : 'toggle_off'} size={24} />
          {t.lotless.partialOnly}
        </button>
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
       * 방금 한꺼번에 등록한 것 - 몇 건인지만 말한다. 품목과 수량을 늘어놓던 것은 뺐다(사용자 지시
       * 2026-10-22) - 등록된 수는 표의 입고/발주 수량이 보인다.
       */}
      {done === null ? null : (
        <AlertBanner
          variant={
            done.outcome === 'sent' ? 'success' : done.outcome === 'queued' ? 'warning' : 'error'
          }
          title={t.lotless.bulk.done[done.outcome](done.items.length)}
        />
      )}

      {linesLoading ? <ListLoading label={t.po.linesLoading} /> : null}
      {loaded.failed ? <AlertBanner variant="error" title={t.po.linesLoadFailed} /> : null}
      {!linesLoading && rows.length === 0 ? (
        <p className="receipt__note">
          {needle !== ''
            ? t.lotless.noMatch(query.trim())
            : partialOnly
              ? t.lotless.noPartial
              : loaded.lines.length === 0
                ? t.lotless.empty
                : t.lotless.none}
        </p>
      ) : null}

      {linesLoading || rows.length === 0 ? null : (
        /* 표는 바닥 바 바로 위까지 - 겹치지 않고 띄우지도 않는다(사용자 지시 2026-10-22). */
        <div className="lotless__table-wrap" ref={fillAboveBarRef}>
          <table className="lotless__table lotless__table--items">
            <caption className="lotless__hidden">{t.lotless.items}</caption>
            <thead>
              <tr>
                <th scope="col" className="lotless__check-cell">
                  <SelectAll
                    state={allState}
                    label={t.lotless.bulk.selectAll}
                    onChange={(next) => {
                      if (!next) {
                        onChecked(checked.filter((id) => !checkable.includes(id)));
                        return;
                      }

                      onChecked([...new Set([...checked, ...forAll])]);
                      /* 뺀 것이 있으면 말한다 - 말없이 빼면 다 고른 줄 안다. */
                      const skipped = partialIds.filter((id) => !checked.includes(id)).length;

                      if (skipped > 0) {
                        toast.show({
                          variant: 'warning',
                          description: t.lotless.bulk.partialSkipped(skipped),
                          duration: 3000,
                        });
                      }
                    }}
                  />
                </th>
                <th scope="col" className="lotless__no" style={itemColumns.styleOf(1)}>
                  {t.lotless.columns.no}
                </th>
                <th scope="col" style={itemColumns.styleOf(2)}>
                  {t.lotless.columns.item}
                  {itemColumns.handle(2, t.lotless.columns.resize(t.lotless.columns.item))}
                </th>
                <th scope="col" className="lotless__num" style={itemColumns.styleOf(3)}>
                  {t.lotless.columns.receivedOfOrdered}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ line, item, remaining, partial }, index) => {
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
                    {/* 행 번호 - 지금 보이는 차례(사용자 지시 2026-10-22). */}
                    <td className="lotless__no">{index + 1}</td>
                    {/* 품목명 아래 품목코드 - 한 칸에 두 줄, 행 높이는 그대로(사용자 지시 2026-10-22). */}
                    <td className="lotless__item">
                      {/*
                       * 다 받은 행은 수량 확인으로 들어가지 않는다(사용자 지시 2026-10-21). 잘못 적은
                       * 것을 고치는 길은 나중 일이다 - 지금은 누를 곳을 두지 않는다.
                       */}
                      {remaining <= 0 ? (
                        <span className="lotless__name">
                          {name}
                          <span className="lotless__hidden">{` · ${t.lotless.closed}`}</span>
                        </span>
                      ) : (
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
                      )}
                      <span className="lotless__item-code">{code}</span>
                    </td>
                    <td className="lotless__num">
                      {/* 부분 입하한 행은 받은 수에 옅은 노랑 바탕 - 「모두 선택」이 빼는 행이다. */}
                      <span
                        className={
                          filled ? 'lotless__filled' : partial ? 'lotless__partial' : undefined
                        }
                      >
                        {String(shownReceived)}
                        {partial ? (
                          <span className="lotless__hidden">{` · ${t.lotless.partialTag}`}</span>
                        ) : null}
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
