import { AlertBanner, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { Button } from '../../patterns/button';
import { plantClock } from '../../patterns/plant-time';
import { canReplace, codeProblem, oqcTone, type ShipmentRequestLot } from './picking';

const t = messages.productPicking;

/** 적치 대기 자리(위치 시스템 역할) — 그 몫에 「적치 대기」 칩을 단다. */
const STAGING = 'PUTAWAY_STAGING';

/** 코드 칸이 지금 무엇을 받는가 — 다음 스캔(`scan`) 또는 기기 키보드(`type`). */
export type CodeMode = 'scan' | 'type';

export interface CodeFieldState {
  mode: CodeMode | null;
  draft: string;
  saving: boolean;
  failed: boolean;
}

interface LotRowProps {
  lot: ShipmentRequestLot;
  uom: string;
  /** 방금 집은 LOT — 붉은 테로 눈에 띄게. */
  fresh: boolean;
  code: CodeFieldState;
  onReplace: () => void;
  onCodeScan: () => void;
  onCodeType: () => void;
  onCodeDraft: (value: string) => void;
  onCodeCancel: () => void;
  onCodeSave: () => void;
}

/**
 * 피킹 LOT 한 줄 — 통째 수량, OQC 판정 배지, 창고·위치별 몫, 출하 관리 코드, 불합격이면 [교체].
 */
export const LotRow = ({
  lot,
  uom,
  fresh,
  code,
  onReplace,
  onCodeScan,
  onCodeType,
  onCodeDraft,
  onCodeCancel,
  onCodeSave,
}: LotRowProps) => {
  const status = lot.oqcLotStatus;
  const editable = lot.statusCode === 'PICKED';
  const problem = codeProblem(code.draft);

  return (
    <li className={fresh ? 'picking__lot picking__lot--fresh' : 'picking__lot'}>
      <div className="picking__lot-head">
        <strong>{lot.lotNo}</strong>
        {status === null ? null : <Chip status={oqcTone(status)}>{t.oqc[status]}</Chip>}
        <span className="picking__lot-qty">{t.lot.qty(String(lot.pickedQty), uom)}</span>
      </div>

      {lot.portions.length === 0 ? null : (
        <ul className="picking__portions">
          {lot.portions.map((portion) => (
            <li key={`${String(portion.warehouseId)}-${String(portion.locationId)}`}>
              {/* 적치 대기 자리는 코드(창고 위치 코드 접두가 붙은 시스템 코드, 예 89YE-SYS-STAGING) 대신 칩으로만 말한다(시안). */}
              <span>
                {t.lot.portion(
                  portion.warehouseName,
                  portion.locationSystemRoleCode === STAGING ? null : portion.locationCode,
                )}
              </span>
              {portion.locationSystemRoleCode === STAGING ? (
                <Chip status="warning">{t.lot.staging}</Chip>
              ) : null}
              <span>{String(portion.qty)}</span>
            </li>
          ))}
        </ul>
      )}

      {status === 'REJECTED' && lot.oqcResult !== null ? (
        <p className="picking__note">
          {t.lot.oqcResult(lot.oqcResult.round, plantClock(lot.oqcResult.resultAt))}
        </p>
      ) : null}

      {canReplace(lot) ? (
        <Button
          className="picking__replace"
          variant="filled"
          size="2xl"
          aria-label={`${lot.lotNo} ${t.lot.replace}`}
          onClick={onReplace}
        >
          {t.lot.replace}
        </Button>
      ) : null}

      {!editable ? (
        lot.managementCode === null ? null : (
          <p className="picking__note">
            {t.code.label} {lot.managementCode}
          </p>
        )
      ) : code.mode === 'type' ? (
        <div className="picking__code-edit">
          <TextField
            label={t.code.labelLimit}
            size="lg"
            fullWidth
            autoFocus
            value={code.draft}
            onChange={(event) => {
              onCodeDraft(event.target.value);
            }}
            helperText={`${t.code.noCheck}, ${t.code.count(code.draft.trim().length)}`}
            error={problem === null ? undefined : t.code.tooLong}
          />
          <div className="picking__code-actions">
            <Button variant="outlined" size="2xl" onClick={onCodeCancel}>
              {t.code.cancel}
            </Button>
            <Button
              variant="filled"
              size="2xl"
              loading={code.saving}
              disabled={problem !== null}
              onClick={onCodeSave}
            >
              {t.code.save}
            </Button>
          </div>
        </div>
      ) : (
        <div className="picking__code">
          <span className="picking__code-label">{t.code.label}</span>
          <div className="picking__code-row">
            <Button
              className={
                code.mode === 'scan'
                  ? 'picking__code-value picking__code-value--waiting'
                  : 'picking__code-value'
              }
              variant="outlined"
              size="lg"
              aria-label={code.mode === 'scan' ? t.code.stopWaiting : t.code.edit(lot.lotNo)}
              aria-pressed={code.mode === 'scan'}
              loading={code.saving}
              onClick={code.mode === 'scan' ? onCodeCancel : onCodeScan}
            >
              {code.mode === 'scan' ? t.code.waiting : (lot.managementCode ?? t.code.empty)}
            </Button>
            <Button
              variant="text"
              size="lg"
              aria-label={t.code.keyboard(lot.lotNo)}
              onClick={onCodeType}
            >
              {t.scan.manualLabel}
            </Button>
          </div>
          {code.mode === 'scan' ? <p className="picking__note">{t.code.waitingHint}</p> : null}
        </div>
      )}

      {code.failed ? <AlertBanner variant="error" title={t.code.failed} /> : null}
    </li>
  );
};

/** 교체로 빠진 LOT — 라인 맨 아래 흐린 이력 줄. */
export const ReplacedRow = ({ lot, uom }: { lot: ShipmentRequestLot; uom: string }) => (
  <li className="picking__lot picking__lot--replaced">
    <div className="picking__lot-head">
      <strong>{lot.lotNo}</strong>
      <span>{t.lot.qty(String(lot.pickedQty), uom)}</span>
      <Chip status="idle">{t.lot.replaced}</Chip>
    </div>
    {lot.replacement === null ? null : (
      <p className="picking__note">
        {t.lot.replacedDetail(
          lot.replacement.nonconformanceNo,
          lot.replacement.worker?.workerName ?? '',
          plantClock(lot.replacement.replacedAt),
        )}
      </p>
    )}
  </li>
);
