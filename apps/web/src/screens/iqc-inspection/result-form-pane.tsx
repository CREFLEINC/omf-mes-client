import { AlertBanner, Button, Progress, Select, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type FormEvent, type ReactElement } from 'react';

import { SaveErrorBanner } from '../../patterns/master';

import { isKnownCode, type CodeOption } from './code-options';
import { FieldLabel } from './field-label';

import {
  canConfirm,
  formatMicro,
  fromServerQty,
  hasQuantityError,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';
import type { InspectionResultRound } from './types';
import { withUom } from './uom-lookup';

/**
 * 수량 판정 구획 — **합계 제약이 이 구획을 지배한다.**
 *
 * ```
 * 합격 + 불합격 + 보류 = 검사수량
 * ```
 *
 * 세 칸을 손으로 넣고 합계·잔여를 실시간으로 보인다. ⛔ **자동 계산을 만들지 않는다** —
 * 어느 칸을 자동으로 채울지가 아직 정해지지 않았다(스펙 §8-4). 편의를 먼저 얹으면 규칙이
 * 정해질 때 사용자가 이미 익힌 동작을 뒤집어야 한다.
 *
 * ⛔ **확정된 회차는 고칠 수 있는 것처럼 보이지 않게 한다.** 이전 회차는 정정하지 않고
 * 재검사로 새 회차를 쌓는다(§5-3). 잠근 이유를 사유로 함께 밝힌다.
 *
 * ⛔ **검사자·단말을 보내지 않는다.** 계약에서 사라졌다 — 검사자는 로그인한 주체에서 서버가
 * 정하는 값이라 화면이 만들 수 없고, 세션 값을 실으면 품질 감사 기록에 엉뚱한 사람이 남는다
 * (omf-mes#173). 단말도 같다.
 *
 * ⭐ **합계가 맞지 않아도 저장된다.** 임시 저장은 판정을 확정하는 것이 아니라 하던 일을 남기는
 * 것이고, 계약도 「작성중」에는 합계 제약을 걸지 않는다(스펙 §6). **막는 것은 수량이 아닌 값이
 * 남아 있을 때뿐이다** — 보낼 수 없는 값이라서지 합계 때문이 아니다.
 *
 * ⛔ **오류를 타이핑마다 보이지 않는다.** 「0.5」를 치는 정상 경로가 `0` → `0.` → `0.5` 라,
 * 가운데 한 글자 동안 「수량이 아니다」가 뜨면 맞게 치는 사람에게 틀렸다고 말하는 셈이다.
 * 조건 줄(`queue-filter-bar.tsx`)과 같은 규율로 **저장을 누른 뒤부터** 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.result;
const unknownValue = messages.iqcInspection.queue.emptyValue;

export interface ResultFormPaneProps {
  /** 편집할 회차. 아직 아무도 손대지 않은 의뢰면 `null` */
  round: InspectionResultRound | null;
  /** 검사수량 — 회차가 있으면 그 값, 없으면 의뢰의 입하 등록 수량이다(§4-B 「자동」) */
  inspectedQty: number;
  /** 수량 옆에 붙일 단위 코드(표시 전용). 모르면 `null` — 숫자만 둔다 */
  uomCode: string | null;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
  onSave: () => void;
  isSaving: boolean;
  /** 마지막 저장이 성공했는가. 눌렀는데 아무 일도 없어 보이지 않게 한 줄로 알린다 */
  isSaved: boolean;
  /** 서버가 칸을 짚어 준 오류. 로컬 검증 결과와 합쳐 그 칸에 낸다 */
  fieldErrors: Record<string, string>;
  saveError: ApiError | null;
  /** 충돌일 때 「최신 불러오기」를 낸다. 재조회로 풀리지 않는 오류에는 배너가 내지 않는다 */
  onReload: () => void;

  /** 종합 판정 선택지. **비어 있을 수 있다** — 시드가 아직 안 들어간 상태다 */
  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;
  onConfirm: () => void;
  isConfirming: boolean;
  confirmError: ApiError | null;

  /**
   * 지금 **재검사 회차를 쓰는 중**인가. 참이면 `round` 가 `null` 로 들어와 칸이 열려 있다.
   *
   * ⭐ 회차 번호를 받지 않는다 — **아직 만들어지지 않은 회차**라 번호가 없다. 서버가 저장할
   * 때 +1 하며, 화면이 미리 세면 두 사람이 동시에 열었을 때 같은 번호를 만든다.
   */
  /**
   * **방금** 확정했는가. 확정된 회차라는 «상태»와 다르다 — 상태는 어제 확정된 회차에도
   * 참이라, 그것으로 결과를 알리면 화면에 들어올 때마다 방금 한 일처럼 말한다.
   */
  isJustConfirmed: boolean;
  isReinspecting: boolean;
  /** 확정된 회차에서 재검사를 시작한다. **여는 것뿐이다** — 회차는 저장이 만든다 */
  onStartReinspection: () => void;
  onCancelReinspection: () => void;
}

