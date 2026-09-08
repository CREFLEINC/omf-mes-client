import { Radio, RadioGroup, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useId, useState, type ReactElement, type ReactNode } from 'react';

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

/** 키패드가 고치는 칸. `inspected` 는 검사 수량이고 나머지는 그것을 나눈 셋이다. */
type PadTarget = { key: keyof QuantityDraft | 'inspected'; label: string };

export interface ResultPanelProps {
  /**
   * 검사 수량 — **사람이 넣는 칸이다**(§3 도면 `검사 수량 [ 30 ] EA` · §4-B `inspected_qty`).
   * ⛔ 읽기 전용으로 두지 않는다: 표본 검사라 대상 수량과 실제 검사 수량이 다를 수 있다.
   */
  inspectedDraft: string;
  onInspectedChange: (raw: string) => void;
  /** 합계 판정의 오른쪽 변. 초안이 수량이 아니면 판정이 서지 않는다 */
  inspectedQty: number;
  /**
   * 수량의 단위. **설계가 「화면에 단위 명시 «필수»」로 못박은 자리다**(§8 미결 5 · A-8) —
   * 「30」이 30 개인지 30 % 인지 화면만 보고 알 수 없던 문제에서 나온 규칙이다.
   * 못 받았으면 `null` — 그때는 수량만 낸다(지어내지 않는다).
   */
  uomCode: string | null;

  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
  /** 서버가 칸을 짚어 준 오류. 로컬 검증 결과와 합쳐 그 칸에 낸다 */
  fieldErrors: Record<string, string>;
  /**
   * 칸으로 소화되지 않은 저장 오류. **이 구획 «안»에 세운다** — 머리와 본문 사이에 두면
   * 세로 예산(64 + 616 + 88 = 768 · 슬랙 0)을 넘겨 **액션바가 화면 밖으로 밀린다.**
   * 하필 저장이 실패해 다시 눌러야 하는 순간이라 그 자리가 접히면 안 된다. 이 구획은 이미
   * 흐르므로 여기서는 높이가 늘어도 액션바가 제자리에 남는다.
   */
  errorBanner?: ReactNode;
  /** 저장을 누른 뒤부터 로컬 오류를 보인다 — 「0.5」를 치는 도중 「0.」에서 틀렸다고 하지 않는다 */
  showErrors: boolean;

  coverage: CoverageDraft;
  onCoverageChange: (coverage: CoverageDraft) => void;

  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;

  disposition: DispositionState;
  onDispositionChange: (choice: DispositionState) => void;

  /**
   * 지금 어느 칸을 치는가를 **화면에 알린다** — 숫자 키패드는 이 구획 밖(셋째 칸)에 서고
   * (설계 2차 공지 `a6a87e1` · `omf-mes#286` §3-1), 좌단 측정값과 **패드 하나를 나눠 쓴다.**
   */
  padField: PadTarget | null;
  onPadFieldChange: (target: PadTarget | null) => void;
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
  uomCode,
  draft,
  onChange,
  fieldErrors,
  errorBanner,
  showErrors,
  coverage,
  onCoverageChange,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  padField,
  onPadFieldChange,
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
  /*
   * ⭐ **키패드는 이 구획 밖에 상시로 선다**(설계 2차 공지 `a6a87e1` · `omf-mes#286` §3-1).
   *
   * 전에는 세울 자리가 없어(세로 예산 슬랙 0) 팝업으로 두었는데, 그 판이 **셋째 칸(216)** 을
   * 내면서 자리가 생겼다 — 여기서는 「어느 칸을 고르는가」만 화면에 알린다.
   */
  const setPadField = onPadFieldChange;

  /*
   * 수량에는 **늘 단위를 붙인다** — 칸 안이든 문장 안이든 같다(§8 미결 5 · 공유계약 A-8).
   * 「30 모자랍니다」만으로는 30 개인지 30 % 인지 알 수 없다.
   *
   * ⛔ 단위를 못 받았으면 숫자만 낸다 — 지어낸 단위는 거짓이다.
   */
  const withUnit = (value: string): string => (uomCode === null ? value : `${value} ${uomCode}`);

