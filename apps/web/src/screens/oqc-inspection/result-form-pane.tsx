import { Button, Icon, Progress, Select, TextArea, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

import { CONFIRMED_STATUS } from './inspection-status';
import { SaveErrorBanner } from '../../patterns/master';

import { isKnownCode, labelOfCode, type CodeOption } from './code-options';
import { ConfirmDialog } from './confirm-dialog';
import { FieldLabel } from './field-label';
import { JudgmentChange } from './judgment-change';
import {
  canConfirm,
  formatMicro,
  fromServerQty,
  hasQuantityError,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';
import { toTransitionPreview } from './transition-preview';
import { JudgmentGuide } from './transition-warning';
import type { InspectionResultRound } from './types';
import { withUom } from './uom-lookup';

/**
 * 판정 입력 구획 — **합계 제약이 이 구획을 지배한다.**
 *
 * ```
 * 합격 + 불합격 + 보류 = 검사수량
 * ```
 *
 * ⭐ **저장이 한 번이고 그것이 곧 확정이다.** 임시 저장을 두지 않는다 — 액션표에 없고(「판정
 * 수정」은 ⛔ 두지 않는다로 명시) 관리웹에는 오프라인 갈래가 없다. 그래서 「판정 저장」은
 * 확인 창을 열고, 쓰기는 그 창의 버튼에서만 나간다.
 *
 * ⭐ **합격판정개수가 있는 기준이면 종합 판정을 수량으로 채운다**(omf-all-around#126 · IQC #125 와 같은 규칙).
 * 채운 판정은 바꿀 수 있지만, 바꾸면 「판정 변경 사유」를 넣어야 저장된다 — 서버도 같은 규칙으로 막는다(P-70).
 * 합격판정개수가 없으면 종전처럼 사람이 고른다.
 *
 * ⛔ **확정된 회차는 고칠 수 있는 것처럼 보이지 않게 한다.** 판정은 정정하지 않고 재검사로 새
 * 회차를 쌓는다(§5-3). 잠근 이유를 사유로 함께 밝히고, **거기서 할 수 있는 일(재검사)을 낸다.**
 *
 * ⛔ **오류를 타이핑마다 보이지 않는다.** 「0.5」를 치는 정상 경로가 `0` → `0.` → `0.5` 라,
 * 가운데 한 글자 동안 「수량이 아니다」가 뜨면 맞게 치는 사람에게 틀렸다고 말하는 셈이다.
 * 저장을 누른 뒤부터 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.result;
const unknownValue = messages.oqcInspection.queue.emptyValue;

export interface ResultFormPaneProps {
  /** 지금 다루는 회차. 아직 아무도 판정하지 않았거나 재검사 중이면 `null` */
  round: InspectionResultRound | null;
  /** 확인 창의 제목에 쓴다 — 무엇에 대한 판정인지가 누르는 자리에 있어야 한다 */
  inspectionRequestNo: string;
  /**
   * 검사수량 — **재검사 중이면 언제나 의뢰의 대상 수량**이고, 그 밖에는 회차가 있으면 그
   * 값, 없으면 의뢰의 대상 수량이다. 새 회차가 다시 검사하는 대상은 앞 회차가 아니라
   * 의뢰이기 때문이다(`screen.tsx` 의 `inspectedQty` 주석).
   */
  inspectedQty: number;
  /** 수량 옆에 붙일 단위 코드(표시 전용 · #136). 모르면 `null` — 숫자만 둔다 */
  uomCode?: string | null;
  /** 의뢰에 대상 LOT 이 있는가 — 전이 경고·확인 창의 문장만 가른다(저장 조건과 무관). 기본 있음. */
  hasLot?: boolean;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;

  /** 종합 판정 선택지. **비어 있을 수 있다** — 시드가 아직 안 들어간 상태다 */
  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;

  /**
   * 합격판정개수 기준 자동 판정(omf-all-around#126). 기준에 합격판정개수가 없으면 `acceptanceNumber` 가 `null` 이고
   * 아래 넷은 쓰이지 않는다.
   */
  acceptanceNumber: number | null;
  /** 자동 판정의 표시명. 셀 수 없으면 `null` */
  expectedJudgmentLabel: string | null;
  /** 고른 판정이 자동 판정과 달라 변경 사유가 필요한가 */
  needsChangeReason: boolean;
  changeReason: string;
  onChangeReasonChange: (reason: string) => void;
  /** 불합격 사유(선택 · #136) — 불합격을 골랐을 때만 칸이 선다. 저장에는 비고로 실린다. */
  rejectionReason?: string;
  onRejectionReasonChange?: (reason: string) => void;

  /**
   * 확인 창의 「판정 저장」이 부른다. **검사한 시각을 함께 넘긴다** — 아래 `openedAt` 주석 참조.
   */
  onSave: (inspectedAt: string) => void;
  isSaving: boolean;
  /** 마지막 저장이 성공했는가. 되돌릴 수 없는 쓰기가 끝난 것을 화면이 말한다 */
  isJustSaved: boolean;
  /** 서버가 칸을 짚어 준 오류. 로컬 검증 결과와 합쳐 그 칸에 낸다 */
  fieldErrors: Record<string, string>;
  saveError: ApiError | null;
  /** 충돌일 때 「최신 불러오기」를 낸다. 재조회로 풀리지 않는 오류에는 배너가 내지 않는다 */
  onReload: () => void;

  /** 지금 **재검사 회차를 쓰는 중**인가. 참이면 `round` 가 `null` 로 들어와 칸이 열려 있다 */
  isReinspecting: boolean;
  onStartReinspection: () => void;
  onCancelReinspection: () => void;

  /** 「검사한 시리얼」 구획(omf-all-around#68) — 출하작업지시 의뢰의 열린 회차에서만 부모가 넘긴다. */
  serialSection?: ReactNode;
  /** 시리얼이 수량과 모순되면 그 이유(담당자 결정 Q3). */
  serialBlockedReason?: string | null;
}

/** 계약이 짚어 줄 수 있는 칸 이름 ↔ 화면의 초안 칸. */
const FIELD_OF: Record<keyof QuantityDraft, string> = {
  accepted: 'acceptedQty',
  rejected: 'rejectedQty',
  held: 'heldQty',
};

export const ResultFormPane = ({
  round,
  inspectionRequestNo,
  inspectedQty,
  uomCode = null,
  hasLot = true,
  draft,
  onChange,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  acceptanceNumber,
  expectedJudgmentLabel,
  needsChangeReason,
  changeReason,
  onChangeReasonChange,
  rejectionReason = '',
  onRejectionReasonChange,
  onSave,
  isSaving,
  isJustSaved,
  fieldErrors,
  saveError,
  onReload,
  isReinspecting,
  onStartReinspection,
  onCancelReinspection,
  serialSection,
  serialBlockedReason = null,
}: ResultFormPaneProps) => {
  const judgmentId = useId();
  const lockNoteId = useId();
  const coaNoteId = useId();
  const blockedNoteId = useId();
  /**
   * ⭐ **이 화면은 어떤 회차도 고치지 않는다.**
   *
   * 확정본이 아니라 **회차가 있다는 사실**이 잠그는 근거다. 「작성중」만 열어 두면 막다른 길이
   * 생긴다 — 이 화면에는 임시 저장도 확정 경로도 없어서, 칸이 열려 있어도 저장은 서버에서
   * `UNIQUE(의뢰, 회차)` 에 걸려 409 로 되돌아오고, 「확정본이 아니다」라는 이유로 재검사 단추도
   * 서지 않는다. 그러면 그 회차를 끝낼 길이 화면 어디에도 없다.
   */
  const isLocked = round !== null;
  const isConfirmed = round?.statusCode === CONFIRMED_STATUS;
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const preview = toTransitionPreview(draft, judgment, inspectedQty);
  const [showErrors, setShowErrors] = useState(false);

  /**
   * 확인 창이 열려 있는가 — **열린 순간의 「검사한 시각」을 함께 들고 있다.**
   *
   * ⭐ **재시도에도 그 값을 그대로 쓴다.** 멱등 키의 수명이 `until-applied` 인데 그 키는 «보낼
   * 값의 지문»에 매여 있고, `inspectedAt` 이 지문에 들어 있다. 누를 때마다 시각을 새로 읽으면
   * 5xx 뒤 재시도가 **매번 새 키로 나가** 서버가 그것을 다른 쓰기로 보고 회차를 하나 더 만들려
   * 한다 — 되돌릴 수 없는 쓰기에서 정확히 막으려던 사태다. 그래서 시각은 **창을 여는 순간 한 번**
   * 읽는다. 창을 닫았다 다시 열면 새 시각이고, 그것은 다른 시도이므로 새 키가 맞다.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);

  /*
   * 성공했으면 창을 닫는다.
   *
   * ⛔ **실패에는 닫지 않는다** — 같은 창에서 다시 눌러야 같은 멱등 키가 나간다. 그래서 「눌렀다」가
   * 아니라 «성공했다»를 신호로 닫으며, 그 신호는 부모가 «겨눈 대상이 그대로일 때만» 켠다.
   */
  useEffect(() => {
    if (isJustSaved) setOpenedAt(null);
  }, [isJustSaved]);

  /**
   * 저장이 막혔다면 **무엇이** 막혔는지. 풀렸으면 `null`.
   *
   * ⛔ 네 갈래를 뭉개지 않는다 — 푸는 방법이 다르다(스펙 §6).
   *
   * ⭐ **선택지가 비어 있음을 「고르지 않았다」보다 «먼저» 본다.** 목록이 비어 있는데 「고르세요」
   * 라고 하면 사용자는 고를 수 없는 것을 고르려 든다 — 실제로 할 일은 담당자 문의다.
   */
  const saveBlockedReason: string | null = isLocked
    ? isConfirmed
      ? t.blockedByConfirmed
      : t.blockedByDraftElsewhere
    : !canConfirm(totals)
      ? t.blockedByTotals
      : judgmentOptions.length === 0
        ? t.blockedByJudgmentOptions
        : judgment === ''
          ? t.blockedByJudgment
          : needsChangeReason && changeReason.trim() === ''
            ? t.judgmentChange.required
            : serialBlockedReason;

  /** 저장을 누른다 — **여는 것뿐이다.** 쓰기는 확인 창의 버튼에서 나간다. */
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setShowErrors(true);

    if (hasQuantityError(errors) || saveBlockedReason !== null) return;

    setOpenedAt(new Date().toISOString());
  };

  /** 서버가 짚어 준 칸 오류를 화면의 칸 이름으로 옮긴다. */
  const serverErrorOf = (key: keyof QuantityDraft): string | undefined =>
    fieldErrors[FIELD_OF[key]];

  /*
   * 입력 현황(omf-all-around#136 · IQC #133 과 같은 모양) — 「입력 완료 15 / 20 EA」 · 「미입력 5 EA」 · 막대.
   * 맞거나 모자랄 때는 오른쪽 상태가 이미 말하므로 문장을 두지 않고, 넘쳤을 때만 한 줄을 낸다.
   *
   * ⛔ **셀 수 없으면 아무 말도 하지 않는다.** 한 칸이라도 수량이 아니면 합계는 알 수 없는
   * 것이고, 그때 「일치」든 「모자람」이든 내면 **거짓을 말하는 것**이다.
   */
  const isOver = totals.kind === 'counted' && totals.remaining < 0n;
  const overText = isOver ? withUom(formatMicro(-totals.remaining), uomCode) : '';
  const totalsNote = isOver ? t.over(overText) : null;
  const inspectedMicro = fromServerQty(inspectedQty);
  const progress =
    totals.kind === 'uncountable'
      ? { value: 0, tone: 'idle' as const }
      : totals.matches
        ? { value: 100, tone: 'success' as const }
        : totals.remaining < 0n
          ? { value: 100, tone: 'error' as const }
          : {
              value: inspectedMicro > 0n ? Number((totals.sum * 10000n) / inspectedMicro) / 100 : 0,
              tone: 'warning' as const,
            };
  const sumText = totals.kind === 'counted' ? formatMicro(totals.sum) : unknownValue;
  const inspectedText = withUom(String(inspectedQty), uomCode);
  const statusText: ReactNode = isOver ? (
    t.overBy(overText)
  ) : (
    <>
      <span className="oqc-inspection-progress-label">{t.remaining} </span>
      {totals.kind === 'counted' ? withUom(formatMicro(totals.remaining), uomCode) : unknownValue}
    </>
  );

  const field = (key: keyof QuantityDraft, label: string, invalid: boolean): ReactElement => (
    /* 단위 코드는 칸 바로 옆 글자로 — 입력값 자체에는 넣지 않는다. 모르면 붙이지 않는다(#136). */
    <div className="oqc-inspection-qty-field">
      <TextField
        label={label}
        inputMode="decimal"
        value={draft[key]}
        disabled={isLocked || isSaving}
        /*
         * ⭐ **묶음에 한 번 낸 사유를 세 칸이 «가리킨다».** 디자인 시스템의 `disabledReason` 은
         * 사유를 보이면서 `aria-describedby` 로도 이어 주는데, 같은 문장을 세 번 내지 않으려고
         * 접으면서 그 연결이 함께 사라졌다 — 보이는 문장과 접근 이름 중 하나를 고를 필요가 없다.
         */
        aria-describedby={isLocked ? lockNoteId : undefined}
        /* 서버가 짚어 준 것을 먼저 낸다 — 그쪽이 이 값에 대해 더 아는 쪽이다. */
        error={serverErrorOf(key) ?? (showErrors && invalid ? t.quantityInvalid : undefined)}
        onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
      />
      {uomCode !== null && <span className="oqc-inspection-qty-unit">{uomCode}</span>}
    </div>
  );

  /*
   * ⛔ **실패해도 창을 닫지 않는다.** 배너를 창 안에 내고 같은 창에서 다시 누르게 한다 —
   * 그래야 같은 멱등 키가 나가 서버가 두 번째 쓰기로 보지 않는다.
   */
  const banner = <SaveErrorBanner error={saveError} onReload={onReload} />;

  return (
    <form aria-label={t.heading} onSubmit={submit}>
      {/*
       * 위에서 아래로 한 줄기 — 검사 수량 → 판정 → 검사한 시리얼, 그 아래 저장 줄(omf-all-around#136 · IQC #133 과 같다).
       * 저장 줄은 창을 내려도 화면 아래에 붙어 있다.
       */}
      <div className="oqc-inspection-work">
        {/* ── 검사 수량 — 검사수량을 합격·불합격·보류로 나눈 결과와 그 입력 현황 ── */}
        <section className="oqc-inspection-section">
          <div className="oqc-inspection-section-head">
            <h3>{t.sectionTitle}</h3>
            {/* 회차 상태 — 회차가 아직 없으면 아무것도 보이지 않는다(막힌 이유는 저장 단추 옆이 말한다). */}
            {isReinspecting ? (
              <p className="field-note">{t.reinspectRound}</p>
            ) : round !== null ? (
              <p className="field-note">{t.round(round.inspectionRound)}</p>
            ) : null}
            {/* 기준값(검사수량)은 제목 줄 오른쪽 끝에 — 세 칸은 이 값을 나눈 결과다. */}
            <dl className="oqc-inspection-qty-base">
              <dt className="oqc-inspection-progress-label">{t.fields.inspectedQty}</dt>
              <dd>{inspectedText}</dd>
            </dl>
          </div>

          {/*
           * ⛔ **사유 칸을 지어내지 않는다.** 계약이 재검사 사유를 선택으로 받지만 대응 코드 그룹이
           * 어디에도 없다. 감추지 않고 왜 없는지 밝힌다(공유계약 G-2).
           */}
          {isReinspecting && (
            <>
              <p className="field-note">{t.reinspectNote}</p>
              <p className="field-note">{t.reinspectReasonPending}</p>
            </>
          )}

          <div className="oqc-inspection-qty" data-over={isOver ? '' : undefined}>
            {field('accepted', t.fields.accepted, errors.accepted)}
            {field('rejected', t.fields.rejected, errors.rejected)}
            {field('held', t.fields.held, errors.held)}
          </div>

          {/*
           * 잠긴 이유를 **묶음에 한 번** 낸다.
           *
           * ⛔ 칸마다 `disabledReason` 을 달면 같은 문장이 세 번 연달아 선다 — 세 칸이 «각각 다른»
           * 이유로 잠긴 것처럼 읽힌다. 잠긴 것은 칸 하나가 아니라 이 회차라 이유도 묶음의 것이다.
           */}
          {isLocked && (
            <p className="field-note" id={lockNoteId}>
              {isConfirmed ? t.confirmed : t.draftElsewhere}
            </p>
          )}

          {/* 입력 현황 — 「입력 완료 / 검사수량」 · 미입력 · 막대. 계산은 그대로다. 셀 수 없을 때 0으로 읽은 합을 보이지 않는다. */}
          <div
            className="oqc-inspection-progress"
            data-state={
              isOver ? 'over' : totals.kind === 'counted' && totals.matches ? 'done' : undefined
            }
          >
            <div className="oqc-inspection-progress-row">
              <span className="oqc-inspection-progress-sum">
                <span className="oqc-inspection-progress-label">{t.sum} </span>
                {totals.kind === 'counted' ? `${sumText} / ${inspectedText}` : sumText}
              </span>
              <span className="oqc-inspection-progress-status">{statusText}</span>
            </div>
            <Progress
              value={progress.value}
              tone={progress.tone}
              label={t.progressLabel}
              valueText={`${sumText} / ${inspectedText}`}
            />
            {totalsNote !== null && <p className="field-note">{totalsNote}</p>}
          </div>
        </section>

        {/* ── 판정 — 종합 판정을 고르고, 자동 판정과 다르면 사유를 받는다 ── */}
        <section className="oqc-inspection-section">
          <h3>{t.judgmentSectionTitle}</h3>

          {/*
           * 종합 판정 — ⛔ **값 목록을 화면에 고정하지 않는다.** 공통코드 조회로 채우고, 목록이
           * 비어도 **감추지 않고 사유를 밝힌다**(공유계약 G-2).
           * 고른 판정을 테두리 색으로 바로 알아보게 한다(합격 초록 · 불합격 빨강 · 보류 주황 — app.css `[data-judgment]`).
           */}
          <div
            className="field-cell oqc-inspection-judgment-field"
            data-judgment={judgment === '' ? undefined : judgment}
          >
            <FieldLabel
              htmlFor={judgmentId}
              label={t.judgment}
              required
              /* 합격판정개수 기준과 자동 판정(omf-all-around#126) — 기준에 합격판정개수가 있고 열린 회차일 때만 라벨 옆 한 줄로. */
              hint={
                acceptanceNumber !== null && !isLocked
                  ? `${t.judgmentChange.basis(acceptanceNumber)}${
                      expectedJudgmentLabel === null
                        ? ''
                        : ` · ${t.judgmentChange.expected(expectedJudgmentLabel)}`
                    }`
                  : undefined
              }
            />
            <Select
              id={judgmentId}
              options={judgmentOptions}
              value={judgment}
              placeholder={t.judgmentPlaceholder}
              disabled={isLocked || isSaving || judgmentOptions.length === 0}
              onChange={onJudgmentChange}
            />
            {judgmentOptions.length === 0 && <p className="field-note">{t.judgmentUnavailable}</p>}
            {/*
             * ⚠ 저장된 판정이 목록에서 사라졌다(사용 중지된 코드일 수 있다). 조용히 비우면
             * 사용자가 고르지 않았는데 고른 것이 지워진다 — 그 사실을 밝힌다.
             */}
            {!isKnownCode(judgmentOptions, judgment) && (
              <p className="field-note">{t.judgmentUnknown(judgment)}</p>
            )}
          </div>

          {/* 판정 변경 사유(omf-all-around#126) — 최종 판정 바로 아래, 자동 판정과 다르게 고를 때만. */}
          {acceptanceNumber !== null && !isLocked && (
            <JudgmentChange
              needsReason={needsChangeReason}
              reason={changeReason}
              onReasonChange={onChangeReasonChange}
              disabled={isSaving}
            />
          )}

          {/* 불합격 사유(선택 · #136) — 불합격을 골랐을 때만. 비워도 저장된다. */}
          {!isLocked && judgment === 'REJECTED' && onRejectionReasonChange !== undefined && (
            <TextArea
              label={t.rejectionReason}
              placeholder={t.rejectionReasonPlaceholder}
              rows={2}
              fullWidth
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(event.target.value)}
              disabled={isSaving}
            />
          )}

          {/*
           * ⛔ **되돌릴 수 없는 쓰기가 무엇을 하는지 누르기 «전»에 보인다.** 확인 창에도 같은 본문이
           * 다시 서지만, 창을 열기 전에 이미 보고 판단할 수 있어야 한다.
           */}
          {!isLocked && (
            <JudgmentGuide
              preview={preview}
              hasLot={hasLot}
              judgment={judgment}
              judgmentLabel={labelOfCode(judgmentOptions, judgment)}
            />
          )}
        </section>

        {/* ── 검사한 시리얼(omf-all-around#68) — 출하작업지시 의뢰의 열린 회차에서만 ── */}
        {!isLocked && serialSection !== undefined && (
          <div className="oqc-inspection-section">{serialSection}</div>
        )}
      </div>

      {/* 창이 열려 있는 동안에는 배너를 창 안에서 낸다 — 밖에 내면 창에 가려 보이지 않는다. */}
      {openedAt === null && banner}

      {/*
       * 저장 줄 — 왼쪽 검사성적서 발행(비활성), 가운데 지금 상황의 안내(저장 결과 · 막힌 까닭 · 되돌릴 수 없다는 경고),
       * 오른쪽 끝 단추(IQC #133 과 같은 배치 · #136).
       */}
      <div className="oqc-inspection-action-area">
        <div className="oqc-inspection-action-row">
          {/*
           * 검사성적서 발행 — ⚠ **자리를 두되 비활성으로 시작한다.** 감추면 이 화면에 그 갈래가 «없는 것»이 된다
           * (공유계약 G-10·G-23). 「아직 열리지 않았다」는 늘 같은 말이라 단추의 설명(마우스를 올리면 보이는 글 · 화면 읽기)으로 둔다.
           */}
          <Button
            type="button"
            variant="outlined"
            size="md"
            disabled
            title={t.coaPending}
            aria-describedby={coaNoteId}
          >
            {t.coaIssue}
          </Button>
          <span id={coaNoteId} className="oqc-inspection-visually-hidden">
            {t.coaPending}
          </span>

          <div className="oqc-inspection-action-notes">
            {/*
             * ⛔ **되돌릴 수 없는 쓰기가 끝난 것을 말한다.** 아무 말이 없으면 사용자는 LOT 상태를
             * 전이시키고도 그것이 됐는지 확인할 문장을 못 찾아 한 번 더 누를 자리를 찾는다.
             */}
            {isJustSaved && <p className="field-note">{t.saved}</p>}
            {!isLocked && showErrors && hasQuantityError(errors) && (
              <p className="field-note">{t.saveBlockedByInvalid}</p>
            )}
            {/*
             * 막혔으면 «무엇이» 막혔는지 단추 바로 왼쪽 한 줄로 밝힌다(공유계약 G-23) — 잠긴 단추만 두지 않는다.
             * 확정된 회차에서도 낸다 — 사유가 재검사 단추를 가리키므로 그 자리에서 할 일이 이어진다.
             */}
            {saveBlockedReason !== null && (
              <p id={blockedNoteId} className="oqc-inspection-action-note" data-tone="info">
                <Icon name="info" size={18} aria-hidden />
                {saveBlockedReason}
              </p>
            )}
            {/* 저장이 곧 확정이다 — 누르기 전에 되돌릴 수 없다는 사실을 경고색 한 줄로. 막힌 동안에는 막힌 까닭 하나만. */}
            {!isLocked && saveBlockedReason === null && (
              <p className="oqc-inspection-action-note" data-tone="warning">
                <Icon name="warning" size={18} aria-hidden />
                {t.saveNote}
              </p>
            )}
          </div>

          <div className="oqc-inspection-action-buttons">
            {/*
             * ⛔ **확정된 회차에는 저장 자리를 만들지 않는다**(공유계약 G-23). 거기서 유일하게 할 수 있는 일이
             * 재검사다 — 잠긴 사유만 내고 길을 내지 않으면 쌓을 자리가 화면에 없다.
             */}
            {isLocked ? (
              <Button type="button" variant="outlined" size="md" onClick={onStartReinspection}>
                {t.reinspect}
              </Button>
            ) : (
              <>
                {/* 그만두는 길을 함께 둔다 — 열고 나서 되돌아갈 데가 없으면 갇힌다. */}
                {isReinspecting && (
                  <Button
                    type="button"
                    variant="text"
                    size="md"
                    disabled={isSaving}
                    onClick={onCancelReinspection}
                  >
                    {t.reinspectCancel}
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="filled"
                  size="md"
                  disabled={saveBlockedReason !== null || isSaving}
                  /* 막힌 까닭을 단추가 가리킨다 — 비활성 주 동작에 사유를 잇는다(C-4). */
                  aria-describedby={saveBlockedReason === null ? undefined : blockedNoteId}
                >
                  {isSaving ? t.saving : t.save}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {openedAt !== null && (
        <ConfirmDialog
          inspectionRequestNo={inspectionRequestNo}
          judgmentLabel={labelOfCode(judgmentOptions, judgment)}
          preview={preview}
          hasLot={hasLot}
          banner={banner}
          isSaving={isSaving}
          onClose={() => {
            setOpenedAt(null);
          }}
          onConfirm={() => {
            onSave(openedAt);
          }}
        />
      )}
    </form>
  );
};
