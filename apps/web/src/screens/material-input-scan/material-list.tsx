import { messages, named } from '@omf-mes/i18n';
import { useEffect, useRef } from 'react';

import type { RecordedNote } from './mutations';
import type { ScannedMaterial, WipLotInfo } from './scan';
import type { ReceiptLineStatus, ReceiptLineView } from './types';

import {
  PuChip,
  PuEmpty,
  PuPager,
  puCx,
  useClientPage,
  useFitCount,
  type PuChipTone,
} from '../../patterns/pop-uniform';
import { ListOrderFoot, listDateTimeText, type ListOrder } from '../../patterns/pop-list-order';

const t = messages.materialInputScan;

/** 못 받은 값을 적는 공용 어휘. LOT 번호를 못 받았을 때 내부 번호로 메우지 않는다. */
const reference = messages.common.reference;

/**
 * 수령 상태 → 칩의 색(POP 통일 규칙 10). 덜 받음과 못 받음은 노랑 — 투입을 막지 않는다(스펙 §6).
 * `matched` 는 화면에 두지 않는다(C-21 정상은 숨김).
 */
export const RECEIPT_STATUS_TONE: Record<ReceiptLineStatus, PuChipTone> = {
  matched: 'ok',
  short: 'warn',
  none: 'warn',
};

export const RECEIPT_STATUS_LABEL: Record<ReceiptLineStatus, string> = {
  matched: t.receiptStatus.matched,
  short: t.receiptStatus.short,
  none: t.receiptStatus.none,
};

/** 수량을 화면 글자로(단위 포함). */
const withUnit = (value: number, uom: string): string =>
  uom === '' ? String(value) : `${String(value)} ${uom}`;

/** 뺄셈의 부동소수 꼬리(0.1 + 0.2 꼴)를 털어 낸다 — 실적·남은 수량은 서버 값 그대로이고 이 차만 화면이 낸다. */
const tidy = (value: number): number => Number(value.toFixed(6));

/**
 * 공정 반제품 줄의 근거 「실적 100 · 투입 60 · 남은 수량 40 EA」(피처 016 · 시안 2판 ①). 투입 = 실적 − 남은.
 * `remaining` 은 지금의 남은 수량 — 조회한 뒤 이 화면이 보낸 투입을 뺀 값(화면 `wipLeftOf`)이다. 스캔 때 값을 그대로
 * 쓰면 투입 등록 뒤에도 줄이 바뀌지 않는다(실제 앱 확인 2026-11-26).
 * 실적이나 남은 수량을 받지 못했으면 줄을 두지 않는다 — 모르는 값을 0 으로 적지 않는다.
 */
export const wipBasisText = (
  wip: WipLotInfo,
  remaining: number | null,
  uom: string,
): string | null =>
  wip.producedQty === null || remaining === null
    ? null
    : t.wip.basis(
        String(wip.producedQty),
        String(tidy(wip.producedQty - remaining)),
        withUnit(remaining, uom),
      );

export interface QtyProgressProps {
  /** 불출량. 불출 줄이 없으면 `null`(기준이 없어 막대를 두지 않는다). */
  received: number | null;
  /** 이 W/O의 투입량(LOT별 합). 없으면 0. */
  recorded: number;
  uom: string;
}

/**
 * 투입량의 값 「30 / 100 KG」(투입량 / 불출량)과 진행 막대(C-21). 불출량에 닿으면 초록, 넘으면 노랑.
 * 잔량과 음수는 보이지 않는다.
 */
export const QtyProgress = ({ received, recorded, uom }: QtyProgressProps) => {
  const text = t.pairs.progress(String(recorded), received === null ? null : String(received), uom);
  const isOver = received !== null && recorded > received;
  const max = received !== null && received > 0 ? received : 1;
  const ratio = received === null ? 0 : Math.min(1, recorded / max);

  return (
    <span className="mi-prog">
      <b className="mi-prog-text">{text}</b>
      {received !== null && (
        <span
          className={puCx('pu-progress', isOver && 'mi-over')}
          role="progressbar"
          aria-label={t.pairs.progressLabel}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={Math.min(recorded, max)}
          aria-valuetext={text}
        >
          <i style={{ width: `${String(Math.round(ratio * 100))}%` }} />
        </span>
      )}
    </span>
  );
};

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