/** 계약이 짚어 줄 수 있는 칸 이름 ↔ 화면의 초안 칸. */
const FIELD_OF: Record<string, keyof QuantityDraft> = {
  acceptedQty: 'accepted',
  rejectedQty: 'rejected',
  heldQty: 'held',
};

export const ResultFormPane = ({
  round,
  inspectedQty,
  uomCode,
  draft,
  onChange,
  onSave,
  isSaving,
  isSaved,
  fieldErrors,
  saveError,
  onReload,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  onConfirm,
  isConfirming,
  confirmError,
  isJustConfirmed,
  isReinspecting,
  onStartReinspection,
  onCancelReinspection,
}: ResultFormPaneProps) => {
  const judgmentId = useId();
  const isConfirmed = round?.statusCode === 'CONFIRMED';
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const [showErrors, setShowErrors] = useState(false);

  /**
   * 저장. **합계가 맞지 않아도 보낸다** — 막는 것은 보낼 수 없는 값이 남아 있을 때뿐이다.
   */
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setShowErrors(true);

    if (hasQuantityError(errors)) return;

    onSave();
  };

  /**
   * 확정이 막혔다면 **무엇이** 막혔는지. 풀렸으면 `null`.
   *
   * ⛔ 세 갈래를 뭉개지 않는다 — 푸는 방법이 다르다. 합계는 수량을 고쳐야 하고, 판정은
   * 골라야 하며, 확정된 회차는 재검사로 새 회차를 쌓아야 한다(스펙 §6 · §5-3).
   */
  const confirmBlockedReason: string | null = isConfirmed
    ? t.confirmBlockedByConfirmed
    : /*
       * ⛔ **회차가 없으면 확정할 것이 없다.** 확정은 회차 하나를 경로로 지목하는 쓰기라,
       * 아직 만들어지지 않은 회차를 지목하면 치환되지 않은 «주소 틀» 이 그대로 나간다.
       * 그러면 사용자는 화면에서 가장 중요한 단추를 눌렀는데 알 수 없는 오류만 받는다 —
       * 실제로 할 일은 먼저 임시 저장을 하는 것이고 그것을 사유가 말한다.
       */
      round === null
      ? t.confirmBlockedByUnsaved
      : !canConfirm(totals)
        ? t.confirmBlockedByTotals
        : judgment === ''
          ? t.confirmBlockedByJudgment
          : null;

  /** 서버가 짚어 준 칸 오류를 화면의 칸 이름으로 옮긴다. */
  const serverErrorOf = (key: keyof QuantityDraft): string | undefined => {
    const entry = Object.entries(FIELD_OF).find(([, local]) => local === key);

    return entry === undefined ? undefined : fieldErrors[entry[0]];
  };

  /**
   * 입력 현황 줄 아래 한 문장 — 맞으면 일치, 넘기면 넘긴 양을 숫자로 말한다. 모자랄 때는 바로 위
   * 「잔여」와 막대가 이미 보이므로 문장을 두지 않는다.
   *
   * ⛔ **셀 수 없으면 아무 말도 하지 않는다.** 한 칸이라도 수량이 아니면 합계는 알 수 없는
   * 것이고, 그때 「일치합니다」든 「남아 있습니다」든 내면 **거짓을 말하는 것**이다. 무엇을
   * 고쳐야 하는지는 그 칸의 오류가 이미 말한다.
   */
  const totalsNote =
    totals.kind === 'uncountable'
      ? null
      : totals.matches
        ? t.matched
        : totals.remaining > 0n
          ? null
          : t.over(withUom(formatMicro(-totals.remaining), uomCode));

  /**
   * 진행 막대 — **보이기 위한 값일 뿐이다**(합계·잔여 계산은 위 `toTotals` 그대로).
   * 셀 수 없으면 비우고, 넘기면 가득 채워 경고색, 맞으면 성공색, 모자라면 기본색이다.
   */
  const inspectedMicro = fromServerQty(inspectedQty);
  const progress =
    totals.kind === 'uncountable'
      ? { value: 0, tone: 'idle' as const }
      : totals.matches
        ? { value: 100, tone: 'success' as const }
        : totals.remaining < 0n
          ? { value: 100, tone: 'warning' as const }
          : {
              value: inspectedMicro > 0n ? Number((totals.sum * 10000n) / inspectedMicro) / 100 : 0,
              tone: 'primary' as const,
            };
  const sumText = totals.kind === 'counted' ? formatMicro(totals.sum) : unknownValue;
  const inspectedText = withUom(String(inspectedQty), uomCode);
  const remainingText =
    totals.kind === 'counted' ? withUom(formatMicro(totals.remaining), uomCode) : unknownValue;

  const field = (key: keyof QuantityDraft, label: string, invalid: boolean): ReactElement => (
    /* 단위 코드는 칸 바로 옆 글자로 — 입력값 자체에는 넣지 않는다. 모르면 붙이지 않는다. */
    <div className="iqc-inspection-qty-field">
      <TextField
        label={label}
        inputMode="decimal"
        /* 「0」은 흐린 안내 글자일 뿐 값이 아니다 — 빈 칸은 저장 때 0 으로 보내던 그대로다. */
        placeholder="0"
        value={draft[key]}
        disabled={isConfirmed || isSaving}
        /* 서버가 짚어 준 것을 먼저 낸다 — 그쪽이 이 값에 대해 더 아는 쪽이다. */
        error={serverErrorOf(key) ?? (showErrors && invalid ? t.quantityInvalid : undefined)}
        onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
      />
      {uomCode !== null && <span className="iqc-inspection-qty-unit">{uomCode}</span>}
    </div>
  );

  return (
    <form aria-label={t.heading} onSubmit={submit}>
      {/* ── 검사 결과 수량 — 검사수량을 합격·불합격·보류로 나눈 결과와 그 입력 현황 ── */}
      <section className="iqc-inspection-section">
        <div className="iqc-inspection-section-head">
          <h3>{t.sectionTitle}</h3>
          {/* 회차 상태 — 회차가 아직 없으면 아무것도 보이지 않는다(막힌 이유는 판정 단추 아래가 말한다). */}
          {isReinspecting ? (
            <p className="field-note">{t.reinspectRound}</p>
          ) : round !== null ? (
            <p className="field-note">{t.round(round.inspectionRound)}</p>
          ) : null}
        </div>

        {/*
         * ⭐ **저장해야 회차가 생긴다.** 「검사 시작」 액션을 두지 않고 첫 임시 저장을 검사
         * 시작으로 삼은 규율과 같다(omf-mes 확정 2026-08-21 §1.2) — 열어 두고 떠난 사람이
         * 빈 회차를 남기지 않는다.
         *
         * ⛔ **사유 칸을 지어내지 않는다.** 계약이 재검사 사유를 선택으로 받지만 고를 값
         * 목록이 정해지지 않았다. 감추지 않고 왜 없는지 밝힌다(omf-mes#179).
         */}
        {isReinspecting && (
          <>
            <p className="field-note">{t.reinspectNote}</p>
            <p className="field-note">{t.reinspectReasonPending}</p>
          </>
        )}

        {/* 기준값(검사수량)은 입력 줄 밖에 따로 — 세 칸은 이 값을 나눈 결과다. */}
        <dl className="iqc-inspection-qty-base">
          <dt className="field-label">{t.fields.inspectedQty}</dt>
          <dd>{inspectedText}</dd>
        </dl>

        <div className="iqc-inspection-qty">
          {field('accepted', t.fields.accepted, errors.accepted)}
          {field('rejected', t.fields.rejected, errors.rejected)}
          {field('held', t.fields.held, errors.held)}
        </div>

        {/* 잠근 이유는 세 칸마다 되풀이하지 않고 수량 줄 아래 한 번만 밝힌다. */}
        {isConfirmed && <p className="field-note">{t.confirmed}</p>}

        {/* 입력 현황 — 「합계 / 검사수량」 · 잔여 · 막대 · 한 줄 안내. 계산은 그대로다. */}
        <div className="iqc-inspection-progress">
          <span className="field-label">{t.progressTitle}</span>
          <div className="iqc-inspection-progress-row">
            <span className="iqc-inspection-progress-sum">
              <span className="iqc-inspection-visually-hidden">{t.sum} </span>
              {totals.kind === 'counted' ? `${sumText} / ${inspectedText}` : sumText}
            </span>
            <span>
              {t.remaining} {remainingText}
            </span>
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

      {/* ── 판정 — 종합 판정을 고르고, 임시 저장 뒤 확정한다 ── */}
      <section className="iqc-inspection-section">
        <h3>{t.judgmentSectionTitle}</h3>

        {/*
         * 종합 판정 — ⛔ **값 목록을 화면에 고정하지 않는다.** 공통코드 조회로 채우고,
         * 목록이 비어도 **감추지 않고 사유를 밝힌다**(공유계약 G-2). 시드가 아직 안 들어가
         * 빌 수 있는데, 감추면 그 자리가 왜 없는지 사용자가 알 수 없다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={judgmentId} label={t.judgment} required />
          <Select
            id={judgmentId}
            options={judgmentOptions}
            value={judgment}
            placeholder={t.judgmentPlaceholder}
            disabled={isConfirmed || judgmentOptions.length === 0}
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

        <SaveErrorBanner error={saveError ?? confirmError} onReload={onReload} />

        {/*
         * ⛔ **되돌릴 수 없는 쓰기가 끝난 것을 말한다.** 확정 여부와 무관하게 쓰기가 성공한
         * «그 순간» 낸다 — 확정 상태는 회차를 다시 부른 «뒤에» 참이 된다.
         */}
        {isJustConfirmed && <p className="field-note">{t.confirmSucceeded}</p>}

        {/*
         * 종합 판정 아래 — 왼쪽 좁은 칸(부분 입고)과 오른쪽 넓은 칸(저장 및 확정), 가운데 얇은 세로
         * 구분선. 좁은 폭에서는 위(부분 입고)·아래(저장 및 확정)로 쌓인다.
         * ⛔ 확정된 회차에서 유일하게 할 수 있는 일이 재검사다 — 저장 자리·부분 입고를 두지 않는다(G-23).
         */}
        <div className="iqc-inspection-action-area">
          <div className="iqc-inspection-action-grid">
            {/*
             * 부분 입고 허용 — ⚠ **자리를 두되 비활성으로 시작한다**(스펙 §8 #2). 기능(단추)과
             * 상태 안내를 붙여 둔다.
             */}
            {!isConfirmed && (
              <div className="iqc-inspection-partial">
                <span className="field-label">{t.partialTitle}</span>
                <div className="iqc-inspection-partial-row">
                  <Button type="button" variant="outlined" size="md" disabled>
                    {t.partialReceipt}
                  </Button>
                  <p className="field-note">{t.partialReceiptPending}</p>
                </div>
              </div>
            )}

            <div className="iqc-inspection-submit">
              <span className="field-label">{t.submitTitle}</span>
              {isConfirmed ? (
                <div className="form-actions">
                  <Button type="button" variant="outlined" size="md" onClick={onStartReinspection}>
                    {t.reinspect}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="form-actions">
                    {/* 그만두는 길을 함께 둔다 — 열고 나서 되돌아갈 데가 없으면 갇힌다. */}
                    {isReinspecting && (
                      <Button
                        type="button"
                        variant="text"
                        size="md"
                        disabled={isSaving || isConfirming}
                        onClick={onCancelReinspection}
                      >
                        {t.reinspectCancel}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant="outlined"
                      size="md"
                      disabled={isSaving || isConfirming}
                    >
                      {isSaving ? t.saving : t.save}
                    </Button>
                    <Button
                      type="button"
                      variant="filled"
                      size="md"
                      disabled={confirmBlockedReason !== null || isSaving || isConfirming}
                      onClick={onConfirm}
                    >
                      {isConfirming ? t.confirming : t.confirm}
                    </Button>
                    {/* 눌렀는데 아무 일도 없어 보이지 않게 결과를 한 줄로 알린다. */}
                    {isSaved && <p className="field-note">{t.saved}</p>}
                    {showErrors && hasQuantityError(errors) && (
                      <p className="field-note">{t.saveBlockedByInvalid}</p>
                    )}
                  </div>
                  {/* 막혔으면 «무엇이» 막혔는지 단추 바로 아래 정보 띠로 밝힌다(공유계약 G-23). */}
                  {confirmBlockedReason !== null && (
                    <AlertBanner className="iqc-inspection-submit-banner" variant="info">
                      {confirmBlockedReason}
                    </AlertBanner>
                  )}
                  {/*
                   * ⛔ **확정은 되돌릴 수 없다** — 누르기 전에 그 사실을 알린다. 이 순간 LOT 상태가
                   * 전이하고 보류 해제가 기록된다. 흐린 보조 글이 아니라 DS 경고 띠로 둔다.
                   */}
                  <AlertBanner className="iqc-inspection-submit-banner" variant="warning">
                    {t.confirmNote}
                  </AlertBanner>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </form>
  );
};
