import { isForbidden } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { formatBaseQty, isCountUom, parseQtyInput } from '../../patterns/package-qty';
import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  PuButton,
  PuChip,
  PuDialog,
  PuEmpty,
  PuField,
  PuInput,
  PuKeypad,
  PuNote,
  applyKeypadKey,
} from '../../patterns/pop-uniform';
import { PuSearchBox } from '../../patterns/pop-uniform/search-box';
import { toApiError } from '../../patterns/request';
import { lineOf, type ReturnLine } from './lines';
import {
  useReturnLookup,
  useReturnWorkOrderLots,
  useReturnWorkOrders,
  type ReturnWorkOrder,
  type ReturnWorkOrderLot,
} from './queries';
import { returnReasonOf } from './reason';

/* 부를 때 읽는다 — 단말 언어(`setLocale`)를 모듈이 실릴 때 붙잡지 않는다. */
const words = () => messages.materialReturn;

/** 출고 시각 `MM-DD HH:mm`(공장 시각). 못 읽으면 받은 그대로. */
export const shortAt = (value: string): string => (formatPlantDateTime(value) ?? value).slice(5);

/**
 * 처음 고를 LOT — 라벨 미발행 LOT 이 «한 품목에만» 있고 그 품목에 하나뿐이면 그 LOT(US4-3 · FR-015), 목록에 LOT 이
 * 하나뿐이면 그 LOT. 미발행이 여럿이면 출고 시각 · 수량을 보고 사람이 고른다.
 */
export const initialLotId = (lots: readonly ReturnWorkOrderLot[]): number | null => {
  if (lots.length === 1) return lots[0]?.lotId ?? null;
  const unprinted = lots.filter((lot) => lot.labelUnprinted);
  const items = new Set(unprinted.map((lot) => lot.item.itemId));

  return unprinted.length === 1 && items.size === 1 ? (unprinted[0]?.lotId ?? null) : null;
};

/** 「B-220 하우징 커버(좌)」 — W/O 줄의 품목. */
const itemOf = (workOrder: ReturnWorkOrder): string =>
  `${workOrder.item.itemCode} ${workOrder.item.itemName}`;

const processOf = (workOrder: ReturnWorkOrder): string =>
  [workOrder.processName, workOrder.lineName]
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join(' · ');

type QtyProblem = 'range' | 'integer' | null;

const qtyProblemOf = (text: string, lot: ReturnWorkOrderLot | null): QtyProblem => {
  const qty = parseQtyInput(text);
  if (qty === null || lot === null) return null;
  if (isCountUom(lot.uom.uomCode) && !Number.isInteger(qty)) return 'integer';
  if (!(qty > 0) || qty > lot.returnableQty) return 'range';

  return null;
};

/**
 * 「라벨이 없어요 · W/O 로 찾기」 창(US4 · 시안 ③) — ① W/O 고르기(번호 일부 찾기 · 「라벨 미발행 n」 · 「최종 마감」)
 * ② 그 W/O 의 자재 LOT 고르기(미발행 먼저 · 하나면 자동 선택) ③ 수량 → [목록에 담기].
 *
 * ⭐ W/O 를 스캔할 인쇄물이 없어 목록에서 고른다(research R-5). 담은 줄은 고른 W/O 를 들고 가 그 W/O 에 붙는다(FR-016).
 * ⭐ 담기 전에 그 LOT 을 다시 조회한다 — 받는 곳(출고 생산창고)과 지금 반납 가능 양을 스캔 줄과 같은 값으로 갖는다.
 */
