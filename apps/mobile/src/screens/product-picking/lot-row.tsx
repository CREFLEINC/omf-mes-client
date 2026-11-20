import { AlertBanner, Chip, IconButton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { Button } from '../../patterns/button';
import { plantClock } from '../../patterns/plant-time';
import { canReplace, codeProblem, oqcTone, type ShipmentRequestLot } from './picking';

const t = messages.productPicking;

/** 적치 대기 자리(위치 시스템 역할) — 그 몫에 「적치 대기」 칩을 단다. */
const STAGING = 'PUTAWAY_STAGING';

export interface CodeFieldState {
  /** ✎ 를 눌러 코드 칸이 열렸는가. */
  editing: boolean;
  draft: string;
  saving: boolean;
  failed: boolean;
}

interface LotRowProps {
  lot: ShipmentRequestLot;
  uom: string;
  code: CodeFieldState;
  onReplace: () => void;
  onCodeEdit: () => void;
  onCodeDraft: (value: string) => void;
  onCodeCancel: () => void;
  onCodeSave: () => void;
  /** 줄 창고 밖에 남은 그 LOT 수량(피처 012 Edge) — 있으면 「다른 창고에 n 남음」. */
  otherWarehouseQty?: number;
}

/**
 * 라인 시트의 피킹 LOT 한 줄 — LOT 번호 · 판정 · 수량, 그 아래 창고 · 위치 몫(찍을 때마다 보는 정보라 늘 보인다),
 * 출하 관리 코드. 불합격이면 작은 빨간 외곽선 [교체] — 꽉 찬 빨강은 교체 확인 창에만(사용자 결정 2026-11-20).
 *
 * 출하 관리 코드는 ✎ 를 눌러 연 칸으로만 받는다. 시트는 화면 위에 떠 있어 바깥 스캔 칸이 입력을 못 받으므로,
 * 코드 칸이 스캐너 입력도 손 입력도 받고 Enter 로 저장한다.
 */
export const LotRow = ({
  lot,
  uom,
  otherWarehouseQty,
  code,
  onReplace,
  onCodeEdit,
  onCodeDraft,
  onCodeCancel,
  onCodeSave,
}: LotRowProps) => {
  const status = lot.oqcLotStatus;
  const editable = lot.statusCode === 'PICKED';
  const problem = codeProblem(code.draft);

  return (
    <li className="picking-lot">
      <div className="picking-lot__head">
        <strong className="picking-lot__no">{lot.lotNo}</strong>
        {status === null ? null : <Chip status={oqcTone(status)}>{t.oqc[status]}</Chip>}
        <span className="picking-lot__qty">{t.lot.qty(String(lot.pickedQty), uom)}</span>
      </div>

      {lot.portions.length === 0 ? null : (
        <ul className="picking-lot__portions">
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

      {otherWarehouseQty === undefined || otherWarehouseQty <= 0 ? null : (
        <p className="picking__note picking-lot__split">
          {t.picked.otherWarehouseLeft(String(otherWarehouseQty), uom)}
        </p>
      )}

      {status === 'REJECTED' && lot.oqcResult !== null ? (
        <p className="picking__note">
          {t.lot.oqcResult(lot.oqcResult.round, plantClock(lot.oqcResult.resultAt))}
        </p>
      ) : null}

      {code.editing ? (
        <form
          className="picking-lot__code-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (problem === null) onCodeSave();
          }}
        >
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
          <div className="picking-lot__code-actions">
            <Button type="button" variant="outlined" size="lg" onClick={onCodeCancel}>
              {t.code.cancel}
            </Button>
            <Button
              type="submit"
              variant="outlined"
              size="lg"
              loading={code.saving}
              disabled={problem !== null}
            >
              {t.code.save}
            </Button>
          </div>
        </form>
      ) : (
        <div className="picking-lot__foot">
          <span className="picking-lot__code">
            <span className="picking-lot__code-label">{t.code.label}</span>
            <span>{lot.managementCode ?? t.code.empty}</span>
            {editable ? (
              <IconButton
                icon="edit"
                size="md"
                aria-label={t.code.edit(lot.lotNo)}
                onClick={onCodeEdit}
              />
            ) : null}
          </span>
          {canReplace(lot) ? (
            <Button
              className="picking-lot__replace"
              variant="outlined"
              size="sm"
              aria-label={`${lot.lotNo} ${t.lot.replace}`}
              onClick={onReplace}
            >
              {t.lot.replace}
            </Button>
          ) : null}
        </div>
      )}

      {code.failed ? <AlertBanner variant="error" title={t.code.failed} /> : null}
    </li>
  );
};

/** 교체로 빠진 LOT — 라인 맨 아래 흐린 이력 줄. */
export const ReplacedRow = ({ lot, uom }: { lot: ShipmentRequestLot; uom: string }) => (
  <li className="picking-lot picking-lot--replaced">
    <div className="picking-lot__head">
      <strong className="picking-lot__no">{lot.lotNo}</strong>
      <Chip status="idle">{t.lot.replaced}</Chip>
      <span className="picking-lot__qty">{t.lot.qty(String(lot.pickedQty), uom)}</span>
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
