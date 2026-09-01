import { Radio, RadioGroup, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactElement } from 'react';

import { isKnownCode, type CodeOption } from './code-options';
import { isCoverageOutOfOrder, type CoverageDraft } from './coverage';
import { canChooseDisposition, type DispositionState } from './disposition';
import {
  formatMicro,
  toMicro,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';

/**
 * 우측 《결과 입력》 구획 — 화면 스펙 §3 의 오른쪽 544 다.
 *
 * ⭐ **합계 제약이 이 구획을 지배한다.**
 *
 * ```
 * 합격 + 불합격 + 보류 = 검사수량
 * ```
 *
 * 세 칸을 손으로 넣고 합계·잔여를 실시간으로 보인다. ⛔ **자동 계산을 만들지 않는다** —
 * 어느 칸을 자동으로 채울지가 아직 정해지지 않았고, **보류가 있어 2칸이 남아** 성립하지 않는다.
 *
 * ⛔ **액션 버튼을 여기 두지 않는다.** 스펙 §3 은 액션바를 화면 아래 고정 88 로 두었다 —
 * 터치 단말에서 손이 닿는 자리가 정해져 있어야 하고, 스크롤하다 놓치면 저장 자리를 찾아 헤맨다.
 *
 * ⛔ **검사자·단말을 보내지 않는다.** 검사자는 사번 귀속 헤더에서 서버가 풀고, 단말은 요청을
 * 인증한 것이 단말이라 서버가 이미 안다 — 화면이 세션 값을 실으면 감사 기록에 엉뚱한 사람이 남는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.result;
const tCoverage = messages.pqcInspection.coverage;
const tDisposition = messages.pqcInspection.disposition;
const unknownValue = messages.pqcInspection.emptyValue;

export interface ResultPanelProps {
  /**
   * 검사 수량 — **사람이 넣는 칸이다**(§3 도면 `검사 수량 [ 30 ] EA` · §4-B `inspected_qty`).
   * ⛔ 읽기 전용으로 두지 않는다: 표본 검사라 대상 수량과 실제 검사 수량이 다를 수 있다.
   */
  inspectedDraft: string;
  onInspectedChange: (raw: string) => void;
  /** 합계 판정의 오른쪽 변. 초안이 수량이 아니면 판정이 서지 않는다 */
  inspectedQty: number;

  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
  /** 서버가 칸을 짚어 준 오류. 로컬 검증 결과와 합쳐 그 칸에 낸다 */
  fieldErrors: Record<string, string>;
  /** 저장을 누른 뒤부터 로컬 오류를 보인다 — 「0.5」를 치는 도중 「0.」에서 틀렸다고 하지 않는다 */
  showErrors: boolean;

  coverage: CoverageDraft;
  onCoverageChange: (coverage: CoverageDraft) => void;

  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;

  disposition: DispositionState;
  onDispositionChange: (choice: DispositionState) => void;
}

/** 계약이 짚어 줄 수 있는 칸 이름 ↔ 화면의 초안 칸. */
const FIELD_OF: Record<string, keyof QuantityDraft> = {
  acceptedQty: 'accepted',
  rejectedQty: 'rejected',
  heldQty: 'held',
};

/**
 * 불합격 칸이 지금 얼마인가. **수량이 아니면 `null` 이다** — 0이 아니라 «모른다»이고,
 * 그 둘을 뭉개면 쓰레기 입력에서 처분 칸이 열린다.
 */
const rejectedMicro = (raw: string): bigint | null => (raw.trim() === '' ? 0n : toMicro(raw));

/**
 * 라디오가 준 문자열을 처분 값으로 옮긴다. ⛔ **모르는 값을 처분으로 삼지 않는다.**
 */
const toDisposition = (value: string): DispositionState =>
  value === 'REWORK' || value === 'SCRAP' ? value : null;

