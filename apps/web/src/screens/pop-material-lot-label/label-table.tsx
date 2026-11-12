import { messages } from '@omf-mes/i18n';

import { formatPackage, formatQty } from '../../patterns/package-qty';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { rowStatusOf, type BatchSnapshot, type RowStatus } from './batch-view';
import { isVoided, isWaiting, type LabelLot } from './types';

const t = messages.popMaterialLotLabel.table;
const tState = messages.popMaterialLotLabel.lotState;
const tStatus = messages.popMaterialLotLabel.status;

/**
 * 표가 무엇을 보이는가(screens/P-01-01.md).
 *
 * - `waiting` 공급사·품목의 대기(+ 아래에 폐기) — 체크 · 번호 · 재고 수량 · 패키징 · 공급사 LOT · 상태 · 라벨
 * - `received` 최근 입하된 LOT — 같은 칸, 고를 수 없다(번호 아래 「입하 LOT IL-…」)
 * - `reprint` 다시 인쇄 — 체크 · 번호 · 품목 · 재고 수량 · 패키징 · 상태 · 출력
 *
 * ⭐ 발행 중 · 결과 확인 전에는 마지막 칸이 그 LOT 의 결과다(체크 대신 결과 표식이 제자리에 붙는다).
 */
export type LabelTableMode = 'waiting' | 'received' | 'reprint';

export interface LabelTableProps {
  mode: LabelTableMode;
  lots: readonly LabelLot[];
  checked: ReadonlySet<number>;
  onToggle: (lotId: number) => void;
  /** 발행 중에는 줄을 바꾸지 못한다. */
  isLocked: boolean;
  /** 결과를 그리는가 — 그리면 `batch` 에서 LOT 마다 결과를 읽는다. */
  showResults: boolean;
  batch: BatchSnapshot;
  /** 줄이 없을 때 그 자리에 보일 말(없으면 표를 그리지 않는다). */
  empty: string | null;
  /** 표 이름(읽어 주는 도구). */
  label: string;
}

const CheckMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const CrossMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);

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

/** 결과 표식의 모양 — CSS 가 `data-status` 로 색을 고른다(클래스 이름을 조립하지 않는다). */
const statusTone = (status: RowStatus): string => {
  if (status.kind === 'printed') return status.iqcMissing ? 'warning' : 'ok';
  if (status.kind === 'failed')
    return status.failure === 'reportFailedAfterPrint' ? 'warning' : 'error';

  return status.kind === 'running' ? 'running' : 'idle';
};

/** 상태 칩 — 「대기」 / 「폐기」 / 「입하됨 · 정상」(screens/P-01-01.md). */
export const LotStateChip = ({ lot }: { lot: LabelLot }) => {
  if (isWaiting(lot)) {
    return (
      <span className="pop-mlot-state" data-tone="warning">
        {tState.waiting}
      </span>
    );
  }

  if (isVoided(lot)) {
    return (
      <span className="pop-mlot-state" data-tone="error">
        {tState.voided}
      </span>
    );
  }

  return (
    <span className="pop-mlot-state" data-tone={lot.statusCode === 'NORMAL' ? 'ok' : 'info'}>
      {tState.received(tState.quality[lot.statusCode] ?? lot.statusCode)}
    </span>
  );
};

const LabelCell = ({ lot }: { lot: LabelLot }) =>
  lot.lastIssue === null ? (
    <span className="pop-mlot-dim">{t.unprinted}</span>
  ) : (
    <>
      {`${String(lot.lastIssue.issueSeq)}회 `}
      <span className="pop-mlot-dim">{issuedWhen(lot.lastIssue.issuedAt)}</span>
    </>
  );

const Qty = ({ lot }: { lot: LabelLot }) => (
  <span className="pop-mlot-cell-qty">
    {formatQty(lot.lotQty)} <span className="pop-mlot-uom">{lot.uomCode}</span>
  </span>
);

/**
 * 자재 관리 LOT 표 — **열 머리를 한 번만 두고 줄은 한 줄**로 적는다.
 *
 * ⭐ 줄 전체가 체크 칸이다(규범 C-1) — 어디를 눌러도 체크된다. 장갑 낀 손으로 작은 네모를 겨누지 않는다.
 * ⭐ LOT 번호는 저장된 그대로, 고정폭으로, 자르지 않는다(규범 C-10). 공급사 LOT 은 말줄임.
 */
