import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import type {
  components,
  ReplenishmentItem,
  ReplenishmentRequestCreated,
  ReplenishmentSettings,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import { SaveErrorBanner } from '../../patterns/master';
import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { useCreateRequest } from './mutations';
import {
  sourceOptions,
  stockOf,
  useManagedItems,
  usePlannedStock,
  useUomCodes,
  useWarehouses,
  type StockLookup,
} from './queries';
import { formatQty, hasErrorCode, parseQty } from './types';

const t = messages.productionWarehouseReplenishment;
const tr = t.request;

type Item = components['schemas']['Item'];

export const PLANNED_STOCK_CONFLICT = 'PLANNED_STOCK_CONFLICT';

/** 요청 줄 입력. `itemId` · `source` 는 고르는 칸의 값(문자열)이다. */
export interface DraftLine {
  key: number;
  itemId: string;
  itemText: string;
  uomCode: string;
  baseUomId: number | null;
  source: string;
  qty: string;
}

let nextKey = 1;
const emptyLine = (): DraftLine => ({
  key: nextKey++,
  itemId: '',
  itemText: '',
  uomCode: '',
  baseUomId: null,
  source: '',
  qty: '',
});

export interface LineCheck {
  /** 막는 오류(출고 자재 창고 없음 · 수량 · 중복). */
  error: string | null;
  /** 남은 수량 안내 — 노랑(일부만) 또는 빨강(0). 막지 않는다. */
  cap: { tone: 'warning' | 'error'; text: string } | null;
}

/**
 * 줄 검사(screens/W-02-12.md 보기 1 · 「입력·검증」). 남은 수량은 서버가 다시 계산한다 — 화면 안내는 막지 않는다
 * (US1-6 · US1-7). 그 창고 조회를 아직 받지 못했으면 안내하지 않는다(받은 창고에 행이 없으면 0).
 */
export const checkLine = (
  line: DraftLine,
  lines: readonly DraftLine[],
  stock: StockLookup,
): LineCheck => {
  if (line.itemId === '') return { error: null, cap: null };
  if (line.source === '') return { error: tr.sourceRequired, cap: null };
  const qty = parseQty(line.qty);
  if (qty === null || qty <= 0) return { error: tr.qtyInvalid, cap: null };
  const duplicate = lines.some(
    (other) =>
      other.key !== line.key && other.itemId === line.itemId && other.source === line.source,
  );
  if (duplicate) return { error: tr.duplicate, cap: null };
  const free = stockOf(stock, line.source, line.itemId)?.free;
  if (free === undefined) return { error: null, cap: null };
  if (free <= 0) return { error: null, cap: { tone: 'error', text: tr.noFree } };
  if (qty > free) {
    return {
      error: null,
      cap: { tone: 'warning', text: tr.capped(formatQty(free), formatQty(qty - free)) },
    };
  }
  return { error: null, cap: null };
};

/** 생산 창고에서 쓸 수 있는 양 = 가용 − 출고 예정(관리 품목 아닌 품목도 같은 값). */
const usableOf = (stock: StockLookup, warehouseId: string, itemId: string): number | null => {
  const figures = stockOf(stock, warehouseId, itemId);
  return figures === undefined ? null : figures.available - figures.planned;
};

export interface RequestViewProps {
  plantId: number;
  productionWarehouses: ReplenishmentSettings['warehouses'];
  onShowProgress: (requestId: number | null) => void;
}

/** 보기 1 — 직접 요청(US1). 만들면 서버가 출고 자재 창고별로 나누고 바로 배포한다. */
export const RequestView = ({
  plantId,
  productionWarehouses,
  onShowProgress,
}: RequestViewProps) => {
  const noteId = useId();
  const [warehouse, setWarehouse] = useState(String(productionWarehouses[0]?.warehouseId ?? ''));
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyLine()]);
  const [created, setCreated] = useState<ReplenishmentRequestCreated | null>(null);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  /** 보낸 줄 — 결과 창이 건너뛴 줄의 품목 이름을 찾는다(보낸 뒤 입력은 비운다). */
  const [sent, setSent] = useState<DraftLine[]>([]);

  const warehouses = useWarehouses(plantId);
  const managed = useManagedItems(plantId, warehouse === '' ? null : Number(warehouse));
  const uoms = useUomCodes();
  const managedOf = (itemId: string): ReplenishmentItem | undefined =>
    managed.data?.find((row) => String(row.itemId) === itemId);
  const sources = sourceOptions(warehouses.data ?? [], warehouse);

  const create = useCreateRequest((result) => {
    setCreated(result);
    setLines([emptyLine()]);
    setRemarks('');
  });

  const update = (key: number, patch: Partial<DraftLine>): void => {
    create.reset();
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const pickItem = (key: number, item: Item): void => {
    const managedItem = managedOf(String(item.itemId));
    update(key, {
      itemId: String(item.itemId),
      itemText: `${item.itemCode} ${item.itemName}`,
      baseUomId: item.baseUomId,
      uomCode: managedItem?.uomCode ?? uoms.data?.get(item.baseUomId) ?? '',
      /* 관리 품목이면 그 출고 자재 창고가 기본값(US1-2). 아니면 비워 두고 고르게 한다(US1-3). */
      source: managedItem === undefined ? '' : String(managedItem.sourceWarehouseId),
    });
  };

  /** 기준 아래 관리 품목을 「유지량 − 쓸 수 있는 양」으로 채운다 — 이미 있는 품목은 건너뛴다. */
  const loadBelow = (): void => {
    create.reset();
    const below = (managed.data ?? []).filter((row) => row.belowPoint);
    if (below.length === 0) {
      setLoadNote(tr.loadBelowNone);
      return;
    }
    setLoadNote(null);
    setLines((prev) => {
      const kept = prev.filter((line) => line.itemId !== '');
      const added = below
        .filter((row) => !kept.some((line) => line.itemId === String(row.itemId)))
        .map((row): DraftLine => ({
          ...emptyLine(),
          itemId: String(row.itemId),
          itemText: `${row.itemCode} ${row.itemName}`,
          uomCode: row.uomCode,
          source: String(row.sourceWarehouseId),
          qty: String(Math.max(0, row.targetQty - row.usableQty)),
        }));
      return [...kept, ...added].length === 0 ? [emptyLine()] : [...kept, ...added];
    });
  };

  /* 생산 창고와 줄마다 고른 출고 자재 창고를 창고별로 묻는다(계약 §1 includeUnplanned). */
  const stock = usePlannedStock(plantId, [warehouse, ...lines.map((line) => line.source)]);
  const checks = lines.map((line) => checkLine(line, lines, stock));
  const filled = lines.filter((line) => line.itemId !== '');
  const blocked = filled.length === 0 || checks.some((check) => check.error !== null);

  const submit = (): void => {
    setSent(filled);
    create.write({
      productionWarehouseId: Number(warehouse),
      businessDate: plantToday(),
      ...(remarks.trim() === '' ? {} : { remarks: remarks.trim() }),
      lines: filled.map((line) => ({
        itemId: Number(line.itemId),
        requestedQty: parseQty(line.qty) ?? 0,
        sourceWarehouseId: Number(line.source),
      })),
    });
  };

  const errorBanner = (() => {
    const error = create.error;
    if (error === null) return null;
    if (hasErrorCode(error, PLANNED_STOCK_CONFLICT)) {
      return <AlertBanner variant="error">{tr.conflict}</AlertBanner>;
    }
    return <SaveErrorBanner error={error} />;
  })();

  const itemName = (itemId: number): string =>
    sent.find((line) => line.itemId === String(itemId))?.itemText ??
    managedOf(String(itemId))?.itemCode ??
    String(itemId);

  return (
    <section className="replenishment-request" aria-label={tr.title}>
      <header className="replenishment-section-head">
        <h2 className="subsection-title">{tr.title}</h2>
        <p className="field-note">{tr.lead}</p>
      </header>
      <div className="replenishment-filter-row">
        <Select
          aria-label={tr.productionWarehouse}
          value={warehouse}
          options={productionWarehouses.map((row) => ({
            value: String(row.warehouseId),
            label: row.warehouseName,
          }))}
          onChange={(value) => {
            create.reset();
            setWarehouse(value);
            setLines([emptyLine()]);
          }}
        />
        <TextField
          aria-label={tr.remarks}
          placeholder={tr.remarks}
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />
      </div>
      {errorBanner}
      <div className="replenishment-table-scroll">
        <table className="replenishment-table" aria-label={tr.title}>
          <thead>
            <tr>
              <th scope="col">{tr.columns.item}</th>
              <th scope="col">{tr.columns.source}</th>
              <th scope="col">{tr.columns.qty}</th>
              <th scope="col">{tr.columns.uom}</th>
              <th scope="col" className="is-number">
                {tr.columns.usable}
              </th>
              <th scope="col" className="is-number">
                {tr.columns.free}
              </th>
              <th scope="col">
                <span className="visually-hidden">{tr.columns.remove}</span>
              </th>
            </tr>
          </thead>
          {lines.map((line, index) => {
            const row = index + 1;
            const check = checks[index] ?? { error: null, cap: null };
            const managedItem = line.itemId === '' ? undefined : managedOf(line.itemId);
            const usable = line.itemId === '' ? null : usableOf(stock, warehouse, line.itemId);
            const free =
              line.itemId === '' || line.source === ''
                ? undefined
                : stockOf(stock, line.source, line.itemId)?.free;
            const notes = check.cap !== null || check.error !== null;
            /* 줄마다 묶음 — 남은 수량 안내 · 오류는 줄 아래 전체 폭 한 줄(screens/W-02-12.md 보기 1). */
            return (
              <tbody key={line.key} className="replenishment-line">
                <tr>
                  <td className="replenishment-item-cell">
                    <ItemSelect
                      aria-label={tr.itemLabel(row)}
                      placeholder={tr.itemPlaceholder}
                      value={line.itemId === '' ? null : line.itemId}
                      {...(line.itemId === ''
                        ? {}
                        : { selectedOption: { value: line.itemId, label: line.itemText } })}
                      onItemChange={(item) => pickItem(line.key, item)}
                    />
                    {line.itemId !== '' && (
                      <span className="field-note replenishment-line-note">
                        {managedItem === undefined
                          ? tr.notManaged
                          : tr.managedNote(
                              formatQty(managedItem.reorderPointQty),
                              formatQty(managedItem.targetQty),
                            )}
                      </span>
                    )}
                  </td>
                  <td className="replenishment-source-cell">
                    <Select
                      aria-label={tr.sourceLabel(row)}
                      placeholder={tr.sourcePlaceholder}
                      value={line.source === '' ? null : line.source}
                      invalid={check.error === tr.sourceRequired}
                      options={sources}
                      onChange={(value) => update(line.key, { source: value })}
                    />
                  </td>
                  <td>
                    <TextField
                      size="sm"
                      inputMode="decimal"
                      aria-label={tr.qtyLabel(row)}
                      value={line.qty}
                      onChange={(event) => update(line.key, { qty: event.target.value })}
                    />
                  </td>
                  <td>{line.uomCode}</td>
                  <td className="is-number">
                    {usable === null ? t.common.none : formatQty(usable)}
                  </td>
                  <td className="is-number">
                    {free === undefined ? t.common.none : formatQty(free)}
                  </td>
                  <td>
                    <Button
                      variant="text"
                      size="sm"
                      aria-label={tr.removeLabel(row)}
                      onClick={() =>
                        setLines((prev) =>
                          prev.length === 1
                            ? [emptyLine()]
                            : prev.filter((other) => other.key !== line.key),
                        )
                      }
                    >
                      ×
                    </Button>
                  </td>
                </tr>
                {notes && (
                  <tr className="replenishment-note-row">
                    <td colSpan={7}>
                      {check.cap !== null && (
                        <span
                          className={`replenishment-cap is-${check.cap.tone}`}
                          role={check.cap.tone === 'error' ? 'alert' : undefined}
                        >
                          {check.cap.text}
                        </span>
                      )}
                      {check.error !== null && (
                        <span className="field-error" role="alert">
                          {check.error}
                        </span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="replenishment-actions">
        <Button
          variant="outlined"
          size="sm"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          {tr.addLine}
        </Button>
        <Button variant="outlined" size="sm" disabled={managed.isPending} onClick={loadBelow}>
          {tr.loadBelow}
        </Button>
        <span className="field-note">{tr.splitNote}</span>
        <span className="replenishment-actions-end">
          {blocked && (
            <span id={noteId} className="field-note">
              {tr.submitBlocked}
            </span>
          )}
          <Button
            disabled={blocked || create.isSaving}
            loading={create.isSaving}
            aria-describedby={blocked ? noteId : undefined}
            onClick={submit}
          >
            {tr.submit}
          </Button>
        </span>
      </div>
      {loadNote !== null && <p className="field-note">{loadNote}</p>}

      <Dialog
        open={created !== null}
        onClose={() => setCreated(null)}
        title={tr.result.title}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={() => setCreated(null)}>
              {tr.result.close}
            </Button>
            <Button
              onClick={() => {
                const first = created?.requests[0]?.materialIssueRequestId ?? null;
                setCreated(null);
                onShowProgress(first);
              }}
            >
              {tr.result.toProgress}
            </Button>
          </>
        }
      >
        {created !== null && (
          <div className="replenishment-result">
            <AlertBanner variant="success">
              {tr.result.created(created.requests.length)}
            </AlertBanner>
            <ul className="replenishment-result-list">
              {created.requests.map((request) => (
                <li key={request.materialIssueRequestId}>
                  {tr.result.request(
                    request.sourceWarehouseName ?? String(request.sourceWarehouseId ?? ''),
                    request.issueRequestNo,
                    request.lineCount ?? 0,
                  )}
                </li>
              ))}
            </ul>
            {created.requests
              .filter((request) => (request.shortageQtyTotal ?? 0) > 0)
              .map((request) => (
                <AlertBanner key={request.materialIssueRequestId} variant="warning">
                  {tr.result.shortage(
                    request.issueRequestNo,
                    formatQty(request.shortageQtyTotal ?? 0),
                  )}
                </AlertBanner>
              ))}
            {created.skippedLines.length > 0 && (
              <section aria-label={tr.result.skippedTitle}>
                <h3 className="subsection-title">{tr.result.skippedTitle}</h3>
                <ul className="replenishment-result-list">
                  {created.skippedLines.map((line) => (
                    <li key={`${String(line.itemId)}-${String(line.sourceWarehouseId)}`}>
                      {tr.result.skipped(itemName(line.itemId), formatQty(line.requestedQty))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
};