  const totalsNote =
    totals.kind === 'uncountable'
      ? null
      : totals.matches
        ? t.matched
        : totals.remaining > 0n
          ? t.short(withUnit(formatMicro(totals.remaining)))
          : t.over(withUnit(formatMicro(-totals.remaining)));

  /*
   * 단위는 **칸 «안» 오른쪽 끝**에 붙는다 — 값 바로 옆이라 「이 숫자가 무엇인가」가 한눈에 읽힌다.
   * 라벨 뒤에 괄호로 달면 값에서 멀어져, 칸이 여럿일 때 어느 단위인지 다시 눈이 올라간다.
   *
   * ⛔ 값에 섞어 넣지 않는다 — 치는 값은 숫자뿐이어야 한다.
   */
  const uomSuffix = uomCode === null ? undefined : <span className="pop-uom">{uomCode}</span>;

  /*
   * ⚠ **자판으로도 칠 수 있게 둔다.** 키패드가 주 수단이지만 칸을 잠그면 자판이 붙은 단말과
   *    개발 중 확인에서 값을 넣을 수 없다 — 두 길의 값 주인은 하나라 어긋나지 않는다.
   */
  const field = (key: keyof QuantityDraft, label: string, invalid: boolean): ReactElement => (
    <TextField
      size="xl"
      label={label}
      trailingIcon={uomSuffix}
      inputMode="decimal"
      value={draft[key]}
      disabled={false}
      /* 서버가 짚어 준 것을 먼저 낸다 — 그쪽이 이 값에 대해 더 아는 쪽이다. */
      error={serverErrorOf(key) ?? (showErrors && invalid ? t.quantityInvalid : undefined)}
      /*
       * ⛔ **포커스로 열지 않는다.** 팝업이 닫히면 포커스가 이 칸으로 «돌아오고», 그 순간
       *    다시 열렸다 — [ 확인 ]을 눌러도 아무 일이 없는 것처럼 보였다(실측 2026-09-08).
       *    누른 그때만 연다.
       */
      onClick={() => setPadField({ key, label })}
      onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
    />
  );

