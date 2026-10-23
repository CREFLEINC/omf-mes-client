import { Chip, type ChipStatus, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { Fragment, useEffect, useRef } from 'react';

import type { RecordedNote } from './mutations';
import type { ScannedMaterial } from './scan';
import type { ReceiptLineStatus, ReceiptLineView } from './types';

const t = messages.materialInputScan;

/** 못 받은 값을 적는 공용 어휘. LOT 번호를 못 받았을 때 내부 번호로 메우지 않는다. */
const reference = messages.common.reference;

/**
 * 수령 상태 → 칩의 시맨틱 색. 미수령을 `error`로 칠하되 그것이 「막혔다」는 뜻은 아니다.
 * 부족이나 미수령은 투입을 막지 않는다(스펙 §6) — 막지 않는다는 사실은 구획 맨 위 안내가 말한다.
 */
export const RECEIPT_STATUS_TONE: Record<ReceiptLineStatus, ChipStatus> = {
  matched: 'success',
  short: 'warning',
  none: 'error',
};

export const RECEIPT_STATUS_LABEL: Record<ReceiptLineStatus, string> = {
  matched: t.receiptStatus.matched,
  short: t.receiptStatus.short,
  none: t.receiptStatus.none,
};

export interface QtyRelationProps {
  /** 받은 수량. 받은 줄이 없으면 `null`. */
  received: number | null;
  /** 투입한 수량(이 W/O의 LOT별 합). 없으면 `null`. */
  recorded: number | null;
  /** 남은 수량. 모르면 `null`(단위 다름, 받은 줄 없음). */
  remaining: number | null;
  uom: string;
}

/**
 * 수량 한 줄(C-21): 「받은 수량 100 KG → 투입한 수량 2 KG → 남은 수량 98 KG」. 목록 줄과 편집 영역이 같은
 * 이름과 순서를 쓴다. 투입한 것이 없으면 받은 수량만 보인다(남은 수량이 받은 수량과 같다).
 */
export const QtyRelation = ({ received, recorded, remaining, uom }: QtyRelationProps) => {
  const withUom = (value: number): string =>
    uom === '' ? String(value) : `${String(value)} ${uom}`;
  const parts: { key: string; label: string; value: number }[] = [];
  if (received !== null)
    parts.push({ key: 'received', label: t.pairs.receivedQty, value: received });
  if (recorded !== null) {
    parts.push({ key: 'recorded', label: t.pairs.recordedQty, value: recorded });
    if (remaining !== null) {
      parts.push({ key: 'remaining', label: t.pairs.remainingQty, value: remaining });
    }
  }
  if (parts.length === 0) return null;

  return (
    <span className="material-input-qty-relation">
      {parts.map((part, index) => (
        <Fragment key={part.key}>
          {index > 0 && (
            <span className="material-input-qty-arrow" aria-hidden="true">
              →
            </span>
          )}
          <span className="material-input-qty-part">
            <span className="material-input-qty-name">{part.label}</span>{' '}
            <span className="material-input-qty-value">{withUom(part.value)}</span>
          </span>
        </Fragment>
      ))}
    </span>
  );
};

/**
 * 자재 목록의 한 줄. 수령한 LOT(계획 대비 수령 줄)과 스캔해 담은 LOT을 LOT으로 맞춘다.
 * 수령 줄이 없는 담은 LOT(출고에 귀속되지 않은 자재)은 뒤에 붙는다.
 */
export interface MaterialRow {
  key: string;
  lotId: number;
  lotNo: string;
  itemId: number;
  /** 수령 줄. 출고에 귀속되지 않은 자재면 없다. */
  receipt?: ReceiptLineView;
  /** 스캔해 담은 자재. 아직 스캔하지 않았으면 없다. */
  material?: ScannedMaterial;
}

/** 화면 값만 맞춘다. 판정이나 계산을 하지 않는다 — 수량은 응답과 입력 그대로다. */
export const toMaterialRows = (
  lines: readonly ReceiptLineView[],
  materials: readonly ScannedMaterial[],
): MaterialRow[] => [
  ...lines.map((line) => {
    const material = materials.find((candidate) => candidate.lotId === line.lotId);

    return {
      key: `receipt-${String(line.shopfloorReceiptLineId)}`,
      lotId: line.lotId,
      lotNo: material?.lotNo ?? line.lotNo ?? reference.unknown,
      itemId: line.itemId,
      receipt: line,
      material,
    };
  }),
  ...materials
    .filter((material) => !lines.some((line) => line.lotId === material.lotId))
    .map((material) => ({
      key: `lot-${String(material.lotId)}`,
      lotId: material.lotId,
      lotNo: material.lotNo,
      itemId: material.itemId,
      material,
    })),
];

export interface MaterialListProps {
  rows: readonly MaterialRow[];
  /** 수령 내역을 불러오는 중인가. 담은 자재는 그동안에도 보인다. */
  isLoading: boolean;
  /** 작업지시가 있어 수령 내역을 물었는가. */
  hasWorkOrder: boolean;
  /** 수령 내역을 불러오지 못했는가. 실패는 구획 맨 위 배너가 말하고 빈 상태를 내지 않는다. */
  isError: boolean;
  /** 남은 수량(받은 수량 − 투입한 수량). 모르면 `null`. */
  remainingQtyOf: (lotId: number, uomId: number) => number | null;
  /** 품목 번호를 코드로 옮긴다. 응답에 품목 코드가 없을 때만 쓴다. */
  describeItem: (itemId: number) => string;
  /** 단위 번호를 코드로. 모르면 빈 문자열. */
  describeUom: (uomId: number) => string;
  /** 서버가 통과시키되 기록만 한 것(§5-3). 기록된 줄에만 붙는다. */
  notes: readonly RecordedNote[];
  /** 기록 전인 LOT(스캔하거나 수량을 바꾸고 아직 기록하지 않음, PI-18). */
  pendingLotIds: readonly number[];
  /** 이 W/O에 기록된 투입 수량(LOT별 합). 없으면 `null`. */
  recordedQtyOf: (lotId: number) => { qty: number; uomId: number } | null;
  /** 편집 영역에 연 LOT. 없으면 `null`. */
  selectedLotId: number | null;
  onSelect: (lotId: number) => void;
}

/**
 * 자재 목록.
 *
 * 수령한 LOT(계획 대비 수령)과 스캔해 담은 LOT을 한 목록에 둔다. 작업자는 이 목록으로 받은 자재를
 * 확인하고, 라벨을 스캔하면 그 줄이 담기고 골라진다. 행 전체를 눌러 LOT 하나를 고르고(C-1), 고른
 * LOT은 오른쪽 편집 영역에서 수량을 넣는다. 카드 목록이라 선택은 `aria-pressed`로 알린다(PG-10).
 *
 * 줄은 품목 「이름 (코드)」(첫 줄), LOT 번호(라벨 대조, 고정폭 한 줄), 수량 한 줄(받은 → 투입한 →
 * 남은), 진행 칩 하나와 예외 칩만 보인다(C-21). 금형은 W/O 맥락이라 머리줄에 있다. 출고와 차이, 품목명은 편집 영역이 보인다(PI-04). 수령 상태는 부족이나 미수령일 때만 칩으로
 * 세운다. 모든 줄에 같은 「수령 완료」가 서면 구분이 사라진다.
 */
export const MaterialList = ({
  rows,
  isLoading,
  hasWorkOrder,
  isError,
  remainingQtyOf,
  describeItem,
  describeUom,
  notes,
  pendingLotIds,
  recordedQtyOf,
  selectedLotId,
  onSelect,
}: MaterialListProps) => {
  const listRef = useRef<HTMLUListElement>(null);

  /* 새로 담겨 골라진 줄이 목록 아래에 있어도 보이게 한다. */
  useEffect(() => {
    if (selectedLotId === null) return;

    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-lot-id="${String(selectedLotId)}"]`,
    );
    /* 시험 환경(jsdom)에는 스크롤 함수가 없다. */
    if (typeof row?.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
  }, [selectedLotId]);

  return (
    <>
      {isLoading && rows.length === 0 ? (
        <div role="status" aria-label={t.loading.receipt} className="material-input-lots">
          <SkeletonText lines={3} />
        </div>
      ) : rows.length === 0 && isError ? (
        <div className="material-input-lots" />
      ) : rows.length === 0 ? (
        <div className="material-input-lots">
          {hasWorkOrder ? (
            <EmptyState size="sm" live title={t.empty.receiptTitle} />
          ) : (
            <EmptyState size="sm" title={t.empty.notQueriedTitle} />
          )}
        </div>
      ) : (
        <ul ref={listRef} className="material-input-lots" aria-label={t.scanned.materialsLabel}>
          {rows.map((row) => {
            const { material, receipt } = row;
            const isPending = material !== undefined && pendingLotIds.includes(row.lotId);
            const done = recordedQtyOf(row.lotId);
            const isSelected = row.lotId === selectedLotId;
            const uomId = receipt?.uomId ?? done?.uomId ?? material?.uomId;
            const uom = uomId === undefined ? '' : describeUom(uomId);
            const itemCode = receipt?.itemCode ?? describeItem(row.itemId);
            const isUnlinked = notes.some((note) => note.lotId === row.lotId && note.unlinkedIssue);
            const isUnitMismatch =
              material !== undefined && receipt !== undefined && material.uomId !== receipt.uomId;

            return (
              <li
                key={row.key}
                data-lot-id={row.lotId}
                className={
                  isSelected
                    ? 'material-input-lot material-input-lot-selected'
                    : 'material-input-lot'
                }
              >
                <button
                  type="button"
                  className="material-input-lot-select"
                  aria-pressed={isSelected}
                  onClick={() => {
                    onSelect(row.lotId);
                  }}
                >
                  {/* 첫 줄은 품목 「이름 (코드)」, 그 아래 라벨과 대조하는 LOT 번호(C-21, C-10). */}
                  <span className="material-input-lot-name">
                    {named(receipt?.itemName, itemCode)}
                  </span>
                  <span className="material-input-lot-no">{row.lotNo}</span>
                  <span className="material-input-lot-facts">
                    <QtyRelation
                      received={receipt?.receivedQty ?? null}
                      recorded={done?.qty ?? null}
                      remaining={
                        done === null || uomId === undefined
                          ? null
                          : remainingQtyOf(row.lotId, uomId)
                      }
                      uom={uom}
                    />
                    {/*
                     * 진행 칩은 하나(C-21). 투입한 줄은 칩 대신 「투입한 수량」이 진행을 말한다.
                     */}
                    {isPending ? (
                      <Chip variant="status" size="md" status="info">
                        {t.scanned.pendingMark}
                      </Chip>
                    ) : done === null ? (
                      <Chip variant="status" size="md" status="idle">
                        {t.scanned.notScannedMark}
                      </Chip>
                    ) : null}
                    {/* 예외만 칩으로 보인다(C-21 정상은 숨김). */}
                    {receipt !== undefined && receipt.status !== 'matched' && (
                      <Chip variant="status" size="md" status={RECEIPT_STATUS_TONE[receipt.status]}>
                        {RECEIPT_STATUS_LABEL[receipt.status]}
                      </Chip>
                    )}
                    {isUnitMismatch && (
                      <Chip variant="status" size="md" status="warning">
                        {t.scanned.unitMismatch}
                      </Chip>
                    )}
                    {material?.isHeld === true && (
                      <Chip variant="status" size="md" status="warning">
                        {t.scanned.heldMark}
                      </Chip>
                    )}
                    {/* IQC 에서 적은 4M 변경품 — 투입은 막지 않고 알린다(omf-all-around#63). */}
                    {material !== undefined && material.fourMChange !== null && (
                      <Chip variant="status" size="md" status="warning">
                        {t.scanned.fourMChangeMark}
                      </Chip>
                    )}
                    {/* 서버가 통과시키되 기록만 한 것(스펙 §5-3). 보내기 전에는 없다. */}
                    {isUnlinked && (
                      <Chip variant="status" size="md" status="info">
                        {t.scanned.unlinkedIssue}
                      </Chip>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};
