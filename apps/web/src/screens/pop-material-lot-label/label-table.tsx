import { messages } from '@omf-mes/i18n';
import type { RefObject } from 'react';

import { formatPackage, formatQty } from '../../patterns/package-qty';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { PuChip, PuIcon, puCx, type PuChipTone } from '../../patterns/pop-uniform';
import { rowStatusOf, type BatchSnapshot, type RowStatus } from './batch-view';
import { isVoided, isWaiting, type LabelLot } from './types';

const t = messages.popMaterialLotLabel.table;
const tState = messages.popMaterialLotLabel.lotState;
const tStatus = messages.popMaterialLotLabel.status;

/**
 * 표가 무엇을 보이는가(screens/P-01-01.md · #295 시안).
 *
 * - `waiting` 공급사·품목의 입하 대기(+ 폐기, 맨 뒤에 최근 입하된 LOT — 고를 수 없음)
 *   — 선택 · 번호(아래 공급사 LOT / 입하 LOT) · 재고 수량 · 포장 · 상태 · 라벨
 * - `reprint` 재발행 — 선택 · 번호 · 품목 · 재고 수량 · 포장 · 상태 · 출력
 *
 * ⭐ 발행 중 · 결과 확인 전에는 마지막 칸이 그 LOT 의 결과다(체크 대신 결과 표식이 제자리에 붙는다).
 * ⭐ 줄 어디를 눌러도 고른다 — 첫 칸의 체크 단추가 읽어 주는 도구의 이름(번호·수량)을 갖는다.
 */
export type LabelTableMode = 'waiting' | 'reprint';

export interface LabelTableProps {
  mode: LabelTableMode;
  /** 이 쪽에 보일 줄(쪽 넘김은 화면이 자른다). */
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
  /** 쪽 건수를 재는 칸. */
  fitRef: RefObject<HTMLDivElement | null>;
}

/** 마지막 발행 — 「11-11 08:12」(공장 시각). */
export const issuedWhen = (value: string): string => {
  const parts = toPlantDateTimeParts(value);

  return parts === null ? '' : `${parts.date.slice(5)} ${parts.time}`;
};

const statusText = (status: RowStatus): string => {
  switch (status.kind) {
    case 'printed':
      return status.iqcMissing ? tStatus.iqcMissing : tStatus.printed;
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

/** 결과 칩 색 — 인쇄됨 초록 · 기록만 못 남김/IQC 빠짐 노랑 · 실패 빨강 · 보내는 중 파랑 · 그 밖 회색. */
const statusTone = (status: RowStatus): PuChipTone => {
  if (status.kind === 'printed') return status.iqcMissing ? 'warn' : 'ok';
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

const LabelCell = ({ lot }: { lot: LabelLot }) =>
  lot.lastIssue === null ? (
    <span className="mll-sub">{t.unprinted}</span>
  ) : (
    <>
      {`${String(lot.lastIssue.issueSeq)}회`}
      <span className="mll-sub">{issuedWhen(lot.lastIssue.issuedAt)}</span>
    </>
  );

/**
 * 자재 관리 LOT 표 — 줄은 두 줄 묶음(「재고 수량 · 포장」 등)이라 가로로 넘치지 않는다.
 * ⭐ LOT 번호는 저장된 그대로, 고정폭으로(규범 C-10).
 */
export const LabelTable = ({
  mode,
  lots,
  checked,
  onToggle,
  isLocked,
  showResults,
  batch,
  label,
  fitRef,
}: LabelTableProps) => {
  const isReprint = mode === 'reprint';

  return (
    <div ref={fitRef} className="mll-table" role="group" aria-label={label}>
      <div className="pu-table-wrap">
        <table className="pu-table">
          <thead>
            <tr>
              <th className="mll-ck">{t.columns.check}</th>
              <th>{t.columns.lotNo}</th>
              {isReprint ? <th>{t.columns.item}</th> : null}
              <th className="num">{t.columns.qty}</th>
              <th className="mll-state">{t.columns.status}</th>
              <th className="mll-last">
                {showResults ? t.columns.result : isReprint ? t.columns.printed : t.columns.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const status = showResults ? rowStatusOf(lot.lotId, batch) : null;
              const selectable = !showResults && (isReprint ? !isVoided(lot) : isWaiting(lot));
              const isChecked = checked.has(lot.lotId);
              const canToggle = selectable && !isLocked;
              const packageText = formatPackage(lot.package);
              const lotSub =
                lot.inboundLotNo === null
                  ? t.supplierLot(lot.supplierLotNo ?? t.none)
                  : t.inboundLot(lot.inboundLotNo);

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
                  <td className="mll-ck">
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
                        aria-label={t.rowName(lot.lotNo, `${formatQty(lot.lotQty)} ${lot.uomCode}`)}
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
                  <td>
                    <span className="pu-mono mll-lot">{lot.lotNo}</span>
                    <span className="mll-sub">{lotSub}</span>
                  </td>
                  {isReprint ? (
                    <td>
                      {lot.itemCode}
                      <span className="mll-sub">{lot.itemName}</span>
                    </td>
                  ) : null}
                  <td className="num">
                    {`${formatQty(lot.lotQty)} ${lot.uomCode}`}
                    <span className="mll-sub">{packageText ?? t.noPackage}</span>
                  </td>
                  <td className="mll-state">
                    <LotStateChip lot={lot} />
                  </td>
                  <td className="mll-last">
                    {status === null ? (
                      <LabelCell lot={lot} />
                    ) : (
                      <PuChip tone={statusTone(status)}>{statusText(status)}</PuChip>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