  return (
    <section className="pane" aria-label={t.heading}>
      <h2 className="field-label">{t.heading}</h2>

      {errorBanner}


      {/*
       * ⭐ **설계 §3 도면의 차례 그대로다** — 검사 수량이 먼저 서고, 그것을 나눈 셋(합격·
       * 불합격·보류)이 아래에 붙고, 선 하나를 사이에 두고 합계가 그 셋을 되짚는다.
       *
       * 한때 셋을 먼저 가로로 늘어놓고 검사 수량을 그 «아래»에 두었는데, 나누는 값이 나뉜
       * 값보다 뒤에 서서 「무엇을 30 으로 나눈 것인가」가 늦게 읽혔다.
       */}
      <TextField
        size="xl"
        label={t.fields.inspectedQty}
        trailingIcon={uomSuffix}
        inputMode="decimal"
        value={inspectedDraft}
        disabled={false}
        error={showErrors && inspectedInvalid ? t.quantityInvalid : undefined}
        onClick={() => setPadField({ key: 'inspected', label: t.fields.inspectedQty })}
        onChange={(event) => onInspectedChange(event.target.value)}
      />

      <div className="pqc-qty-split">
        {field('accepted', t.fields.accepted, errors.accepted)}
        {field('rejected', t.fields.rejected, errors.rejected)}
        {field('held', t.fields.held, errors.held)}
      </div>

      {/* 구분선 — 위는 「넣는 값」이고 아래는 「그 값을 되짚은 결과」다(도면의 `─────`). */}
      <div className="pqc-rule" />

      <dl className="filter-bar">
        {/* 셀 수 없을 때 0으로 읽은 합을 보이면 그 숫자 자체가 거짓이다. 없음 표시를 낸다. */}
        <div className="field-cell">
          <dt className="field-label">{t.sum}</dt>
          <dd>{totals.kind === 'counted' ? withUnit(formatMicro(totals.sum)) : unknownValue}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.remaining}</dt>
          <dd>
            {totals.kind === 'counted' ? withUnit(formatMicro(totals.remaining)) : unknownValue}
          </dd>
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
          {/* ⚠ 크기를 넘긴다 — 안 넘기면 DS 기본(40)에 POP 규칙이 트리거만 늘려 칸이 넘친다. */}
          {/*
           * ⭐ **못 고르는 사유를 칸 «안»에서 말한다**(사용자 지시 2026-09-08). 아래에 안내를
           *    한 줄씩 붙였더니 판정 밑이 문장으로 채워져, 정작 골라야 할 칸이 늦게 읽혔다.
           *    비어 있는 셀렉터가 스스로 「준비되지 않았다」고 말하면 그 한 줄이 필요 없다.
           */}
          <Select
            id={judgmentId}
            size="xl"
            options={judgmentOptions}
            /*
             * ⛔ **목록이 없으면 값도 보이지 않는다.** 자동 판정이 채운 코드가 남아 있으면
             *    트리거가 그 코드를 그대로 보이고, 정작 「왜 못 고르는가」는 어디에도 없다 —
             *    사용자가 그 자리에서 알아야 하는 것은 코드가 아니라 «준비되지 않았다»다
             *    (사용자 지시 2026-09-08).
             */
            value={judgmentOptions.length === 0 ? null : judgment}
            placeholder={
              judgmentOptions.length === 0 ? t.judgmentUnavailable : t.judgmentPlaceholder
            }
            disabled={judgmentOptions.length === 0}
            onChange={onJudgmentChange}
          />
          {/*
           * ⚠ **목록은 왔는데 그 안에 저장된 판정이 없다**(사용 중지된 코드일 수 있다).
           *   조용히 비우면 «사용자가 지우지 않았는데 고른 것이 사라진다» — 그 사실을 밝힌다.
           *
           * ⛔ 목록 자체가 없을 때는 말하지 않는다 — 그때는 셀렉터가 이미 「준비되지
           *    않았다」로 서 있고, 여기서 한 줄을 더 붙이면 두 사유가 겹쳐 읽힌다.
           */}
          {judgmentOptions.length > 0 && !isKnownCode(judgmentOptions, judgment) && (
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

      {/*
       * ⚠ **설계 §3 도면에 이 칸이 없다.** `coverage_from_at`/`_to_at` 은 「모델이 앞선」
       *    자리라(§5-5) 도면이 그려지기 전에 생겼다. 도면이 그린 것을 먼저 세우고 그 뒤에 둔다 —
       *    검사 결과를 넣는 사람이 먼저 하는 일은 수량과 판정이다.
       */}
      {/*
       * 적용 생산구간 — 이 검사가 «어느 시간대의 생산분»을 대표하는가(§5-5). 불합격일 때
       * 회수 범위가 이 구간으로 정해지므로, 자동으로 채우되 **사람이 고칠 수 있게** 둔다.
       */}
      <div className="form-grid">
        <TextField
          size="xl"
          label={tCoverage.from}
          value={coverage.from}
          disabled={false}

          onChange={(event) => onCoverageChange({ ...coverage, from: event.target.value })}
        />
        <TextField
          size="xl"
          label={tCoverage.to}
          value={coverage.to}
          disabled={false}

          /* ⛔ 조용히 뒤집어 고치지 않는다 — 무엇을 넣었는지 사용자가 알아야 고칠 수 있다. */
          error={isCoverageOutOfOrder(coverage) ? tCoverage.invalidOrder : undefined}
          onChange={(event) => onCoverageChange({ ...coverage, to: event.target.value })}
        />
      </div>
      <p className="field-note">{tCoverage.note}</p>
    </section>
  );
};
