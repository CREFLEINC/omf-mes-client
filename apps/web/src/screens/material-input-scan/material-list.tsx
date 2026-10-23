import { Chip, type ChipStatus, EmptyState, Progress, SkeletonText } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useRef } from 'react';

import type { RecordedNote } from './mutations';
import { isShotCountExceeded, type ScanDraft, type ScannedMaterial } from './scan';
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
  draft: ScanDraft;
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
 * 자재 목록과 지정한 금형.
 *
 * 수령한 LOT(계획 대비 수령)과 스캔해 담은 LOT을 한 목록에 둔다. 작업자는 이 목록으로 받은 자재를
 * 확인하고, 라벨을 스캔하면 그 줄이 담기고 골라진다. 행 전체를 눌러 LOT 하나를 고르고(C-1), 고른
 * LOT은 오른쪽 편집 영역에서 수량을 넣는다. 카드 목록이라 선택은 `aria-pressed`로 알린다(PG-10).
 *
 * 행은 LOT 번호(저장값 그대로 고정폭 한 줄, C-10), 품목 「이름 (코드)」, 수령 수량, 이 W/O에 이미
 * 기록된 투입 수량, 상태 칩만 보인다. 출고와 차이, 품목명은 편집 영역이 보인다(PI-04). 수령 상태는 부족이나 미수령일 때만 칩으로
 * 세운다. 모든 줄에 같은 「수령 완료」가 서면 구분이 사라진다.
 */
export const MaterialList = ({
  rows,
  isLoading,
  hasWorkOrder,
  isError,
  draft,
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
            const isRecorded = !isPending && done !== null;
            const isSelected = row.lotId === selectedLotId;
            const withUom = (value: number, uomId: number | undefined): string => {
              const uom = uomId === undefined ? '' : describeUom(uomId);

              return uom === '' ? String(value) : `${String(value)} ${uom}`;
            };
            const itemCode = receipt?.itemCode ?? describeItem(row.itemId);
            const isUnlinked = notes.some((note) => note.lotId === row.lotId && note.unlinkedIssue);

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
                  <span className="material-input-lot-no">{row.lotNo}</span>
                  <span className="material-input-lot-facts">
                    {/* 한 줄 안의 기준 정보는 「이름 (코드)」다(C-10). 이름이 없으면 코드만. */}
                    <span>{named(receipt?.itemName, itemCode)}</span>
                    {receipt !== undefined && (
                      <span>
                        {t.pairs.receivedQty} {withUom(receipt.receivedQty, receipt.uomId)}
                      </span>
                    )}
                    {done !== null && (
                      <span>
                        {t.pairs.recordedQty} {withUom(done.qty, done.uomId)}
                      </span>
                    )}
                    {receipt !== undefined && receipt.status !== 'matched' && (
                      <Chip variant="status" size="md" status={RECEIPT_STATUS_TONE[receipt.status]}>
                        {RECEIPT_STATUS_LABEL[receipt.status]}
                      </Chip>
                    )}
                    <Chip
                      variant="status"
                      size="md"
                      status={isPending ? 'info' : isRecorded ? 'success' : 'idle'}
                    >
                      {isPending
                        ? t.scanned.pendingMark
                        : isRecorded
                          ? t.scanned.recordedMark
                          : t.scanned.notScannedMark}
                    </Chip>
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

      {/* 금형은 한 번에 하나다. 한 줄로 「이름 (코드)」와 타발 수를 보인다(C-10). */}
      <div className="material-input-mold">
        <span className="material-input-mold-label">{t.scanned.moldLabel}</span>
        {draft.mold === null ? (
          <span className="field-note">{t.scanned.moldEmpty}</span>
        ) : (
          <>
            <span>{named(draft.mold.moldName, draft.mold.moldCode)}</span>
            {draft.mold.guaranteedShotCount === null ? (
              /* 적정 타수가 없으면 진행률을 그릴 수 없다 — 0으로 채우면 「거의 새것」으로 보인다. */
              <span className="field-note">
                {t.scanned.shotCountUnknown(draft.mold.currentShotCount)}
              </span>
            ) : (
              <>
                <span className="field-note">
                  {t.scanned.shotCount(draft.mold.currentShotCount, draft.mold.guaranteedShotCount)}
                </span>
                <Progress
                  value={draft.mold.currentShotCount}
                  max={draft.mold.guaranteedShotCount}
                  label={t.scanned.moldLabel}
                  valueText={t.scanned.shotCount(
                    draft.mold.currentShotCount,
                    draft.mold.guaranteedShotCount,
                  )}
                />
                {isShotCountExceeded(draft.mold) && (
                  /* 경고이지 차단이 아니다(미결 #6). 문구가 그 사실을 함께 말한다. */
                  <span className="field-note">{t.scanned.shotCountExceeded}</span>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};
