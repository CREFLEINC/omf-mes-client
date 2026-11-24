import type { MaterialLotTab } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { Fragment, type ReactNode, type RefObject } from 'react';

import { formatPackage, formatQty, packageUnitName } from '../../patterns/package-qty';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { PuChip, PuIcon, puCx, type PuChipTone } from '../../patterns/pop-uniform';
import { rowStatusOf, type BatchSnapshot, type RowStatus } from './batch-view';
import { isVoided, isWaiting, type LabelLot } from './types';

/**
 * 자재 관리 LOT 번호 — `|` 뒤마다 줄바꿈 자리(`<wbr>`)를 둔다. 넓은 화면은 한 줄, 1100px 이하 좁은 상세 칸에서는
 * 칸(품목 · 수량 · 날짜 · 공급사 · 일련) 단위로 두 줄에 걸쳐 끝까지 읽힌다(말줄임 없음). 글자 자체는 그대로다.
 */
const LotNoText = ({ lotNo }: { lotNo: string }) => (
  <span className="mll-lotno">
    {lotNo.split('|').map((part, index) => (
      <Fragment key={index}>
        {index === 0 ? null : (
          <>
            |<wbr />
          </>
        )}
        {part}
      </Fragment>
    ))}
  </span>
);

const t = messages.popMaterialLotLabel.table;
const tState = messages.popMaterialLotLabel.lotState;
const tStatus = messages.popMaterialLotLabel.status;
const tp = messages.popMaterialLotLabel.precreate;

/**
 * 탭마다 무엇을 보이는가(피처 014 · 시안 P0101 ③ · ⑧ · ⑨ · screens/P-01-01.md 「표시 항목」).
 *
 * - `UNPRINTED` 미출력 — 선택 · 차례 · 번호 · 재고량 · 포장 · 만든 방식(· [수정])
 * - `PRINTED` 출력됨(입하 전) — 선택 · 번호 · 재고량 · 포장 · 만든 방식 · 출력 횟수 · 최근 출력일시
 * - `RECEIVED` 입하된 LOT — 선택 · 번호 · 재고량 · 포장 · 공급사 LOT 번호 · LOT 상태 · 입하 일시 · 출력 횟수
 * - `VOIDED` 폐기 LOT — 번호 · 재고량 · 포장 · 만든 방식 · LOT 상태 · 폐기 일시 · 출력 횟수(고를 수 없음)
 * ⭐ P/O 라인은 보이지 않는다(T058 · 사용자 2026-11-24) — 현장은 P/O 번호로 식별하지 않고, 자동 LOT 의 P/O 라인은
 *    중복 생성 방지용 몫 기록일 뿐 실제 배정은 입하 마감 때 정해진다. 데이터는 「나머지」 판별(`remainderLotIds`)에만 쓴다.
 * ⭐ 칸마다 값 하나(사용자 지시 2026-11-19) — 두 줄 묶음 칸은 두지 않는다.
 * ⭐ 발행 중 · 결과 확인 전에는 맨 끝에 결과 칸이 선다(체크 대신 결과 표식이 제자리에 붙는다).
 * ⭐ 줄 어디를 눌러도 고른다 — 첫 칸의 체크 단추가 읽어 주는 도구의 이름(번호·수량)을 갖는다.
 */
export interface LabelTableProps {
  tab: MaterialLotTab;
  /** 이 쪽에 보일 줄(서버 쪽). */
  lots: readonly LabelLot[];
  checked: ReadonlySet<number>;
  onToggle: (lotId: number) => void;
  /** 발행 중에는 줄을 바꾸지 못한다. */
  isLocked: boolean;
  /** 결과를 그리는가 — 그리면 `batch` 에서 LOT 마다 결과를 읽는다. */
  showResults: boolean;
  batch: BatchSnapshot;
  /** 표 이름(읽어 주는 도구). */
  label: string;
  /** 쪽 줄 수를 재는 칸. */
  fitRef: RefObject<HTMLDivElement | null>;
  /** 번호 스캔으로 찾아 맨 위에 둔 LOT — 번호 옆에 「스캔」 칩. */
  scannedLotId?: number | null;
  /** 품목 기본 LOT 수량 — P/O 라인 마지막 자동 LOT 이 이보다 작으면 「나머지」 칩(시안 ③ · `remainderLotIds`). */
  defaultLotQty?: number | null;
  /** 이 쪽 뒤에 쪽이 더 있는가 — 라인의 마지막 LOT 이 다음 쪽에 있을 수 있어 「나머지」 판별에 쓴다. */
  hasMoreAfter?: boolean;
  /** 줄 끝 동작 칸(미출력 탭 [수정]) — 없으면 칸을 두지 않는다. */
  rowAction?: (lot: LabelLot) => ReactNode;
}

