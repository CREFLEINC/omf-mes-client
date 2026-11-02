import { Button, Chip, Icon, Table, TextField, type Column } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { SaveErrorBanner } from '../../patterns/master';
import { Select } from '../../patterns/select';
import { lotStatusTone } from '../lot-status-history/options';
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

type AffectedProductionLots = components['schemas']['AffectedProductionLots'];

const t = messages.materialDefect;
/* 이 화면 시안 글자(사용자 2026-11-02) — POP 자재 불량 화면과 같이 쓰는 기본 문구는 그대로 둔다. */
const tHere = messages.suspiciousMaterialHold.defect;

type AffectedRow = AffectedProductionLots['items'][number];

/* 상태는 코드가 아니라 공통코드 이름으로 보인다(다른 LOT 화면과 같은 조회). 열 이름 · 가운데 정렬은 이 화면 시안(2026-11-02). */
const columnsOf = (statusLabel: (code: string) => string): Column<AffectedRow>[] => [
  {
    key: 'lotNo',
    header: messages.suspiciousMaterialHold.defect.columns.lotNo,
    align: 'center',
    width: '300px',
    render: (row) => row.lotNo,
  },
  {
    key: 'workOrderNo',
    header: messages.suspiciousMaterialHold.defect.columns.workOrderNo,
    align: 'center',
    width: '180px',
    render: (row) => row.workOrderNo,
  },
  {
    key: 'statusCode',
    header: messages.suspiciousMaterialHold.defect.columns.statusCode,
    align: 'center',
    width: '120px',
    render: (row) => (
      <Chip variant="status" status={lotStatusTone(row.statusCode)} size="sm">
        {statusLabel(row.statusCode)}
      </Chip>
    ),
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
  const navigate = useNavigate();
  const majorFieldId = useId();
  const minorFieldId = useId();
  const lot = selection.length === 1 ? (selection[0] ?? null) : null;
  const lotId = lot?.lotId ?? null;

  const codes = useDefectCodes(lotId !== null);
  const [code, setCode] = useState<DefectCodeDraft>(EMPTY_DEFECT_CODE);
  const [qty, setQty] = useState('');
  const [description, setDescription] = useState('');
  const [isRecorded, setIsRecorded] = useState(false);
  /* 같은 불량이 거듭 기록되지 않게 성공하면 입력을 비운다(담당자 결정 · #108). 「기록했습니다」는 남긴다. */
  const record = useRecordMaterialDefect(() => {
    setIsRecorded(true);
    setCode(EMPTY_DEFECT_CODE);
    setQty('');
    setDescription('');
  });

  /* 다른 LOT 으로 옮기면 입력을 비운다 — 앞 LOT 의 불량이 다음 LOT 에 기록되면 안 된다. */
  useEffect(() => {
    setCode(EMPTY_DEFECT_CODE);
    setQty('');
    setDescription('');
    setIsRecorded(false);
  }, [lotId]);

  if (lot === null) {
    return (
      <section className="suspicious-material-hold-section" aria-label={t.pane.heading}>
        <h3 className="suspicious-material-hold-subtitle">{t.pane.heading}</h3>
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
  const noCodes = codes.data !== undefined && majors.length === 0;
  /* 고를 불량 유형이 없으면(없음 · 못 받음 · 받는 중) 유형 · 수량 · 내용을 모두 잠근다(사용자 2026-11-02). */
  const locked = majors.length === 0;

  /*
   * 「의심자재 보류 등록」 카드 안 자재 불량 기록 구획 — 보류 시 제한 사항과 나란히 선다(사용자 2026-11-02).
   */
  return (
    <section className="suspicious-material-hold-section" aria-label={t.pane.heading}>
      {/* 오른쪽 위 [불량 코드 등록] — 불량 · 원인코드 관리 화면으로 간다(사용자 2026-11-02). */}
      {/*
       * 제목 줄 — 제목 바로 오른쪽에 코드 없음 · 못 받음 안내 알약, 오른쪽 끝에 [불량 코드 등록](사용자 2026-11-02).
       */}
      <div className="suspicious-material-hold-section-head">
        <div className="suspicious-material-hold-title-group">
          <h3 className="suspicious-material-hold-subtitle">{t.pane.heading}</h3>
          {codes.isError && (
            <p className="iqc-inspection-action-note" data-tone="info" title={t.code.loadFailed}>
              <Icon name="info" size={14} aria-hidden />
              <span className="iqc-inspection-action-note-text">{t.code.loadFailed}</span>
            </p>
          )}
          {noCodes && (
            <p className="iqc-inspection-action-note" data-tone="info" title={tHere.noCodesNote}>
              <Icon name="info" size={14} aria-hidden />
              <span className="iqc-inspection-action-note-text">{tHere.noCodesNote}</span>
            </p>
          )}
        </div>
        <Button variant="outlined" onClick={() => void navigate('/master-data/defect-cause-code')}>
          {tHere.registerCode}
        </Button>
      </div>
      {/* 유형 · 수량 한 줄(수량은 좁게), 없음 안내는 유형 바로 아래, 내용은 전체 폭(사용자 시안 2026-11-02). */}
      <div className="suspicious-material-hold-defect-row">
        <div className="field-cell">
          <label className="field-label" htmlFor={majorFieldId}>
            {tHere.major}{' '}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <Select
            id={majorFieldId}
            options={majors.map(optionOf)}
            value={code.majorId}
            placeholder={noCodes ? tHere.noCodesPlaceholder : tHere.majorPlaceholder}
            invalid={!disabled && !locked && code.majorId === ''}
            disabled={disabled || locked}
            onChange={(value) => setCode({ majorId: value, minorId: '' })}
          />
        </div>
        {minors.length > 0 && (
          <div className="field-cell">
            <label className="field-label" htmlFor={minorFieldId}>
              {t.code.minor}{' '}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </label>
            <Select
              id={minorFieldId}
              options={minors.map(optionOf)}
              value={code.minorId}
              disabled={disabled || locked}
              onChange={(value) => setCode({ ...code, minorId: value })}
            />
          </div>
        )}
        <TextField
          containerClassName="suspicious-material-hold-defect-qty"
          label={t.qty.label}
          required
          placeholder={tHere.qtyPlaceholder}
          aria-invalid={!disabled && !locked && qty.trim() === ''}
          inputMode="decimal"
          value={qty}
          disabled={disabled || locked}
          error={record.fieldErrors.defectQty}
          onChange={(event) => setQty(event.target.value)}
        />
      </div>
      <TextField
        label={t.description}
        placeholder={tHere.descriptionPlaceholder}
        value={description}
        disabled={disabled || locked}
        onChange={(event) => setDescription(event.target.value)}
      />
      <SaveErrorBanner error={record.error} />
      {isRecorded && <p className="field-note">{t.recorded}</p>}
      <div className="suspicious-material-hold-action-row">
        <Button
          disabled={blocked !== null || disabled}
          title={blocked ?? undefined}
          onClick={submit}
        >
          {record.isSaving ? t.saving : tHere.submit}
        </Button>
      </div>
    </section>
  );
};

/**
 * 관련 생산 LOT — 고른 LOT 하나가 들어간 생산 LOT(작업지시 · 계보 기준 추정 · #166). 자재 불량 기록과 따로 세워 카드 맨 아래
 * 전체 폭에 둔다(사용자 2026-11-02).
 */
export const AffectedProductionLotsSection = ({
  selection,
}: {
  selection: SelectedLotSnapshot[];
}) => {
  const lot = selection.length === 1 ? (selection[0] ?? null) : null;
  const affected = useAffectedProductionLots(lot?.lotId ?? null);
  const statuses = useLotStatusLabels();
  /* 표는 다른 목록과 같이 열 폭을 끌어 바꾸고 순서를 옮길 수 있다 — 바꾼 값은 브라우저에 남는다(사용자 2026-11-02). */
  const ordered = useColumnOrder(
    'omf-mes:suspicious-material-hold:affected:order',
    columnsOf(statuses.describe),
  );
  const resizable = useColumnWidths('omf-mes:suspicious-material-hold:affected', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  if (lot === null) return null;
  const basisNote =
    affected.data?.basis === 'LOT_GENEALOGY_ESTIMATE' ? t.affected.genealogy : tHere.estimateNote;

  return (
    <section className="suspicious-material-hold-section" aria-label={tHere.affectedHeading}>
      {/* 제목 바로 오른쪽에 조회 근거 알약, 오른쪽 끝에 총 건수(사용자 2026-11-02). */}
      <div className="suspicious-material-hold-section-head">
        <div className="suspicious-material-hold-title-group">
          <h3 className="suspicious-material-hold-subtitle">{tHere.affectedHeading}</h3>
          {/* 근거 안내는 보일 LOT 이 있을 때만 — 0건이면 빈 표 안내만으로 충분하다(사용자 2026-11-02). */}
          {(affected.data?.items.length ?? 0) > 0 && (
            <p className="iqc-inspection-action-note" data-tone="info" title={basisNote}>
              <Icon name="info" size={14} aria-hidden />
              <span className="iqc-inspection-action-note-text">{basisNote}</span>
            </p>
          )}
        </div>
        {affected.data !== undefined && (
          <Chip size="sm">{tHere.affectedCount(affected.data.items.length)}</Chip>
        )}
      </div>
      {affected.isError ? (
        <p className="field-note">{t.affected.loadFailed}</p>
      ) : (
        <div
          ref={fit.ref}
          className="wide-table suspicious-material-hold-table-scroll"
          style={resizable.style}
        >
          <Table
            caption={tHere.affectedHeading}
            density="compact"
            columns={fit.columns}
            rows={affected.data?.items ?? []}
            getRowId={(row) => String(row.lotId)}
            empty={
              <p className="field-note">
                {affected.isPending ? t.affected.loading : t.affected.none}
              </p>
            }
          />
        </div>
      )}
    </section>
  );
};
