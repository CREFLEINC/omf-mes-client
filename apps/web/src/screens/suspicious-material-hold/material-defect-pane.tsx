import { Button, Chip, Select, Table, TextField, type Column } from '@crefle/web-ui';
import type { AffectedProductionLots } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { useLotStatusLabels } from '../material-input-scan/lot-status-labels';
import {
  EMPTY_DEFECT_CODE,
  majorsOf,
  minorsOf,
  optionOf,
  resolveDefectCodeId,
  type DefectCodeDraft,
} from '../material-defect/defect-code';
import {
  useAffectedProductionLots,
  useDefectCodes,
  useRecordMaterialDefect,
} from '../material-defect/queries';
import type { SelectedLotSnapshot } from './candidate-model';

const t = messages.materialDefect;

type AffectedRow = AffectedProductionLots['items'][number];

/* 상태는 코드가 아니라 공통코드 이름으로 보인다(다른 LOT 화면과 같은 조회). */
const columnsOf = (statusLabel: (code: string) => string): Column<AffectedRow>[] => [
  { key: 'lotNo', header: t.affected.columns.lotNo, render: (row) => row.lotNo },
  { key: 'workOrderNo', header: t.affected.columns.workOrderNo, render: (row) => row.workOrderNo },
  {
    key: 'statusCode',
    header: t.affected.columns.statusCode,
    render: (row) => statusLabel(row.statusCode),
  },
];

export interface MaterialDefectPaneProps {
  selection: SelectedLotSnapshot[];
  isLocked: boolean;
}

/**
 * W-03-03 의 «자재 불량 기록 + 영향 생산 LOT» 구획(omf-all-around#108 · 서버 선행 P-52).
 *
 * ⭐ LOT **하나**를 골랐을 때만 선다 — 불량 기록은 LOT 하나에 붙고 영향 범위도 LOT 하나의 것이다.
 * ⚠ 보류는 이 화면의 보류 입력이 한다 — 기록과 보류를 한 단추로 묶지 않는다(불량 기록 API 에 보류를
 *   넣지 않기로 했다 · 사용자 결정 2026-10-16).
 */
export const MaterialDefectPane = ({ selection, isLocked }: MaterialDefectPaneProps) => {
  const majorFieldId = useId();
  const minorFieldId = useId();
  const lot = selection.length === 1 ? (selection[0] ?? null) : null;
  const lotId = lot?.lotId ?? null;

  const codes = useDefectCodes(lotId !== null);
  const affected = useAffectedProductionLots(lotId);
  const statuses = useLotStatusLabels();
  const [code, setCode] = useState<DefectCodeDraft>(EMPTY_DEFECT_CODE);
  const [qty, setQty] = useState('');
  const [description, setDescription] = useState('');
  const [isRecorded, setIsRecorded] = useState(false);
  const record = useRecordMaterialDefect(() => setIsRecorded(true));

  /* 다른 LOT 으로 옮기면 입력을 비운다 — 앞 LOT 의 불량이 다음 LOT 에 기록되면 안 된다. */
  useEffect(() => {
    setCode(EMPTY_DEFECT_CODE);
    setQty('');
    setDescription('');
    setIsRecorded(false);
  }, [lotId]);

  if (lot === null) {
    return (
      <section className="pane" aria-label={t.pane.heading}>
        <h2>{t.pane.heading}</h2>
        <p className="field-note">{t.pane.singleOnly}</p>
      </section>
    );
  }

  const all = codes.data ?? [];
  const majors = majorsOf(all);
  const minors = minorsOf(all, code.majorId);
  const defectCodeId = resolveDefectCodeId(all, code);
  const quantity = Number(qty.trim());
  const blocked =
    defectCodeId === null
      ? t.blocked.code
      : !(qty.trim() !== '' && quantity > 0)
        ? t.blocked.qty
        : lot.uomId === undefined
          ? t.blocked.uom
          : null;

  const submit = (): void => {
    if (blocked !== null || defectCodeId === null || lot.uomId === undefined) return;
    setIsRecorded(false);
    record.write({
      lotId: lot.lotId,
      defectCodeId,
      defectQty: quantity,
      uomId: lot.uomId,
      detectedAt: new Date().toISOString(),
      ...(description.trim() === '' ? {} : { defectDescription: description.trim() }),
    });
  };

  const disabled = isLocked || record.isSaving;

  return (
    <section className="pane" aria-label={t.pane.heading}>
      <h2>{t.pane.heading}</h2>
      <p className="field-note">
        {t.lot.label} {lot.lotNo}
      </p>

      {codes.isError && <p className="field-note">{t.code.loadFailed}</p>}
      {codes.data !== undefined && majors.length === 0 && (
        <p className="field-note">{t.code.none}</p>
      )}
      <div className="form-grid">
        <div className="field-cell">
          <label className="field-label" htmlFor={majorFieldId}>
            {t.code.major}
          </label>
          <Select
            id={majorFieldId}
            options={majors.map(optionOf)}
            value={code.majorId}
            disabled={disabled || majors.length === 0}
            onChange={(value) => setCode({ majorId: value, minorId: '' })}
          />
        </div>
        {minors.length > 0 && (
          <div className="field-cell">
            <label className="field-label" htmlFor={minorFieldId}>
              {t.code.minor}
            </label>
            <Select
              id={minorFieldId}
              options={minors.map(optionOf)}
              value={code.minorId}
              disabled={disabled}
              onChange={(value) => setCode({ ...code, minorId: value })}
            />
          </div>
        )}
        <TextField
          label={t.qty.label}
          inputMode="decimal"
          value={qty}
          disabled={disabled}
          error={record.fieldErrors.defectQty}
          onChange={(event) => setQty(event.target.value)}
        />
        <TextField
          label={t.description}
          value={description}
          disabled={disabled}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <SaveErrorBanner error={record.error} />
      {isRecorded && <p className="field-note">{t.recorded}</p>}
      <p className="field-note">{t.hold.webNote}</p>
      <div className="form-actions">
        {blocked !== null && <p className="field-note form-actions-secondary">{blocked}</p>}
        <Button variant="filled" size="sm" disabled={blocked !== null || disabled} onClick={submit}>
          {record.isSaving ? t.saving : t.submit}
        </Button>
      </div>

      <h3>{t.affected.heading}</h3>
      <p className="field-note">
        <Chip variant="status" size="sm" status="warning">
          {t.affected.estimate}
        </Chip>
      </p>
      {affected.isError ? (
        <p className="field-note">{t.affected.loadFailed}</p>
      ) : (
        <Table
          caption={t.affected.caption}
          density="compact"
          columns={columnsOf(statuses.describe)}
          rows={affected.data?.items ?? []}
          getRowId={(row) => String(row.lotId)}
          empty={
            <p className="field-note">
              {affected.isPending ? t.affected.loading : t.affected.none}
            </p>
          }
        />
      )}
    </section>
  );
};