export const LabelTable = ({
  mode,
  lots,
  checked,
  onToggle,
  isLocked,
  showResults,
  batch,
  empty,
  label,
}: LabelTableProps) => {
  if (lots.length === 0) {
    return empty === null ? null : <p className="pop-mlot-empty">{empty}</p>;
  }

  const isReprint = mode === 'reprint';

  return (
    <div
      className="pop-mlot-table"
      data-mode={isReprint ? 'reprint' : 'lots'}
      role="group"
      aria-label={label}
    >
      <div className="pop-mlot-table-head" aria-hidden="true">
        <span>{t.columns.check}</span>
        <span>{t.columns.lotNo}</span>
        {isReprint ? <span>{t.columns.item}</span> : null}
        <span>{t.columns.qty}</span>
        <span>{t.columns.package}</span>
        {isReprint ? null : <span>{t.columns.supplierLot}</span>}
        <span>{t.columns.status}</span>
        <span>
          {showResults ? t.columns.result : isReprint ? t.columns.printed : t.columns.label}
        </span>
      </div>
      {lots.map((lot) => {
        const status = showResults ? rowStatusOf(lot.lotId, batch) : null;
        const selectable =
          mode !== 'received' && !showResults && (isReprint ? !isVoided(lot) : isWaiting(lot));
        const isChecked = checked.has(lot.lotId);
        const cells = (
          <>
            <span className="pop-mlot-cell-mark">
              {status !== null && status.kind !== 'notSelected' ? (
                <span className="pop-mlot-mark" data-status={statusTone(status)}>
                  {status.kind === 'printed' ? <CheckMark /> : null}
                  {status.kind === 'failed' ? <CrossMark /> : null}
                </span>
              ) : (
                <span
                  className="pop-mlot-checkbox"
                  data-checked={isChecked}
                  data-disabled={!selectable}
                >
                  {isChecked ? <CheckMark /> : null}
                </span>
              )}
            </span>
            <span className="pop-mlot-cell-lotno">
              <span className="pop-mlot-cell-lot">{lot.lotNo}</span>
              {lot.inboundLotNo === null ? null : (
                <span className="pop-mlot-sub">{t.inboundLot(lot.inboundLotNo)}</span>
              )}
            </span>
            {isReprint ? (
              <span className="pop-mlot-cell-name">
                <span className="pop-mlot-cell-code">{lot.itemCode}</span>
                <span className="pop-mlot-name-text pop-mlot-dim">{lot.itemName}</span>
              </span>
            ) : null}
            <span>
              <Qty lot={lot} />
            </span>
            <span className="pop-mlot-cell-wrap">
              {formatPackage(lot.package) ?? <span className="pop-mlot-dim">{t.none}</span>}
            </span>
            {isReprint ? null : (
              <span className="pop-mlot-cell-ellipsis">
                {lot.supplierLotNo ?? <span className="pop-mlot-dim">{t.none}</span>}
              </span>
            )}
            <span>
              <LotStateChip lot={lot} />
            </span>
            <span
              className={status === null ? 'pop-mlot-cell-wrap' : 'pop-mlot-cell-result'}
              data-status={status === null ? undefined : statusTone(status)}
            >
              {status === null ? <LabelCell lot={lot} /> : statusText(status)}
            </span>
          </>
        );

        return selectable ? (
          <button
            key={lot.lotId}
            type="button"
            role="checkbox"
            className="pop-mlot-row"
            aria-checked={isChecked}
            aria-label={t.rowName(lot.lotNo, `${formatQty(lot.lotQty)} ${lot.uomCode}`)}
            disabled={isLocked}
            onClick={() => {
              onToggle(lot.lotId);
            }}
          >
            {cells}
          </button>
        ) : (
          <div
            key={lot.lotId}
            className="pop-mlot-row"
            data-voided={isVoided(lot)}
            data-status={status?.kind === 'failed' ? 'error' : undefined}
          >
            {cells}
          </div>
        );
      })}
    </div>
  );
};
