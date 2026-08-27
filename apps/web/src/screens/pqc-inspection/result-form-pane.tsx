import { Button, Radio, RadioGroup, Select, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type FormEvent, type ReactElement } from 'react';

import { SaveErrorBanner } from '../../patterns/master';

import { isKnownCode, type CodeOption } from './code-options';
import { isCoverageOutOfOrder, type CoverageDraft } from './coverage';
import { canChooseDisposition, type DispositionState } from './disposition';
import { FieldLabel } from './field-label';

import {
  canConfirm,
  formatMicro,
  hasQuantityError,
  toMicro,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';
import type { InspectionResultRound } from './types';

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

const t = messages.pqcInspection.result;
const tDisposition = messages.pqcInspection.disposition;
const tCoverage = messages.pqcInspection.coverage;
const unknownValue = messages.pqcInspection.queue.emptyValue;

export interface ResultFormPaneProps {
  /** 편집할 회차. 아직 아무도 손대지 않은 의뢰면 `null` */
  round: InspectionResultRound | null;
  /** 검사수량 — 회차가 있으면 그 값, 없으면 의뢰의 입하 등록 수량이다(§4-B 「자동」) */
  inspectedQty: number;
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

  /** 적용 생산구간(§5-5). 검사 시각으로 채워지되 사람이 고칠 수 있다 */
  coverage: CoverageDraft;
  onCoverageChange: (coverage: CoverageDraft) => void;

  /**
   * 불합격 처분 — ⚠ **잠정이다.** 고른 값은 저장되지 않는다(REQ-PR-0025 · `disposition.ts`).
   */
  disposition: DispositionState;
  onDispositionChange: (choice: DispositionState) => void;

  /**
   * 이 단말이 이 공정의 검사를 입력할 수 있는가(`can_input_inspection` · F-1).
   *
   * ⛔ **모를 때는 막지 않는다.** 조회가 아직 안 왔거나 단말을 모르는 상태에서 막으면
   * 권한이 있는 사람이 이유 없이 갇힌다 — 정본은 서버이고 화면의 막음은 편의다.
   */
  canInputInspection: boolean;
  /** 확정된 회차에서 재검사를 시작한다. **여는 것뿐이다** — 회차는 저장이 만든다 */
  onStartReinspection: () => void;
  onCancelReinspection: () => void;
}

/**
 * 불합격 칸이 지금 얼마인가. **수량이 아니면 `null` 이다** — 0이 아니라 «모른다»이고,
 * 그 둘을 뭉개면 쓰레기 입력에서 처분 칸이 열린다.
 */
const rejectedMicro = (raw: string): bigint | null => (raw.trim() === '' ? 0n : toMicro(raw));

/**
 * 라디오가 준 문자열을 처분 값으로 옮긴다.
 *
 * ⛔ **모르는 값을 처분으로 삼지 않는다.** 이 그룹이 내는 값은 둘뿐이지만, 그것을 타입으로
 * 단언해 버리면 나중에 값이 하나 늘 때 화면이 조용히 모르는 값을 들고 다닌다.
 */
const toDisposition = (value: string): DispositionState =>
  value === 'REWORK' || value === 'SCRAP' ? value : null;

/** 계약이 짚어 줄 수 있는 칸 이름 ↔ 화면의 초안 칸. */
const FIELD_OF: Record<string, keyof QuantityDraft> = {
  acceptedQty: 'accepted',
  rejectedQty: 'rejected',
  heldQty: 'held',
};

export const ResultFormPane = ({
  round,
  inspectedQty,
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
  coverage,
  onCoverageChange,
  disposition,
  onDispositionChange,
  canInputInspection,
}: ResultFormPaneProps) => {
  const judgmentId = useId();
  const isConfirmed = round?.statusCode === '확정';
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const [showErrors, setShowErrors] = useState(false);
  const dispositionName = useId();
  const dispositionLabelId = useId();

  /*
   * 처분은 **불합격이 있을 때만** 고른다. 셀 수 없는 상태에서도 열지 않는다 — 화면이
   * 불합격을 «모르는» 것이지 0인 것이 아니다.
   */
  const canChoose = !isConfirmed && canChooseDisposition(rejectedMicro(draft.rejected));

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
  const confirmBlockedReason: string | null = !canInputInspection
    ? /*
       * ⛔ **단말 권한을 가장 먼저 본다.** 뒤에 두면 수량·판정을 다 채운 사람이 마지막에야
       * 「이 단말은 할 수 없다」를 만난다 — 할 수 없는 일을 다 시킨 뒤 막는 셈이다.
       */
      t.confirmBlockedByTerminal
    : isConfirmed
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
   * 합계 상태를 한 문장으로. **모자란 양·넘긴 양을 숫자로 말한다** — 「맞지 않습니다」만
   * 내면 사용자가 세 칸을 다시 더해 봐야 한다.
   *
   * ⛔ **셀 수 없으면 아무 말도 하지 않는다.** 한 칸이라도 수량이 아니면 합계는 알 수 없는
   * 것이고, 그때 「일치합니다」든 「모자랍니다」든 내면 **거짓을 말하는 것**이다. 무엇을
   * 고쳐야 하는지는 그 칸의 오류가 이미 말한다.
   */
  const totalsNote =
    totals.kind === 'uncountable'
      ? null
      : totals.matches
        ? t.matched
        : totals.remaining > 0n
          ? t.short(formatMicro(totals.remaining))
          : t.over(formatMicro(-totals.remaining));

  const field = (key: keyof QuantityDraft, label: string, invalid: boolean): ReactElement => (
    <TextField
      label={label}
      inputMode="decimal"
      value={draft[key]}
      disabled={isConfirmed || isSaving}
      disabledReason={isConfirmed ? t.confirmed : undefined}
      /* 서버가 짚어 준 것을 먼저 낸다 — 그쪽이 이 값에 대해 더 아는 쪽이다. */
      error={serverErrorOf(key) ?? (showErrors && invalid ? t.quantityInvalid : undefined)}
      onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
    />
  );

  return (
    <form aria-label={t.heading} onSubmit={submit}>
      <p className="field-note">
        {isReinspecting
          ? t.reinspectRound
          : round === null
            ? t.notStarted
            : t.round(round.inspectionRound)}
      </p>

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

      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.fields.inspectedQty}</dt>
          <dd>{String(inspectedQty)}</dd>
        </div>
      </dl>

      <div className="form-grid">
        {field('accepted', t.fields.accepted, errors.accepted)}
        {field('rejected', t.fields.rejected, errors.rejected)}
        {field('held', t.fields.held, errors.held)}
      </div>

      {/*
       * 적용 생산구간 — 이 검사가 «어느 시간대의 생산분»을 대표하는가(§5-5). 불합격일 때
       * 회수 범위가 이 구간으로 정해지므로, 자동으로 채우되 **사람이 고칠 수 있게** 둔다.
       */}
      <div className="form-grid">
        <TextField
          label={tCoverage.from}
          value={coverage.from}
          disabled={isConfirmed || isSaving}
          disabledReason={isConfirmed ? t.confirmed : undefined}
          onChange={(event) => onCoverageChange({ ...coverage, from: event.target.value })}
        />
        <TextField
          label={tCoverage.to}
          value={coverage.to}
          disabled={isConfirmed || isSaving}
          disabledReason={isConfirmed ? t.confirmed : undefined}
          /* ⛔ 조용히 뒤집어 고치지 않는다 — 무엇을 넣었는지 사용자가 알아야 고칠 수 있다. */
          error={isCoverageOutOfOrder(coverage) ? tCoverage.invalidOrder : undefined}
          onChange={(event) => onCoverageChange({ ...coverage, to: event.target.value })}
        />
      </div>
      <p className="field-note">{tCoverage.note}</p>

      <dl className="filter-bar">
        {/* 셀 수 없을 때 0으로 읽은 합을 보이면 그 숫자 자체가 거짓이다. 없음 표시를 낸다. */}
        <div className="field-cell">
          <dt className="field-label">{t.sum}</dt>
          <dd>{totals.kind === 'counted' ? formatMicro(totals.sum) : unknownValue}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.remaining}</dt>
          <dd>{totals.kind === 'counted' ? formatMicro(totals.remaining) : unknownValue}</dd>
        </div>
      </dl>

      {totalsNote !== null && <p className="field-note">{totalsNote}</p>}

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
       * ⛔ **확정된 회차에는 저장 자리를 만들지 않는다**(공유계약 G-23 — 누를 수 있는데 아무
       * 일도 없는 컨트롤을 두지 않는다). 이전 회차는 정정하지 않고 재검사로 새 회차를 쌓는다.
       */}
      {/*
       * ⛔ **확정된 회차에서 유일하게 할 수 있는 일이 재검사다.** 잠긴 사유만 내고 길을
       * 내지 않으면, 문면이 「재검사 회차를 추가합니다」라고 말하는데 추가할 자리가 화면에
       * 없다 — 사용자는 그 문장을 읽고 무엇을 눌러야 할지 찾다가 포기한다.
       */}
      {/*
       * ⛔ **되돌릴 수 없는 쓰기가 끝난 것을 말한다.** 저장은 「저장했습니다」를 내는데 확정만
       * 아무 말이 없으면, 사용자는 LOT 상태를 전이시키고도 그것이 됐는지 확인할 문장을 못
       * 찾아 한 번 더 누를 자리를 찾는다.
       *
       * ⭐ **확정된 회차인지와 무관하게 낸다.** 쓰기가 성공한 «그 순간» 말해야 하는데,
       * 확정 여부는 회차를 다시 부른 «뒤에» 참이 된다 — 그것을 기다리면 누른 사람은 아무
       * 일도 없는 몇 초를 본다. 이 값은 상태가 아니라 방금 한 일이다.
       */}
      {isJustConfirmed && <p className="field-note">{t.confirmSucceeded}</p>}

      {isConfirmed && (
        <div className="form-actions">
          <Button type="button" variant="outlined" size="sm" onClick={onStartReinspection}>
            {t.reinspect}
          </Button>
        </div>
      )}

      {!isConfirmed && (
        <>
          <div className="form-actions">
            {/* 눌렀는데 아무 일도 없어 보이지 않게 결과를 한 줄로 알린다. */}
            {isSaved && <p className="field-note form-actions-secondary">{t.saved}</p>}
            {showErrors && hasQuantityError(errors) && (
              <p className="field-note form-actions-secondary">{t.saveBlockedByInvalid}</p>
            )}
            {/* 그만두는 길을 함께 둔다 — 열고 나서 되돌아갈 데가 없으면 갇힌다. */}
            {isReinspecting && (
              <Button
                type="button"
                variant="text"
                size="sm"
                disabled={isSaving || isConfirming}
                onClick={onCancelReinspection}
              >
                {t.reinspectCancel}
              </Button>
            )}
            <Button type="submit" variant="outlined" size="sm" disabled={isSaving || isConfirming}>
              {isSaving ? t.saving : t.save}
            </Button>
            <Button
              type="button"
              variant="filled"
              size="sm"
              disabled={confirmBlockedReason !== null || isSaving || isConfirming}
              onClick={onConfirm}
            >
              {isConfirming ? t.confirming : t.confirm}
            </Button>
          </div>

          {/*
           * ⛔ **확정은 되돌릴 수 없다** — 누르기 전에 그 사실을 알린다. 이 순간 LOT 상태가
           * 전이하고 보류 해제가 기록된다.
           */}
          <p className="field-note">{t.confirmNote}</p>

          {/* 막혔으면 «무엇이» 막혔는지 밝힌다(공유계약 G-23) — 잠긴 단추만 두지 않는다. */}
          {confirmBlockedReason !== null && <p className="field-note">{confirmBlockedReason}</p>}

          {/*
           * 불합격 처분 — ⚠ **잠정 선택이고 저장되지 않는다**(REQ-PR-0025 · 스펙 §5-8).
           *
           * ⛔ 자동으로 고르지 않는다 — 「재작업 가능 / 폐기」를 가르는 속성이 불량코드에
           * 아직 없다. 규칙을 지어내면 설계가 승인한 적 없는 판정이 화면에 굳는다.
           *
           * ⛔ 처분을 안 골랐다고 확정을 막지 않는다(스펙 §6) — 확정 판정은 나중이다.
           */}
          <div className="field-cell">
            <p className="field-label" id={dispositionLabelId}>
              {tDisposition.heading}
            </p>
            <RadioGroup
              name={dispositionName}
              value={disposition ?? ''}
              disabled={!canChoose}
              aria-labelledby={dispositionLabelId}
              onChange={(value) => onDispositionChange(value === '' ? null : toDisposition(value))}
            >
              <Radio value="REWORK">{tDisposition.rework}</Radio>
              <Radio value="SCRAP">{tDisposition.scrap}</Radio>
            </RadioGroup>
            {/* 순서가 뒤집힌다는 사실을 화면이 먼저 말한다 — 안 말하면 확정인 줄 안다. */}
            <p className="field-note">{tDisposition.note}</p>
            {!canChoose && <p className="field-note">{tDisposition.disabledNote}</p>}
          </div>
        </>
      )}
    </form>
  );
};
