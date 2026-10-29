import { Chip, type ChipStatus, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useRef } from 'react';

import type { RecordedNote } from './mutations';
import type { ScannedMaterial } from './scan';
import type { ReceiptLineStatus, ReceiptLineView } from './types';

import { PopQtyProgress, PopRowHead, PopRowInfo, PopRowPair } from '../../patterns/pop-list-row';

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

/** 수량을 화면 글자로(단위 포함). */
const withUnit = (value: number, uom: string): string =>
  uom === '' ? String(value) : `${String(value)} ${uom}`;

export interface QtyProgressProps {
  /** 불출량. 불출 줄이 없으면 `null`(기준이 없어 막대를 두지 않는다). */
  received: number | null;
  /** 이 W/O의 투입량(LOT별 합). 없으면 0. */
  recorded: number;
  uom: string;
}

/**
 * 투입량의 값 「30 / 100 KG」(투입량 / 불출량)과 진행 막대(C-21). 라벨 「투입량」은 정보 영역이 붙인다.
 * 목록 줄과 편집 영역이 같은 부품이다. 잔량과 음수는 여기서 보이지 않는다. 막대의 색은 공용
 * `PopQtyProgress` 가 정한다.
 */
export const QtyProgress = ({ received, recorded, uom }: QtyProgressProps) => (
  <PopQtyProgress
    current={recorded}
    target={received}
    text={t.pairs.progress(String(recorded), received === null ? null : String(received), uom)}
    label={t.pairs.progressLabel}
  />
);

/** 불출량에 대한 진행 상태(C-21 끝난 항목). 음수를 만들지 않는다. */
export const progressStateOf = (
  received: number | null,
  recorded: number,
): { kind: 'none' | 'partial' | 'done' } | { kind: 'over'; over: number } => {
  if (received !== null && recorded > received) return { kind: 'over', over: recorded - received };
  if (received !== null && received > 0 && recorded >= received) return { kind: 'done' };

  return { kind: recorded > 0 ? 'partial' : 'none' };
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
  /** 품목 번호를 코드로 옮긴다. 응답에 품목 코드가 없을 때만 쓴다. */
  describeItem: (itemId: number) => string;
  /** 단위 번호를 코드로. 모르면 빈 문자열. */
  describeUom: (uomId: number) => string;
  /** 서버가 통과시키되 기록만 한 것(§5-3). 기록된 줄에만 붙는다. */
  notes: readonly RecordedNote[];
  /** 투입 중인 LOT(스캔하고 아직 전송하지 않음). 진행 칩 「투입 중」이다. */
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
 * 줄은 제목 줄(품목 「이름 (코드)」, 오른쪽 끝에 예외 칩과 진행 칩 하나: 투입 중, 투입 완료, 과투입)과
 * 정보 영역(「LOT 번호」, 「투입량 30 / 100 KG」과 막대)으로 나뉜다(C-21). 금형은 W/O 맥락이라 머리줄에
 * 있다. 수령 상태는 덜 받음이나 못 받음일 때만 칩으로 세운다. 모든 줄에 같은 「수령 완료」가 서면
 * 구분이 사라진다. 줄 순서는 화면이 정한다(PI-32).
 */
export const MaterialList = ({
  rows,
  isLoading,
  hasWorkOrder,
  isError,
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
            const progress = progressStateOf(receipt?.receivedQty ?? null, done?.qty ?? 0);

            return (
              <li
                key={row.key}
                data-lot-id={row.lotId}
                className={[
                  'material-input-lot',
                  isSelected ? 'material-input-lot-selected' : '',
                  progress.kind === 'done' || progress.kind === 'over'
                    ? 'material-input-lot-done'
                    : '',
                ]
                  .filter((name) => name !== '')
                  .join(' ')}
              >
                <button
                  type="button"
                  className="material-input-lot-select"
                  aria-pressed={isSelected}
                  onClick={() => {
                    onSelect(row.lotId);
                  }}
                >
                  {/*
                   * 제목 줄(C-21): 품목 「이름 (코드)」(굵게)와 오른쪽 끝 칩(예외 칩, 맨 끝에 진행 칩 하나).
                   */}
                  <PopRowHead
                    title={named(receipt?.itemName, itemCode)}
                    chips={
                      <>
                        {/* 예외만 칩으로 보인다(C-21 정상은 숨김). */}
                        {receipt !== undefined && receipt.status !== 'matched' && (
                          <Chip
                            variant="status"
                            size="md"
                            status={RECEIPT_STATUS_TONE[receipt.status]}
                          >
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
                        {/*
                         * 진행 칩은 하나(C-21): 투입 중, 투입 완료, 과투입 N. 진행 중이거나 아직 넣지 않은 줄은
                         * 칩 없이 투입량과 막대가 말한다.
                         */}
                        {isPending ? (
                          <Chip variant="status" size="md" status="info">
                            {t.scanned.pendingMark}
                          </Chip>
                        ) : progress.kind === 'over' ? (
                          <Chip variant="status" size="md" status="warning">
                            {t.scanned.overMark(withUnit(progress.over, uom))}
                          </Chip>
                        ) : progress.kind === 'done' ? (
                          <Chip variant="status" size="md" status="success">
                            {t.scanned.completeMark}
                          </Chip>
                        ) : null}
                      </>
                    }
                  />
                  {/* 정보 영역(C-21): 「라벨 값」 쌍을 같은 열에 맞춘다. LOT 번호는 라벨 대조용이다(C-10). */}
                  <PopRowInfo>
                    <PopRowPair label={t.pairs.lotLabel}>
                      <span className="material-input-lot-no">{row.lotNo}</span>
                    </PopRowPair>
                    <PopRowPair label={t.pairs.progressLabel}>
                      <QtyProgress
                        received={receipt?.receivedQty ?? null}
                        recorded={done?.qty ?? 0}
                        uom={uom}
                      />
                    </PopRowPair>
                  </PopRowInfo>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};