export const ResultPanel = ({
  inspectedDraft,
  onInspectedChange,
  inspectedQty,
  draft,
  onChange,
  fieldErrors,
  showErrors,
  coverage,
  onCoverageChange,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  disposition,
  onDispositionChange,
}: ResultPanelProps) => {
  const judgmentId = useId();
  const dispositionName = useId();
  const dispositionLabelId = useId();
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  /* 검사 수량도 수량이다 — 같은 자로 잰다. 빈 칸은 아직 넣지 않은 것이지 잘못이 아니다. */
  const inspectedInvalid = inspectedDraft.trim() !== '' && toMicro(inspectedDraft) === null;
  const canChoose = canChooseDisposition(rejectedMicro(draft.rejected));

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
   * 것이고, 그때 「일치합니다」든 「모자랍니다」든 내면 **거짓을 말하는 것**이다.
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
      disabled={false}

      /* 서버가 짚어 준 것을 먼저 낸다 — 그쪽이 이 값에 대해 더 아는 쪽이다. */
      error={serverErrorOf(key) ?? (showErrors && invalid ? t.quantityInvalid : undefined)}
      onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
    />
  );

  return (
    <section className="pane" aria-label={t.heading}>
      <h2 className="field-label">{t.heading}</h2>

      {/*
       * 적용 생산구간 — 이 검사가 «어느 시간대의 생산분»을 대표하는가(§5-5). 불합격일 때
       * 회수 범위가 이 구간으로 정해지므로, 자동으로 채우되 **사람이 고칠 수 있게** 둔다.
       */}
      <div className="form-grid">
        <TextField
          label={tCoverage.from}
          value={coverage.from}
          disabled={false}

          onChange={(event) => onCoverageChange({ ...coverage, from: event.target.value })}
        />
        <TextField
          label={tCoverage.to}
          value={coverage.to}
          disabled={false}

          /* ⛔ 조용히 뒤집어 고치지 않는다 — 무엇을 넣었는지 사용자가 알아야 고칠 수 있다. */
          error={isCoverageOutOfOrder(coverage) ? tCoverage.invalidOrder : undefined}
          onChange={(event) => onCoverageChange({ ...coverage, to: event.target.value })}
        />
      </div>
      <p className="field-note">{tCoverage.note}</p>

      <div className="form-grid">
        {field('accepted', t.fields.accepted, errors.accepted)}
        {field('rejected', t.fields.rejected, errors.rejected)}
        {field('held', t.fields.held, errors.held)}
      </div>

      {/*
       * 읽기 전용 숫자 셋을 한 줄에 둔다 — 검사수량이 «오른쪽 변»이고 합계·잔여가 그것과
       * 견준 결과라 나란히 있어야 읽힌다. 세로로 쌓으면 예산(E-1 슬랙 0)을 넘긴다.
       */}
      <div className="form-grid">
        <TextField
          label={t.fields.inspectedQty}
          inputMode="decimal"
          value={inspectedDraft}
          disabled={false}

          error={showErrors && inspectedInvalid ? t.quantityInvalid : undefined}
          onChange={(event) => onInspectedChange(event.target.value)}
        />
      </div>

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
       * 종합 판정 — ⛔ **값 목록을 화면에 고정하지 않는다.** 공통코드 조회로 채우고, 목록이
       * 비어도 **감추지 않고 사유를 밝힌다** — 시드가 아직 안 들어가 빌 수 있는데, 감추면
       * 그 자리가 왜 없는지 사용자가 알 수 없다.
       */}
      {/*
       * ⭐ **판정과 처분을 한 줄로 묶는다.** 스펙 §3 의 세로 예산은 슬랙 0 이고(E-1), 둘을
       * 세로로 쌓으면 우측 구획이 예산을 넘겨 처분이 화면 밖으로 밀린다 — 실측으로 확인했다.
       * 둘은 「불합격이면 어떻게 할 것인가」로 이어지는 짝이라 나란히 두는 것이 읽기에도 맞다.
       */}
      <div className="form-grid">
        <div className="field-cell">
          <label className="field-label" htmlFor={judgmentId}>
            {t.judgment}
          </label>
          <Select
            id={judgmentId}
            options={judgmentOptions}
            value={judgment}
            placeholder={t.judgmentPlaceholder}
            disabled={judgmentOptions.length === 0}
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

        {/*
         * 불합격 처분 — ⚠ **잠정 선택이고 저장되지 않는다**(REQ-PR-0025 · §5-8).
         * ⛔ 자동으로 고르지 않는다 — 재작업/폐기를 가르는 속성이 불량코드에 아직 없다.
         * ⛔ 처분을 안 골랐다고 확정을 막지 않는다 — 확정 판정은 나중이다.
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
          {/* 순서가 뒤집힌다는 사실을 화면이 먼저 말한다 — 안 말하면 고른 값이 확정인 줄 안다. */}
          <p className="field-note">{tDisposition.note}</p>
          {!canChoose && <p className="field-note">{tDisposition.disabledNote}</p>}
        </div>
      </div>
    </section>
  );
};