/** 고른 줄 안 투입 기록 한 건(PI-30). */
export interface InputRecordView {
  key: string;
  qty: number;
  uomId: number;
  occurredAt: string;
  /** 「미전송」(단말에 있음) 또는 「전송 완료」. */
  state: 'pending' | 'sent';
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 투입 기록의 시각. 오늘이면 「HH:mm」, 아니면 「MM-DD HH:mm」. */
const timeOf = (iso: string, now: Date = new Date()): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
  const isToday =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();

  return isToday ? time : `${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${time}`;
};

/** 고른 줄에 보이는 투입 내역 건수(시안: 최근 3건 + 「외 N건」). */
const RECORDS_SHOWN = 3;

export interface MaterialListProps {
  rows: readonly MaterialRow[];
  /** 수령 내역을 불러오는 중인가. 담은 자재는 그동안에도 보인다. */
  isLoading: boolean;
  /** 작업지시가 있어 수령 내역을 물었는가. */
  hasWorkOrder: boolean;
  /** 수령 내역을 불러오지 못했는가. 실패는 스캔 칸 아래 안내가 말하고 빈 상태를 내지 않는다. */
  isError: boolean;
  /** 품목 번호를 코드로 옮긴다. 응답에 품목 코드가 없을 때만 쓴다. */
  describeItem: (itemId: number) => string;
  /** 단위 번호를 코드로. 모르면 빈 문자열. */
  describeUom: (uomId: number) => string;
  /** 서버가 통과시키되 기록만 한 것(§5-3). 기록된 줄에만 붙는다. */
  notes: readonly RecordedNote[];
  /** 투입 중인 LOT(스캔하고 아직 전송하지 않음). 진행 칩 「투입 중」이다. */
  pendingLotIds: readonly number[];
  /** 공정 반제품의 지금 남은 수량(조회 값 − 이 화면이 보낸 투입). 모르면 `null`(피처 016). */
  wipLeftOf: (lotId: number, wip: WipLotInfo) => number | null;
  /** 이 W/O에 기록된 투입 수량(LOT별 합). 없으면 `null`. */
  recordedQtyOf: (lotId: number) => { qty: number; uomId: number } | null;
  /** 고른 LOT. 없으면 `null`. */
  selectedLotId: number | null;
  /** 고른 LOT의 투입 기록(시각 순, 「미전송」은 끝). */
  selectedRecords: readonly InputRecordView[];
  /** 바뀌면 고른 줄이 든 쪽으로 넘긴다(스캔할 때 올린다). */
  revealKey: number;
  /** 목록 아래 왼쪽 한 줄(투입할 자재 N건, 투입 완료 N건). */
  summary: string | null;
  onSelect: (lotId: number) => void;
  /** 목록 정렬(수령 일시) — 할 일 먼저 묶음 안에서만 건다. 줄 순서는 화면이 정해 `rows` 로 준다. */
  order: ListOrder;
  onOrderChange: (order: ListOrder) => void;
}