export const FindByWorkOrderDialog = ({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (line: ReturnLine) => void;
}) => {
  const t = words().findByWo;
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ReturnWorkOrder | null>(null);
  const [lotId, setLotId] = useState<number | null>(null);
  const [autoLotId, setAutoLotId] = useState<number | null>(null);
  const [qtyText, setQtyText] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const workOrders = useReturnWorkOrders(query, picked === null);
  const lots = useReturnWorkOrderLots(picked?.workOrderId ?? null);
  const lookup = useReturnLookup();

  const lotList = lots.data ?? [];
  const lot = lotList.find((each) => each.lotId === lotId) ?? null;
  const qty = parseQtyInput(qtyText);
  const qtyProblem = qtyProblemOf(qtyText, lot);
  const canAdd = lot !== null && qty !== null && qtyProblem === null && !lookup.isPending;

  /* 목록이 오면 한 번 처음 LOT 을 고른다(자동 선택). 사람이 고르면 그 값이 이긴다. */
  if (picked !== null && lots.data !== undefined && autoLotId === null && lotId === null) {
    const initial = initialLotId(lots.data);
    if (initial !== null) {
      setAutoLotId(initial);
      setLotId(initial);
    }
  }

  const pickWorkOrder = (workOrder: ReturnWorkOrder): void => {
    setPicked(workOrder);
    setLotId(null);
    setAutoLotId(null);
    setQtyText('');
    setAddError(null);
  };

  const backToWorkOrders = (): void => {
    setPicked(null);
    setLotId(null);
    setAutoLotId(null);
    setQtyText('');
    setAddError(null);
  };

  const add = (): void => {
    if (!canAdd || picked === null) return;
    setAddError(null);
    lookup.mutate(lot.lotNo, {
      onSuccess: (found) => {
        onAdd(lineOf(found, picked.workOrderId, qtyText));
      },
      onError: (cause) => {
        const error = toApiError(cause);
        setAddError(
          isForbidden(error)
            ? words().pop.forbidden
            : (returnReasonOf(error, () => lot.uom.uomCode) ?? t.loadFailed),
        );
      },
    });
  };

  const decimal = lot === null ? true : !isCountUom(lot.uom.uomCode);

  return (
    <PuDialog
      wide
      title={t.title}
      onClose={onClose}
      footer={
        <>
          <PuButton onClick={onClose}>{t.close}</PuButton>
          {picked === null ? null : (
            <PuButton variant="primary" icon="plus" disabled={!canAdd} onClick={add}>
              {t.add}
            </PuButton>
          )}
        </>
      }
    >
      <ol className="pmr-steps" aria-label={t.title}>
        <li className={picked === null ? 'is-on' : 'is-done'}>{t.steps.workOrder}</li>
        <li className={picked !== null && lot === null ? 'is-on' : lot !== null ? 'is-done' : ''}>
          {t.steps.lot}
        </li>
        <li className={lot !== null ? 'is-on' : ''}>{t.steps.qty}</li>
      </ol>

      {picked === null ? (
        <WorkOrderStep
          query={query}
          onQuery={setQuery}
          isLoading={workOrders.isPending}
          isError={workOrders.isError}
          isForbidden={workOrders.isError && isForbidden(toApiError(workOrders.error))}
          items={workOrders.data?.items ?? []}
          onPick={pickWorkOrder}
        />
      ) : (
        <div className="pmr-wo-lots">
          <div className="pmr-wo-head">
            <span>
              <b className="pu-mono">{picked.workOrderNo}</b>
              {processOf(picked) === '' ? null : ` · ${processOf(picked)}`}
            </span>
            {picked.finalized ? <PuChip tone="warn">{t.finalized}</PuChip> : null}
            <PuButton size="sm" variant="ghost" onClick={backToWorkOrders}>
              {t.back}
            </PuButton>
          </div>
          {picked.finalized ? <PuNote>{t.finalizedNote}</PuNote> : null}
          {lots.isPending ? (
            <PuNote live>{t.loading}</PuNote>
          ) : lots.isError ? (
            <PuNote tone="bad">
              {isForbidden(toApiError(lots.error)) ? words().pop.forbidden : t.loadFailed}
            </PuNote>
          ) : lotList.length === 0 ? (
            <PuEmpty icon="box" title={t.emptyLots} />
          ) : (
            /* 표 왼쪽 · 수량 오른쪽 — 아래 키패드 판이 수량 · 안내를 가리지 않게(시안 ③-2 · 실제 앱 확인 F-07). */
            <div className={lot === null ? 'pmr-wo-pick' : 'pmr-wo-pick has-qty'}>
              <LotTable
                lots={lotList}
                selected={lotId}
                autoLotId={autoLotId}
                onPick={(next) => {
                  setLotId(next);
                  setQtyText('');
                  setAddError(null);
                }}
              />
              {lot === null ? null : (
                <div className="pmr-wo-qty">
                  <PuField label={t.qty} required>
                    <div className="pu-row">
                      <PuInput
                        value={qtyText}
                        aria-label={t.qty}
                        numeric
                        target
                        need={qtyText === ''}
                        inputMode="none"
                        readOnly
                      />
                      <span className="pu-unit">{lot.uom.uomCode}</span>
                    </div>
                  </PuField>
                  <span className="pmr-hint">
                    {words().pop.returnableHint(formatBaseQty(lot.returnableQty, lot.uom.uomCode))}
                  </span>
                  {qtyProblem === null ? null : (
                    <PuNote tone="bad">
                      {qtyProblem === 'integer'
                        ? words().pop.qtyInteger
                        : words().pop.qtyOver(formatBaseQty(lot.returnableQty, lot.uom.uomCode))}
                    </PuNote>
                  )}
                  {addError === null ? <span className="pmr-hint">{t.addHint}</span> : null}
                  {addError === null ? null : <PuNote tone="bad">{addError}</PuNote>}
                  {/*
                   * 숫자 키패드는 수량 칸 아래(창 오른쪽 칸)에 둔다 — 화면 아래 판(글자판 높이)에 두면 1280×800 에서
                   * 창이 판 위로 눌려 LOT 표가 두 줄 반만 보였다(F-07). 숫자만 받는 창의 선례: 자재 LOT 라벨
                   * 「수정」 · 「한꺼번에 발행」 창.
                   */}
                  <div className="pmr-wo-keypad">
                    <PuKeypad
                      targetLabel={t.qty}
                      showTarget={false}
                      decimal={decimal}
                      disabled={lookup.isPending}
                      onKey={(key) => {
                        setQtyText((current) => applyKeypadKey(current, key, { decimal }));
                        setAddError(null);
                      }}
                      onClearAll={() => {
                        setQtyText('');
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PuDialog>
  );
};

const WorkOrderStep = ({
  query,
  onQuery,
  isLoading,
  isError,
  isForbidden: forbidden,
  items,
  onPick,
}: {
  query: string;
  onQuery: (value: string) => void;
  isLoading: boolean;
  isError: boolean;
  /** 「반납 가능」이 꺼진 단말(서버 403) — 연결 문구가 아니라 권한 문구(F-09). */
  isForbidden: boolean;
  items: readonly ReturnWorkOrder[];
  onPick: (workOrder: ReturnWorkOrder) => void;
}) => {
  const t = words().findByWo;

  return (
    <div className="pmr-wo-list">
      <PuSearchBox value={query} onChange={onQuery} label={t.search} />
      <span className="pmr-hint">{t.recent}</span>
      {isLoading ? (
        <PuNote live>{t.loading}</PuNote>
      ) : isError ? (
        <PuNote tone="bad">{forbidden ? words().pop.forbidden : t.loadFailed}</PuNote>
      ) : items.length === 0 ? (
        <PuEmpty
          icon="search"
          title={query.trim() === '' ? t.emptyWorkOrders : t.emptySearch(query.trim())}
        />
      ) : (
        <ul className="pmr-wo-items" aria-label={t.recent}>
          {items.map((workOrder) => (
            <li key={workOrder.workOrderId}>
              <button
                type="button"
                className="pmr-wo-item"
                onClick={() => {
                  onPick(workOrder);
                }}
              >
                <span className="pmr-wo-main">
                  <b className="pu-mono">{workOrder.workOrderNo}</b>
                  {workOrder.unprintedLotCount > 0 ? (
                    <PuChip tone="info">{t.unprinted(workOrder.unprintedLotCount)}</PuChip>
                  ) : null}
                  {workOrder.finalized ? <PuChip tone="warn">{t.finalized}</PuChip> : null}
                </span>
                <span className="pmr-wo-sub">
                  {t.workOrderLine(
                    itemOf(workOrder),
                    processOf(workOrder) === '' ? '-' : processOf(workOrder),
                    shortAt(workOrder.lastIssuedAt),
                  )}
                </span>
                <span className="pmr-wo-choose">{t.choose}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LotTable = ({
  lots,
  selected,
  autoLotId,
  onPick,
}: {
  lots: readonly ReturnWorkOrderLot[];
  selected: number | null;
  autoLotId: number | null;
  onPick: (lotId: number) => void;
}) => {
  const t = words().findByWo;

  return (
    <div className="pu-table-wrap" role="group" aria-label={t.lotTable.label}>
      <table className="pu-table">
        <thead>
          <tr>
            <th>{t.lotTable.item}</th>
            <th>{t.lotTable.lotNo}</th>
            <th className="fit">{t.lotTable.issued}</th>
            <th className="num fit">{t.lotTable.returnable}</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr
              key={lot.lotId}
              className={lot.lotId === selected ? 'is-pick is-selected' : 'is-pick'}
              aria-selected={lot.lotId === selected}
              onClick={() => {
                onPick(lot.lotId);
              }}
            >
              <td className="pmr-two" title={`${lot.item.itemCode} ${lot.item.itemName}`}>
                <b className="pu-mono">{lot.item.itemCode}</b>
                <span className="pmr-sub">{lot.item.itemName}</span>
              </td>
              <td className="pmr-lotcol">
                <span className="pu-mono pmr-lotno">{lot.lotNo}</span>
                {lot.labelUnprinted ? <PuChip tone="info">{t.labelUnprinted}</PuChip> : null}
                {lot.lotId === autoLotId ? <PuChip tone="ok">{t.autoPicked}</PuChip> : null}
              </td>
              <td className="fit">
                {shortAt(lot.issuedAt)}
                <span className="pmr-sub">{formatBaseQty(lot.issueQty, lot.uom.uomCode)}</span>
              </td>
              <td className="num fit">
                <button
                  type="button"
                  className="pmr-row-pick"
                  aria-label={`${t.pickedLot} ${lot.lotNo}`}
                  aria-pressed={lot.lotId === selected}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPick(lot.lotId);
                  }}
                >
                  {formatBaseQty(lot.returnableQty, lot.uom.uomCode)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