/**
 * 「나머지」 칩을 붙일 LOT(T052 · FR-004 · US3-1) — P/O 라인의 **마지막** 자동 LOT 이 품목 기본 수량보다 작을 때만.
 *
 * 서버 행에는 「나머지로 만든 LOT」 표시가 없어 화면이 판별한다. 미출력 탭은 만든 차례(`seq`)로 서고, 자동 생성은 라인마다
 * 기본 수량씩 만든 뒤 마지막 한 개를 남는 양으로 만든다. [수정]으로 줄인 LOT(100 → 80)은 그 라인의 마지막이 아니다 —
 * 줄여서 빈 몫은 다음 조회 때 더 큰 차례로 새로 만들어지기 때문이다. 그래서
 * - 자동 LOT · P/O 라인이 있고 · 기본 수량보다 작고,
 * - 이 쪽에서 같은 라인의 LOT 가운데 차례가 가장 크고,
 * - 그 라인이 다음 쪽으로 이어질 수 있는지 모를 때(이 쪽의 마지막 줄 · 뒤에 쪽이 더 있음)는 붙이지 않는다.
 * ⚠ 라인 마지막 LOT 을 [수정]으로 줄인 경우(빈 몫이 아직 다시 만들어지기 전)는 가려내지 못한다 — 서버 칸이 없다.
 */
export const remainderLotIds = (
  lots: readonly LabelLot[],
  defaultLotQty: number | null,
  hasMoreAfter: boolean,
): Set<number> => {
  const result = new Set<number>();
  if (defaultLotQty === null) return result;

  const seqOf = (lot: LabelLot): number => lot.seq ?? 0;
  const pageLastSeq = Math.max(0, ...lots.map(seqOf));
  const lastOfLine = new Map<number, LabelLot>();

  for (const lot of lots) {
    const line = lot.purchaseOrderLine;
    if (lot.creationModeCode !== 'AUTO' || line === null || line === undefined) continue;
    const found = lastOfLine.get(line.purchaseOrderLineId);
    if (found === undefined || seqOf(lot) > seqOf(found)) {
      lastOfLine.set(line.purchaseOrderLineId, lot);
    }
  }

  for (const lot of lastOfLine.values()) {
    if (lot.lotQty >= defaultLotQty) continue;
    if (hasMoreAfter && seqOf(lot) === pageLastSeq) continue;
    result.add(lot.lotId);
  }

  return result;
};

/** 이 탭에서 고를 수 있는 줄인가 — 미출력 · 출력됨은 입하 대기, 입하된은 폐기 아닌 것, 폐기는 없음. */
export const isSelectableIn = (tab: MaterialLotTab, lot: LabelLot): boolean => {
  if (tab === 'VOIDED') return false;
  if (tab === 'RECEIVED') return !isVoided(lot);

  return isWaiting(lot);
};

/** 마지막 발행 — 「11-11 08:12」(공장 시각). */
export const issuedWhen = (value: string): string => {
  const parts = toPlantDateTimeParts(value);

  return parts === null ? '' : `${parts.date.slice(5)} ${parts.time}`;
};

const statusText = (status: RowStatus): string => {
  switch (status.kind) {
    case 'printed':
      return tStatus.printed;
    case 'failed':
      return tStatus.failed[status.failure];
    case 'running':
      return tStatus.running;
    case 'waiting':
      return tStatus.waiting;
    case 'stopped':
      return tStatus.stopped;
    case 'alreadyIssued':
      return tStatus.alreadyIssued;
    case 'notSelected':
      return tStatus.notSelected;
  }
};

/** 결과 칩 색 — 인쇄됨 초록 · 기록만 못 남김 노랑 · 실패 빨강 · 보내는 중 파랑 · 그 밖 회색. */
const statusTone = (status: RowStatus): PuChipTone => {
  if (status.kind === 'printed') return 'ok';
  if (status.kind === 'failed') return status.failure === 'reportFailedAfterPrint' ? 'warn' : 'bad';

  return status.kind === 'running' ? 'info' : 'idle';
};

