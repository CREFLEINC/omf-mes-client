import { Button, Chip, Dialog, Icon, Table, TextField, type Column } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { SaveErrorBanner } from '../../patterns/master';
import { Select } from '../../patterns/select';
import { lotStatusTone } from '../lot-status-history/options';
import { useLotDetail } from '../lot-status-history/queries';
import { useUomCodeOf, withUom } from '../lot-status-history/uoms';
import { useLotStatusLabels } from '../material-input-scan/lot-status-labels';
import {
  type DefectCode,
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
    render: (row) => <span title={row.lotNo}>{row.lotNo}</span>,
  },
  {
    key: 'workOrderNo',
    header: messages.suspiciousMaterialHold.defect.columns.workOrderNo,
    align: 'center',
    width: '180px',
    render: (row) => <span title={row.workOrderNo}>{row.workOrderNo}</span>,
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
 * W-03-03 의 «불량 내역 등록» 구획(omf-all-around#108 · 서버 선행 P-52).
 *
 * 고른 LOT 마다 한 줄 — 누르면 팝업에서 그 LOT 의 불량 유형 · 수량 · 내용을 받아 등록한다(여러 LOT 도 하나씩 · 사용자
 * 2026-11-02). 불량 기록 API 가 LOT 하나씩 받으므로 LOT 마다 따로 보낸다.
 * ⚠ 보류는 이 화면의 보류 입력이 한다 — 기록과 보류를 한 단추로 묶지 않는다(불량 기록 API 에 보류를
 *   넣지 않기로 했다 · 사용자 결정 2026-10-16).
 */
export const MaterialDefectPane = ({ selection, isLocked }: MaterialDefectPaneProps) => {
  const navigate = useNavigate();
  const codes = useDefectCodes(selection.length > 0);
  const [openLotId, setOpenLotId] = useState<number | null>(null);
  /* 이 화면에서 등록한 건수 — LOT 줄 오른쪽에 「등록 N건」으로 보인다. */
  const [recorded, setRecorded] = useState<ReadonlyMap<number, number>>(new Map());
  const all = codes.data ?? [];
  const majors = majorsOf(all);
  const noCodes = codes.data !== undefined && majors.length === 0;
  /* 고를 불량 유형이 없으면(없음 · 못 받음 · 받는 중) 입력 팝업을 열지 않는다(사용자 2026-11-02). */
  const locked = majors.length === 0;
  const openLot = selection.find((lot) => lot.lotId === openLotId) ?? null;

  return (
    <section className="suspicious-material-hold-section" aria-label={tHere.heading}>
      {/*
       * 제목 줄 — 제목 바로 오른쪽에 코드 없음 · 못 받음 안내 알약, 오른쪽 끝에 [불량 코드 등록](사용자 2026-11-02).
       */}
      <div className="suspicious-material-hold-section-head">
        <div className="suspicious-material-hold-title-group">
          <h3 className="suspicious-material-hold-subtitle">{tHere.heading}</h3>
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
      <ul className="suspicious-material-hold-defect-lots">
        {selection.map((lot) => {
          const count = recorded.get(lot.lotId) ?? 0;
          return (
            <li key={lot.lotId}>
              <button
                type="button"
                className="suspicious-material-hold-defect-lot"
                aria-label={tHere.openLot(lot.lotNo)}
                disabled={isLocked || locked}
                onClick={() => setOpenLotId(lot.lotId)}
              >
                <strong>{lot.lotNo}</strong>
                {count > 0 ? (
                  <Chip variant="status" status="success" size="sm">
                    {tHere.recordedCount(count)}
                  </Chip>
                ) : (
                  <span className="suspicious-material-hold-defect-lot-hint">{tHere.enter}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {openLot !== null && (
        <DefectRecordDialog
          key={openLot.lotId}
          lot={openLot}
          codes={all}
          isLocked={isLocked}
          onClose={() => setOpenLotId(null)}
          onRecorded={(lotId) => {
            setRecorded((current) => new Map(current).set(lotId, (current.get(lotId) ?? 0) + 1));
            setOpenLotId(null);
          }}
        />
      )}
    </section>
  );
};

/**
 * LOT 하나의 불량 입력 팝업 — 유형(·상세) · 수량 · 내용을 받고, [불량 등록]을 누르면 같은 창이 확인 화면으로 바뀐다.
 * 확인에서 한 번 더 눌러야 등록한다(사용자 2026-11-02). 등록되면 창이 닫히고 LOT 줄에 「등록 N건」이 선다.
 */
const DefectRecordDialog = ({
  lot,
  codes: all,
  isLocked,
  onClose,
  onRecorded,
}: {
  lot: SelectedLotSnapshot;
  codes: readonly DefectCode[];
  isLocked: boolean;
  onClose: () => void;
  onRecorded: (lotId: number) => void;
}) => {
  const majorFieldId = useId();
  const minorFieldId = useId();
  /*
   * 단위 — 목록(재고 기준)에 없으면 LOT 상세의 단위로 기록한다(재고 기록이 아직 없는 생산 LOT 등 · 사용자 2026-11-02).
   * 상세 칸 · 팝업과 같은 조회라 한 번 받은 LOT 은 다시 부르지 않는다.
   */
  const detail = useLotDetail(lot.uomId === undefined ? lot.lotId : null);
  const uomId = lot.uomId ?? detail.data?.uomId ?? undefined;
  const uomCodeOf = useUomCodeOf();
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState<DefectCodeDraft>(EMPTY_DEFECT_CODE);
  const [qty, setQty] = useState('');
  const [description, setDescription] = useState('');
  /*
   * 고른 뒤 다음 칸으로 — 불량 유형을 고르면 상세가 있으면 상세를 펼치고, 없으면 수량으로. 상세를 고르면 수량으로
   * (사용자 2026-11-02). 상세 칸은 유형을 고른 뒤에 서므로 그린 다음에 옮긴다.
   */
  const minorRef = useRef<HTMLButtonElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const [nextFocus, setNextFocus] = useState<'afterMajor' | 'qty' | null>(null);
  useEffect(() => {
    if (nextFocus === null) return;
    setNextFocus(null);
    const minor = minorRef.current;
    if (nextFocus === 'afterMajor' && minor !== null) {
      minor.focus();
      minor.click();
    } else {
      qtyRef.current?.focus();
    }
  }, [nextFocus]);
  /* 같은 불량이 거듭 기록되지 않게 성공하면 창을 닫는다(담당자 결정 · #108). */
  const record = useRecordMaterialDefect(() => onRecorded(lot.lotId));

  const majors = majorsOf(all);
  const minors = minorsOf(all, code.majorId);
  const defectCodeId = resolveDefectCodeId(all, code);
  const chosenCode = all.find((item) => item.defectCodeId === defectCodeId);
  const quantity = Number(qty.trim());
  const blocked =
    defectCodeId === null
      ? t.blocked.code
      : !(qty.trim() !== '' && quantity > 0)
        ? t.blocked.qty
        : uomId === undefined
          ? t.blocked.uom
          : null;
  const disabled = isLocked || record.isSaving;
  /* 상세까지 받아 보고도 단위가 없을 때만 — 받는 중에는 띄우지 않는다. */
  const uomUnknown = uomId === undefined && !detail.isPending;

  const submit = (): void => {
    if (blocked !== null || defectCodeId === null || uomId === undefined) return;
    record.write({
      lotId: lot.lotId,
      defectCodeId,
      defectQty: quantity,
      uomId,
      detectedAt: new Date().toISOString(),
      ...(description.trim() === '' ? {} : { defectDescription: description.trim() }),
    });
  };

  return (
    <Dialog
      open
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={confirming ? tHere.confirm.title : tHere.dialogTitle(lot.lotNo)}
      onClose={() => {
        if (!record.isSaving) onClose();
      }}
      footer={
        confirming ? (
          <>
            <Button
              variant="outlined"
              disabled={record.isSaving}
              onClick={() => setConfirming(false)}
            >
              {tHere.confirm.back}
            </Button>
            <Button loading={record.isSaving} onClick={submit}>
              {tHere.submit}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outlined" onClick={onClose}>
              {tHere.confirm.cancel}
            </Button>
            <Button
              disabled={blocked !== null || disabled}
              title={blocked ?? undefined}
              onClick={() => setConfirming(true)}
            >
              {tHere.submit}
            </Button>
          </>
        )
      }
    >
      {confirming && defectCodeId !== null ? (
        <>
          <dl className="suspicious-material-hold-confirm">
            {(
              [
                [tHere.confirm.lot, lot.lotNo],
                [
                  tHere.confirm.code,
                  chosenCode === undefined ? String(defectCodeId) : optionOf(chosenCode).label,
                ],
                [tHere.confirm.qty, withUom(String(quantity), uomCodeOf(uomId ?? null))],
                ...(description.trim() === ''
                  ? []
                  : [[tHere.confirm.description, description.trim()] as const]),
              ] as const
            ).map(([label, value]) => (
              <div className="field-cell" key={label}>
                <dt className="field-label">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <SaveErrorBanner error={record.error} />
        </>
      ) : (
        <div className="suspicious-material-hold-defect-form">
          {/* 단위를 끝내 모르면 막힌 까닭을 맨 위에 보인다(사용자 2026-11-02). */}
          {uomUnknown && (
            <p className="iqc-inspection-action-note" data-tone="info" title={tHere.uomUnknownNote}>
              <Icon name="info" size={14} aria-hidden />
              <span className="iqc-inspection-action-note-text">{tHere.uomUnknownNote}</span>
            </p>
          )}
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
                searchable
                options={majors.map(optionOf)}
                value={code.majorId}
                placeholder={tHere.majorPlaceholder}
                invalid={!disabled && code.majorId === ''}
                disabled={disabled}
                onChange={(value) => {
                  setCode({ majorId: value, minorId: '' });
                  setNextFocus('afterMajor');
                }}
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
                  ref={minorRef}
                  searchable
                  options={minors.map(optionOf)}
                  value={code.minorId}
                  disabled={disabled}
                  onChange={(value) => {
                    setCode({ ...code, minorId: value });
                    setNextFocus('qty');
                  }}
                />
              </div>
            )}
            <TextField
              ref={qtyRef}
              containerClassName="suspicious-material-hold-defect-qty"
              label={t.qty.label}
              required
              placeholder={tHere.qtyPlaceholder}
              aria-invalid={!disabled && qty.trim() === ''}
              inputMode="decimal"
              value={qty}
              disabled={disabled}
              error={record.fieldErrors.defectQty}
              onChange={(event) => setQty(event.target.value)}
            />
          </div>
          <TextField
            label={t.description}
            placeholder={tHere.descriptionPlaceholder}
            value={description}
            disabled={disabled}
            onChange={(event) => setDescription(event.target.value)}
          />
          <SaveErrorBanner error={record.error} />
        </div>
      )}
    </Dialog>
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
  /*
   * 좁아지면 표를 칸 폭에 맞춰 줄인다(가로로 밀지 않는다) — 표가 늘 칸 안 가운데에 다 보이게(사용자 2026-11-02). 앞선
   * 넓은 배치에서 늘어난 폭이 좁은 배치에 남아 표가 넘치던 것도 막는다.
   */
  const fit = useFitColumns(resizable.columns);
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