/**
 * 자재 목록(POP 통일 시안 P-02-03) — 제목 없음(위 작업지시 띠가 무엇의 목록인지 말한다).
 *
 * 수령한 LOT(계획 대비 수령)과 스캔해 담은 LOT을 한 목록에 둔다. 모든 줄을 펼친 채(LOT · 투입량이 늘 보임)
 * 구획 높이에 들어가는 만큼 보이고, 아래 쪽 넘김으로 본다 — 구획 안 스크롤 없음(규칙 1). LOT을 스캔하면
 * 그 자재가 든 쪽으로 넘어간다. 줄 전체를 눌러 LOT 하나를 고르고(C-1), 고른 줄에는 투입 내역(최근 3건)이
 * 한 줄로 붙는다. 카드 목록이라 선택은 `aria-pressed`로 알린다(PG-10). 줄 순서는 화면이 정한다(PI-32).
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
  wipLeftOf,
  selectedLotId,
  selectedRecords,
  revealKey,
  summary,
  onSelect,
  order,
  onOrderChange,
}: MaterialListProps) => {
  const fitRef = useRef<HTMLUListElement>(null);
  const fitCount = useFitCount(fitRef, { fallback: 0 });
  /* 재기 전(시험 환경 포함)에는 한 쪽에 다 둔다 — 줄이 없으면 잴 수 없다. */
  const size = fitCount > 0 ? fitCount : Math.max(1, rows.length);
  const paged = useClientPage(rows, size);
  const { showIndex } = paged;

  /* 스캔으로 골라진 줄이 다른 쪽에 있으면 그 쪽으로 넘긴다. */
  const selectedIndex = rows.findIndex((row) => row.lotId === selectedLotId);
  useEffect(() => {
    if (selectedIndex >= 0) showIndex(selectedIndex);
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 고른 LOT이 바뀌거나 스캔할 때만 넘긴다. */
  }, [selectedLotId, revealKey]);

  const hasRows = rows.length > 0;

  return (
    <>
      <div className="mi-list-area">
        {isLoading && !hasRows ? (
          <PuEmpty icon="clock" title={t.loading.receipt} />
        ) : !hasRows && isError ? null : !hasRows ? (
          hasWorkOrder ? (
            <PuEmpty icon="box" title={t.empty.receiptTitle} hint={t.empty.receiptHint} />
          ) : (
            <PuEmpty icon="list" title={t.empty.notQueriedTitle} hint={t.empty.notQueriedHint} />
          )
        ) : null}
        <ul
          ref={fitRef}
          className="pu-list pu-fit mi-rows"
          aria-label={t.scanned.materialsLabel}
          style={hasRows ? undefined : { display: 'none' }}
        >
          {paged.items.map((row) => {
            const { material, receipt } = row;
            const isPending = material !== undefined && pendingLotIds.includes(row.lotId);
            const done = recordedQtyOf(row.lotId);
            const isSelected = row.lotId === selectedLotId;
            const uomId = receipt?.uomId ?? done?.uomId ?? material?.uomId;
            const uom = uomId === undefined ? '' : describeUom(uomId);
            const itemCode = receipt?.itemCode ?? describeItem(row.itemId);
            const wip = material?.wip ?? null;
            /* 반제품은 불출 개념이 없어 「출고 미귀속」을 붙이지 않는다(피처 016). */
            const isUnlinked =
              wip === null && notes.some((note) => note.lotId === row.lotId && note.unlinkedIssue);
            const isUnitMismatch =
              material !== undefined && receipt !== undefined && material.uomId !== receipt.uomId;
            const progress = progressStateOf(receipt?.receivedQty ?? null, done?.qty ?? 0);
            /* 최근 것부터(「미전송」이 맨 앞). */
            const records = isSelected ? [...selectedRecords].reverse() : [];
            const receivedAt = listDateTimeText(receipt?.receivedAt);
            const wipBasis =
              wip === null ? null : wipBasisText(wip, wipLeftOf(row.lotId, wip), uom);
            const more = records.length - RECORDS_SHOWN;

            return (
              <li key={row.key} data-lot-id={row.lotId} className="mi-row">
                <button
                  type="button"
                  className={puCx('pu-item mi-item', isSelected && 'is-selected')}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onSelect(row.lotId);
                  }}
                >
                  {/* 제목 줄(C-21): 품목 「이름 (코드)」와 오른쪽 끝 칩(예외 칩, 맨 끝에 진행 칩 하나). */}
                  <span className="pu-item-top">
                    <span className="no">{named(receipt?.itemName, itemCode)}</span>
                    <span className="chips">
                      {/* 공정 반제품(피처 016) — 앞 공정 산출을 다음 공정에 넣는 줄임을 알린다. 막지 않는다. */}
                      {wip !== null && (
                        <PuChip>{t.wip.chip(wip.operationSeq, wip.processName)}</PuChip>
                      )}
                      {/* 예외만 칩으로 보인다(C-21 정상은 숨김). */}
                      {receipt !== undefined && receipt.status !== 'matched' && (
                        <PuChip tone={RECEIPT_STATUS_TONE[receipt.status]}>
                          {RECEIPT_STATUS_LABEL[receipt.status]}
                        </PuChip>
                      )}
                      {isUnitMismatch && <PuChip tone="warn">{t.scanned.unitMismatch}</PuChip>}
                      {material?.isHeld === true && (
                        <PuChip tone="warn">{t.scanned.heldMark}</PuChip>
                      )}
                      {/* IQC 에서 적은 4M 변경품 — 투입은 막지 않고 알린다(omf-all-around#63). */}
                      {material !== undefined && material.fourMChange !== null && (
                        <PuChip tone="warn">{t.scanned.fourMChangeMark}</PuChip>
                      )}
                      {/* 서버가 통과시키되 기록만 한 것(스펙 §5-3). 보내기 전에는 없다. */}
                      {isUnlinked && <PuChip tone="info">{t.scanned.unlinkedIssue}</PuChip>}
                      {/* 진행 칩은 하나(C-21): 투입 중(파랑), 과투입(노랑), 투입 완료(초록). */}
                      {isPending ? (
                        <PuChip tone="info">{t.scanned.pendingMark}</PuChip>
                      ) : progress.kind === 'over' ? (
                        <PuChip tone="warn">
                          {t.scanned.overMark(withUnit(progress.over, uom))}
                        </PuChip>
                      ) : progress.kind === 'done' ? (
                        <PuChip tone="ok">{t.scanned.completeMark}</PuChip>
                      ) : null}
                    </span>
                  </span>
                  {/* 정보 영역(C-21): LOT 번호(라벨 대조용, C-10)와 투입량 막대. */}
                  {/* 반제품 줄은 LOT 번호를 줄이지 않고 근거를 다음 줄로 접는다(좁은 폭 · 시안 2판 ①). */}
                  <span className={puCx('pu-item-sub mi-pair', wip !== null && 'mi-pair-wip')}>
                    <span>{t.pairs.lotLabel}</span> <b className="mi-lot-no">{row.lotNo}</b>{' '}
                    {wipBasis !== null && (
                      <>
                        <b className="mi-wip-basis">{wipBasis}</b>{' '}
                      </>
                    )}
                    <span>{t.pairs.progressLabel}</span>{' '}
                    <QtyProgress
                      received={receipt?.receivedQty ?? null}
                      recorded={done?.qty ?? 0}
                      uom={uom}
                    />
                    {receivedAt !== null && (
                      <>
                        <span>{t.pairs.receivedAtLabel}</span> <b>{receivedAt}</b>
                      </>
                    )}
                  </span>
                  {records.length > 0 && (
                    <span className="mi-recs">
                      <span>{t.scanned.recordsTitle}</span>
                      {records.slice(0, RECORDS_SHOWN).map((record) => {
                        const unit = describeUom(record.uomId);

                        return (
                          <span key={record.key} className="mi-rec">
                            <span className="q">
                              {unit === '' ? String(record.qty) : `${String(record.qty)} ${unit}`}
                            </span>
                            <span className="t">{timeOf(record.occurredAt)}</span>
                            <PuChip tone={record.state === 'pending' ? 'info' : 'ok'}>
                              {record.state === 'pending'
                                ? t.scanned.pendingState
                                : t.scanned.sentState}
                            </PuChip>
                          </span>
                        );
                      })}
                      {more > 0 && <span>{t.scanned.recordsMore(more)}</span>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <ListOrderFoot
        className="mi-foot"
        order={order}
        onOrder={(next) => {
          onOrderChange(next);
          paged.setPage(1);
        }}
        showOrder={hasRows}
      >
        {summary !== null && <span className="mi-summary">{summary}</span>}
        <PuPager
          total={rows.length}
          page={paged.page}
          pages={paged.pages}
          onPage={paged.setPage}
          label={t.scanned.materialsLabel}
        />
      </ListOrderFoot>
    </>
  );
};