const qualityTone = (statusCode: string): PuChipTone =>
  statusCode === 'NORMAL'
    ? 'ok'
    : statusCode === 'DEFECTIVE' || statusCode === 'SCRAPPED'
      ? 'bad'
      : 'info';

/** 상태 칩(규칙 10) — 입하 대기 회색 · 입하 정상 초록 · 입하 검사 대기 파랑 · 입하 불량/폐기 · 폐기 빨강. */
export const LotStateChip = ({ lot }: { lot: LabelLot }) => {
  if (isWaiting(lot)) return <PuChip>{tState.waiting}</PuChip>;
  if (isVoided(lot)) return <PuChip tone="bad">{tState.voided}</PuChip>;

  return (
    <PuChip tone={qualityTone(lot.statusCode)}>
      {tState.received(tState.quality[lot.statusCode] ?? lot.statusCode)}
    </PuChip>
  );
};

/**
 * 자재 관리 LOT 표 — 칸마다 값 하나, 긴 칸(번호 · 공급사 LOT)은 한 줄 말줄임이라 가로로 넘치지 않는다.
 * ⭐ LOT 번호는 저장된 그대로, 고정폭으로(규범 C-10).
 */
export const LabelTable = ({
  tab,
  lots,
  checked,
  onToggle,
  isLocked,
  showResults,
  batch,
  label,
  fitRef,
  scannedLotId = null,
  defaultLotQty = null,
  hasMoreAfter = false,
  rowAction,
}: LabelTableProps) => {
  const hasCheck = tab !== 'VOIDED';
  const remainders =
    tab === 'UNPRINTED' ? remainderLotIds(lots, defaultLotQty, hasMoreAfter) : new Set<number>();
  const hasAction = rowAction !== undefined && !showResults;
  /* 「롤 10 × 10」 — 좁으면 단위명과 곱 사이에서만 접는다(× 앞뒤는 붙임, 긴 단위명은 한 줄 말줄임 · T054). 글자는 formatPackage 와 같다. */
  const packageCell = (lot: LabelLot): ReactNode => {
    if (lot.package === null) return t.noPackage;

    return (
      <>
        <span className="mll-pkg-unit">{packageUnitName(lot.package)}</span>{' '}
        <span className="mll-keep">
          {formatQty(lot.package.count)} × {formatQty(lot.package.qtyPerPackage)}
        </span>
      </>
    );
  };
  const modeChip = (lot: LabelLot): ReactNode =>
    lot.creationModeCode === undefined ? (
      t.none
    ) : (
      <PuChip tone={lot.creationModeCode === 'AUTO' ? 'info' : 'idle'}>
        {tp.mode[lot.creationModeCode]}
      </PuChip>
    );
  const printCount = (lot: LabelLot): string =>
    lot.lastIssue === null ? t.unprinted : t.issuedSeq(lot.lastIssue.issueSeq);
  const when = (value: string | null | undefined): string =>
    value === null || value === undefined ? t.none : issuedWhen(value) || t.none;

  return (
    <div
      ref={fitRef}
      className={puCx('mll-table', `is-${tab.toLowerCase()}`)}
      role="group"
      aria-label={label}
    >
      <div className="pu-table-wrap">
        <table className="pu-table">
          <thead>
            <tr>
              {hasCheck && <th className="fit mid">{t.columns.check}</th>}
              {tab === 'UNPRINTED' && <th className="fit mid">{tp.columns.seq}</th>}
              <th className="mll-lotcol" title={t.columns.lotNo}>
                {t.columns.lotNo}
              </th>
              <th className="num fit">{t.columns.qty}</th>
              <th className="fit mll-pkgcol">{t.columns.package}</th>
              {tab === 'RECEIVED' ? (
                <>
                  <th className="mll-slotcol" title={t.columns.supplierLot}>
                    {t.columns.supplierLot}
                  </th>
                  <th className="fit mid">{t.columns.status}</th>
                  <th className="fit">{tp.columns.receivedAt}</th>
                  <th className="fit">{tp.columns.printCount}</th>
                </>
              ) : (
                <th className="fit mid mll-modecol">{tp.columns.mode}</th>
              )}
              {tab === 'PRINTED' && (
                <>
                  <th className="fit">{tp.columns.printCount}</th>
                  <th className="fit">{tp.columns.lastPrinted}</th>
                </>
              )}
              {tab === 'VOIDED' && (
                <>
                  <th className="fit mid">{t.columns.status}</th>
                  <th className="fit">{tp.columns.voidedAt}</th>
                  <th className="fit">{tp.columns.printCount}</th>
                </>
              )}
              {showResults && <th className="fit">{t.columns.result}</th>}
              {hasAction && <th className="fit mid mll-actcol" aria-label={t.columns.action} />}
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const status = showResults ? rowStatusOf(lot.lotId, batch) : null;
              const selectable = !showResults && isSelectableIn(tab, lot);
              const isChecked = checked.has(lot.lotId);
              const canToggle = selectable && !isLocked;
              const packageText = formatPackage(lot.package) ?? t.noPackage;
              const qtyText = `${formatQty(lot.lotQty)} ${lot.uomCode}`;
              const isRemainder = tab === 'UNPRINTED' && remainders.has(lot.lotId);

              return (
                <tr
                  key={lot.lotId}
                  className={puCx(
                    selectable && 'is-pick',
                    isChecked && selectable && 'is-selected',
                    !selectable && !showResults && 'mll-dis',
                  )}
                  data-voided={isVoided(lot) || undefined}
                  onClick={
                    canToggle
                      ? () => {
                          onToggle(lot.lotId);
                        }
                      : undefined
                  }
                >
                  {hasCheck && (
                    <td className="fit mid">
                      {status !== null && status.kind !== 'notSelected' ? (
                        <span className="mll-mark" data-tone={statusTone(status)}>
                          {status.kind === 'printed' ? <PuIcon name="check" /> : null}
                          {status.kind === 'failed' ? <PuIcon name="x" /> : null}
                        </span>
                      ) : selectable ? (
                        <button
                          type="button"
                          role="checkbox"
                          className="mll-box"
                          aria-checked={isChecked}
                          aria-label={t.rowName(lot.lotNo, qtyText)}
                          disabled={isLocked}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggle(lot.lotId);
                          }}
                        >
                          {isChecked ? <PuIcon name="check" /> : null}
                        </button>
                      ) : (
                        <span className="mll-box is-off" aria-hidden="true" />
                      )}
                    </td>
                  )}
                  {tab === 'UNPRINTED' && (
                    <td className="fit mid">
                      <span className="mll-seq">{lot.seq ?? t.none}</span>
                    </td>
                  )}
                  {/* 칸마다 값 하나 — 넘치면 한 줄 말줄임 + title(사용자 지시 2026-11-19). */}
                  <td className="pu-mono mll-lotcol" title={lot.lotNo}>
                    <LotNoText lotNo={lot.lotNo} />
                    {lot.lotId === scannedLotId ? (
                      <>
                        {' '}
                        <PuChip tone="info">{tp.lookup.chip}</PuChip>
                      </>
                    ) : null}
                    {isRemainder ? (
                      <>
                        {' '}
                        <PuChip tone="warn">{tp.remainder}</PuChip>
                      </>
                    ) : null}
                  </td>
                  <td className="num fit">{qtyText}</td>
                  <td className="fit mll-pkgcol" title={packageText}>
                    {packageCell(lot)}
                  </td>
                  {tab === 'RECEIVED' ? (
                    <>
                      <td className="mll-slotcol" title={lot.supplierLotNo ?? undefined}>
                        {lot.supplierLotNo ?? t.none}
                      </td>
                      <td className="fit mid">
                        <LotStateChip lot={lot} />
                      </td>
                      <td className="fit">{when(lot.receivedAt)}</td>
                      <td className="fit">{printCount(lot)}</td>
                    </>
                  ) : (
                    <td className="fit mid mll-modecol">{modeChip(lot)}</td>
                  )}
                  {tab === 'PRINTED' && (
                    <>
                      <td className="fit">{printCount(lot)}</td>
                      <td className="fit">{when(lot.lastIssue?.issuedAt)}</td>
                    </>
                  )}
                  {tab === 'VOIDED' && (
                    <>
                      <td className="fit mid">
                        <LotStateChip lot={lot} />
                      </td>
                      <td className="fit">{when(lot.voidedAt)}</td>
                      <td className="fit">{printCount(lot)}</td>
                    </>
                  )}
                  {showResults && (
                    <td className="fit">
                      {status === null ? null : (
                        <PuChip tone={statusTone(status)}>{statusText(status)}</PuChip>
                      )}
                    </td>
                  )}
                  {hasAction && <td className="fit mid mll-actcol">{rowAction(lot)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
