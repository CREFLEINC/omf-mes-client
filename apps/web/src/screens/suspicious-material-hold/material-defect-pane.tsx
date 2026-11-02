import {
  Button,
  Chip,
  Dialog,
  Icon,
  Table,
  TextField,
  useToast,
  type Column,
} from '@crefle/web-ui';
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
  const toast = useToast();
  /* 등록되면 오른쪽 아래에 「등록되었습니다.」(사용자 2026-11-02) — 여러 LOT 은 한 번에 보낸 묶음이 끝날 때 한 번. */
  const notifyRegistered = (): void => {
    toast.show({ variant: 'success', description: messages.suspiciousMaterialHold.registered });
  };
  const batchOk = useRef(0);
  const batchLeft = useRef<Set<number>>(new Set());
  const codes = useDefectCodes(selection.length > 0);
  const [openLotId, setOpenLotId] = useState<number | null>(null);
  /* 이 화면에서 등록한 건수 — LOT 줄 오른쪽에 「등록 N건」으로 보인다. */
  const [recorded, setRecorded] = useState<ReadonlyMap<number, number>>(new Map());
  /*
   * 여러 LOT — 팝업에서 넣은 값을 모아 두었다가 바깥 [불량 등록] 한 번으로 모두 보낸다(사용자 2026-11-02). 보내는 동안
   * 단추를 잠그고, 등록된 LOT 의 입력은 비운다 — 같은 입력으로 다시 누를 수 없다. 실패한 LOT 만 입력이 남는다.
   */
  const multi = selection.length > 1;
  const [drafts, setDrafts] = useState<ReadonlyMap<number, DefectDraft>>(new Map());
  const [saving, setSaving] = useState<ReadonlySet<number>>(new Set());
  const [runToken, setRunToken] = useState(0);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const all = codes.data ?? [];
  const majors = majorsOf(all);
  const noCodes = codes.data !== undefined && majors.length === 0;
  /* 고를 불량 유형이 없으면(없음 · 못 받음 · 받는 중) 입력 팝업을 열지 않는다(사용자 2026-11-02). */
  const locked = majors.length === 0;
  const openLot = selection.find((lot) => lot.lotId === openLotId) ?? null;
  /* 고른 LOT 의 입력만 보낸다 — 선택에서 빠진 LOT 의 입력은 남겨도 보내지 않는다. */
  const pending = selection.flatMap((lot) => {
    const draft = drafts.get(lot.lotId);
    return draft === undefined ? [] : [{ lot, draft }];
  });
  const markRecorded = (lotId: number): void =>
    setRecorded((current) => new Map(current).set(lotId, (current.get(lotId) ?? 0) + 1));
  const finish = (lotId: number, ok: boolean): void => {
    /* 묶음의 마지막 LOT 이 끝나면 — 하나라도 등록됐으면 한 번 알린다(상태 갱신 함수 밖에서 · 두 번 돌지 않게). */
    if (batchLeft.current.delete(lotId)) {
      if (ok) batchOk.current += 1;
      if (batchLeft.current.size === 0) {
        if (batchOk.current > 0) notifyRegistered();
        batchOk.current = 0;
      }
    }
    setSaving((current) => {
      const next = new Set(current);
      next.delete(lotId);
      return next;
    });
    if (!ok) return;
    markRecorded(lotId);
    setDrafts((current) => {
      const next = new Map(current);
      next.delete(lotId);
      return next;
    });
  };

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
          const draft = drafts.get(lot.lotId);
          return (
            <li key={lot.lotId}>
              <button
                type="button"
                className="suspicious-material-hold-defect-lot"
                aria-label={tHere.openLot(lot.lotNo)}
                disabled={isLocked || locked || saving.size > 0}
                onClick={() => setOpenLotId(lot.lotId)}
              >
                <strong>{lot.lotNo}</strong>
                <span className="suspicious-material-hold-defect-lot-state">
                  {count > 0 && (
                    <Chip variant="status" status="success" size="sm">
                      {tHere.recordedCount(count)}
                    </Chip>
                  )}
                  {/*
                   * 상태 — 서버에 저장된 것은 「등록 완료 · N건」, 팝업에서 넣고 아직 보내지 않은 것은 「입력 완료 · 1건」
                   * (LOT 마다 보낼 입력은 하나 · 사용자 2026-11-02). 입력은 흐린 보조 글자 자리 그대로.
                   */}
                  {draft !== undefined ? (
                    <span className="suspicious-material-hold-defect-lot-hint">
                      {tHere.draftedCount(1)}
                    </span>
                  ) : (
                    count === 0 && (
                      <span className="suspicious-material-hold-defect-lot-hint">
                        {tHere.enter}
                      </span>
                    )
                  )}
                </span>
              </button>
              {draft !== undefined && (
                <DraftWriter
                  draft={draft}
                  runToken={runToken}
                  onDone={(ok) => finish(lot.lotId, ok)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {/* 여러 LOT — 바깥 [불량 등록] 하나로 입력한 LOT 을 모두 등록한다(사용자 2026-11-02). */}
      {multi && (
        <div className="suspicious-material-hold-action-row">
          <Button
            disabled={isLocked || pending.length === 0 || saving.size > 0}
            loading={saving.size > 0}
            title={pending.length === 0 ? tHere.noDrafts : undefined}
            onClick={() => setConfirmingAll(true)}
          >
            {tHere.submit}
          </Button>
        </div>
      )}
      {confirmingAll && pending.length > 0 && (
        <Dialog
          open
          closeOnBackdropClick={false}
          showCloseButton={false}
          title={tHere.confirm.titleMany(pending.length)}
          onClose={() => setConfirmingAll(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setConfirmingAll(false)}>
                {tHere.confirm.back}
              </Button>
              <Button
                onClick={() => {
                  setConfirmingAll(false);
                  setSaving(new Set(pending.map(({ lot }) => lot.lotId)));
                  batchLeft.current = new Set(pending.map(({ lot }) => lot.lotId));
                  batchOk.current = 0;
                  setRunToken((current) => current + 1);
                }}
              >
                {tHere.submit}
              </Button>
            </>
          }
        >
          {/* LOT 마다 번호, 아래 줄에 흐린 코드 · 진한 수량(· 내용), 사이는 가는 선(사용자 시안 2026-11-02). */}
          <ul className="suspicious-material-hold-confirm-list">
            {pending.map(({ lot, draft }) => (
              <li key={lot.lotId}>
                <strong>{lot.lotNo}</strong>
                <span className="suspicious-material-hold-confirm-detail">
                  <span className="suspicious-material-hold-confirm-code">{draft.codeLabel}</span>
                  <span>{draft.qtyLabel}</span>
                  {draft.description.trim() !== '' && (
                    <span className="suspicious-material-hold-confirm-code">
                      {draft.description.trim()}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {pending.length < selection.length && (
            <p className="field-note">{tHere.confirm.skipped(selection.length - pending.length)}</p>
          )}
        </Dialog>
      )}
      {openLot !== null && (
        <DefectRecordDialog
          key={openLot.lotId}
          lot={openLot}
          codes={all}
          isLocked={isLocked}
          onClose={() => setOpenLotId(null)}
          onRecorded={(lotId) => {
            markRecorded(lotId);
            notifyRegistered();
            setOpenLotId(null);
          }}
          {...(multi
            ? {
                ...(drafts.get(openLot.lotId) === undefined
                  ? {}
                  : { draft: drafts.get(openLot.lotId) }),
                onDraft: (draft: DefectDraft) => {
                  setDrafts((current) => new Map(current).set(openLot.lotId, draft));
                  setOpenLotId(null);
                },
              }
            : {})}
        />
      )}
    </section>
  );
};

/** 여러 LOT 에서 팝업이 모아 두는 한 LOT 의 입력 — 다시 열 때의 칸 값과 보낼 내용 · 확인 창 글자. */
interface DefectDraft {
  code: DefectCodeDraft;
  qty: string;
  description: string;
  body: Omit<Parameters<ReturnType<typeof useRecordMaterialDefect>['write']>[0], 'detectedAt'>;
  codeLabel: string;
  qtyLabel: string;
}

/**
 * 한 LOT 의 등록을 맡는 보이지 않는 칸 — 바깥 [불량 등록]이 `runToken` 을 올리면 한 번 보낸다. LOT 마다 따로 두어
 * 다시 보낼 때 같은 멱등 키를 쓴다(같은 불량이 두 번 기록되지 않게). 실패하면 그 줄 아래에 까닭을 보인다.
 */
const DraftWriter = ({
  draft,
  runToken,
  onDone,
}: {
  draft: DefectDraft;
  runToken: number;
  onDone: (ok: boolean) => void;
}) => {
  /* 알림 함수는 그릴 때마다 새로 오므로 ref 로 붙들어 효과가 거듭 돌지 않게 한다. */
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const record = useRecordMaterialDefect(() => onDoneRef.current(true));
  const sent = useRef(runToken);
  const { write } = record;
  useEffect(() => {
    if (runToken === sent.current) return;
    sent.current = runToken;
    write({ ...draft.body, detectedAt: new Date().toISOString() });
  }, [draft.body, write, runToken]);
  const fieldMessages = Object.values(record.fieldErrors);
  const failed = record.error !== null || fieldMessages.length > 0;
  useEffect(() => {
    if (failed) onDoneRef.current(false);
  }, [failed]);
  return (
    <>
      <SaveErrorBanner error={record.error} />
      {fieldMessages.map((message) => (
        <p key={message} className="field-error">
          {message}
        </p>
      ))}
    </>
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
  draft,
  onDraft,
}: {
  lot: SelectedLotSnapshot;
  codes: readonly DefectCode[];
  isLocked: boolean;
  onClose: () => void;
  onRecorded: (lotId: number) => void;
  /** 여러 LOT 일 때 — 팝업은 입력만 받아 넘기고(바깥 [불량 등록]이 한 번에 등록), 앞서 넣은 값을 다시 연다. */
  draft?: DefectDraft;
  onDraft?: (draft: DefectDraft) => void;
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
  const [code, setCode] = useState<DefectCodeDraft>(draft?.code ?? EMPTY_DEFECT_CODE);
  const [qty, setQty] = useState(draft?.qty ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
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

  const saveDraft = (): void => {
    if (blocked !== null || defectCodeId === null || uomId === undefined) return;
    onDraft?.({
      code,
      qty,
      description,
      body: {
        lotId: lot.lotId,
        defectCodeId,
        defectQty: quantity,
        uomId,
        ...(description.trim() === '' ? {} : { defectDescription: description.trim() }),
      },
      codeLabel: chosenCode === undefined ? String(defectCodeId) : optionOf(chosenCode).label,
      qtyLabel: withUom(String(quantity), uomCodeOf(uomId)),
    });
  };

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
      title={confirming ? tHere.confirm.title : tHere.heading}
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
              onClick={() => (onDraft === undefined ? setConfirming(true) : saveDraft())}
            >
              {onDraft === undefined ? tHere.submit : tHere.saveDraft}
            </Button>
          </>
        )
      }
    >
      {confirming && defectCodeId !== null ? (
        <>
          {/* LOT 번호는 한 줄 전체, 그 아래 불량 코드 · 수량(· 내용) — 사용자 시안 2026-11-02. */}
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
          {/* 제목 아래 「대상 LOT」 — 어느 LOT 의 불량인지 먼저 읽는다(사용자 2026-11-02). */}
          <div className="suspicious-material-hold-defect-target">
            <span className="field-label">{tHere.targetLot}</span>
            <strong>{lot.lotNo}</strong>
          </div>
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
          </div>
          {/* 수량은 유형 · 상세 아래 줄(사용자 2026-11-02). */}
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
