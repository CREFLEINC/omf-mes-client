import { Button, Select, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type FormEvent, type ReactElement } from 'react';

import { SaveErrorBanner } from '../../patterns/master';

import { isKnownCode, labelOfCode, type CodeOption } from './code-options';
import { ConfirmDialog } from './confirm-dialog';
import { FieldLabel } from './field-label';
import {
  canConfirm,
  formatMicro,
  hasQuantityError,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';
import { toTransitionPreview } from './transition-preview';
import { TransitionWarning } from './transition-warning';
import type { InspectionResultRound } from './types';

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
 * ⛔ **자동 계산을 만들지 않는다** — 보류와 불합격은 후속이 다르다. 자동으로 정하면 엉뚱한
 * 후속이 돈다.
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

const CONFIRMED = '확정';

export interface ResultFormPaneProps {
  /** 지금 다루는 회차. 아직 아무도 판정하지 않았거나 재검사 중이면 `null` */
  round: InspectionResultRound | null;
  /** 확인 창의 제목에 쓴다 — 무엇에 대한 판정인지가 누르는 자리에 있어야 한다 */
  inspectionRequestNo: string;
  /** 검사수량 — 회차가 있으면 그 값, 없으면 의뢰의 대상 수량이다 */
  inspectedQty: number;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;

  /** 종합 판정 선택지. **비어 있을 수 있다** — 시드가 아직 안 들어간 상태다 */
  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;

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
  draft,
  onChange,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  onSave,
  isSaving,
  isJustSaved,
  fieldErrors,
  saveError,
  onReload,
  isReinspecting,
  onStartReinspection,
  onCancelReinspection,
}: ResultFormPaneProps) => {
  const judgmentId = useId();
  const lockNoteId = useId();
  /**
   * ⭐ **이 화면은 어떤 회차도 고치지 않는다.**
   *
   * 확정본이 아니라 **회차가 있다는 사실**이 잠그는 근거다. 「작성중」만 열어 두면 막다른 길이
   * 생긴다 — 이 화면에는 임시 저장도 확정 경로도 없어서, 칸이 열려 있어도 저장은 서버에서
   * `UNIQUE(의뢰, 회차)` 에 걸려 409 로 되돌아오고, 「확정본이 아니다」라는 이유로 재검사 단추도
   * 서지 않는다. 그러면 그 회차를 끝낼 길이 화면 어디에도 없다.
   */
  const isLocked = round !== null;
  const isConfirmed = round?.statusCode === CONFIRMED;
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
          : null;

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

  /**
   * 합계 상태를 한 문장으로. **모자란 양·넘긴 양을 숫자로 말한다** — 「맞지 않습니다」만 내면
   * 사용자가 세 칸을 다시 더해 봐야 한다.
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
  );

  /*
   * ⛔ **실패해도 창을 닫지 않는다.** 배너를 창 안에 내고 같은 창에서 다시 누르게 한다 —
   * 그래야 같은 멱등 키가 나가 서버가 두 번째 쓰기로 보지 않는다.
   */
  const banner = <SaveErrorBanner error={saveError} onReload={onReload} />;

  return (
    <form aria-label={t.heading} onSubmit={submit}>
      <h3>{t.heading}</h3>

      <p className="field-note">
        {isReinspecting
          ? t.reinspectRound
          : round === null
            ? t.notStarted
            : t.round(round.inspectionRound)}
      </p>

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

      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.fields.inspectedQty}</dt>
          <dd>{String(inspectedQty)}</dd>
        </div>
      </dl>

      {/*
       * 잠긴 이유를 **묶음에 한 번** 낸다.
       *
       * ⛔ 칸마다 `disabledReason` 을 달면 같은 문장이 세 번 연달아 선다 — 세 칸이 «각각 다른»
       * 이유로 잠긴 것처럼 읽히고, 읽는 사람은 셋을 다 읽고 나서야 같은 말임을 안다. 잠긴 것은
       * 칸 하나가 아니라 이 회차라 이유도 묶음의 것이다.
       */}
      {isLocked && (
        <p className="field-note" id={lockNoteId}>
          {isConfirmed ? t.confirmed : t.draftElsewhere}
        </p>
      )}

      <div className="form-grid">
        {field('accepted', t.fields.accepted, errors.accepted)}
        {field('rejected', t.fields.rejected, errors.rejected)}
        {field('held', t.fields.held, errors.held)}
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
       * 비어도 **감추지 않고 사유를 밝힌다**(공유계약 G-2).
       */}
      <div className="field-cell">
        <FieldLabel htmlFor={judgmentId} label={t.judgment} required />
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

      {/*
       * ⛔ **되돌릴 수 없는 쓰기가 무엇을 하는지 누르기 «전»에 보인다.** 확인 창에도 같은 본문이
       * 다시 서지만, 창을 열기 전에 이미 보고 판단할 수 있어야 한다.
       */}
      {!isLocked && <TransitionWarning preview={preview} />}

      {/* 창이 열려 있는 동안에는 배너를 창 안에서 낸다 — 밖에 내면 창에 가려 보이지 않는다. */}
      {openedAt === null && banner}

      {/*
       * ⛔ **되돌릴 수 없는 쓰기가 끝난 것을 말한다.** 아무 말이 없으면 사용자는 LOT 상태를
       * 전이시키고도 그것이 됐는지 확인할 문장을 못 찾아 한 번 더 누를 자리를 찾는다.
       */}
      {isJustSaved && <p className="field-note">{t.saved}</p>}

      {/*
       * ⛔ **확정된 회차에는 저장 자리를 만들지 않는다**(공유계약 G-23 — 누를 수 있는데 아무
       * 일도 없는 컨트롤을 두지 않는다). 거기서 유일하게 할 수 있는 일이 재검사다 — 잠긴 사유만
       * 내고 길을 내지 않으면, 문면이 「재검사로 새 회차를 쌓으세요」라고 말하는데 쌓을 자리가
       * 화면에 없다.
       */}
      {isLocked && (
        <div className="form-actions">
          <Button type="button" variant="outlined" size="sm" onClick={onStartReinspection}>
            {t.reinspect}
          </Button>
        </div>
      )}

      {!isLocked && (
        <div className="form-actions">
          {showErrors && hasQuantityError(errors) && (
            <p className="field-note form-actions-secondary">{t.saveBlockedByInvalid}</p>
          )}
          {/* 그만두는 길을 함께 둔다 — 열고 나서 되돌아갈 데가 없으면 갇힌다. */}
          {isReinspecting && (
            <Button
              type="button"
              variant="text"
              size="sm"
              disabled={isSaving}
              onClick={onCancelReinspection}
            >
              {t.reinspectCancel}
            </Button>
          )}
          <Button
            type="submit"
            variant="filled"
            size="sm"
            disabled={saveBlockedReason !== null || isSaving}
          >
            {isSaving ? t.saving : t.save}
          </Button>
        </div>
      )}

      {/*
       * 막혔으면 «무엇이» 막혔는지 밝힌다(공유계약 G-23) — 잠긴 단추만 두지 않는다.
       *
       * ⭐ **확정된 회차에서도 낸다.** 그때는 저장 단추 자체가 없는데, 사유가 없으면 사용자는
       * 「왜 저장할 수 없는지」를 칸의 잠금 문구에서만 유추해야 한다 — 사유가 위 재검사 단추를
       * 가리키므로 그 자리에서 할 일이 이어진다.
       */}
      {saveBlockedReason !== null && <p className="field-note">{saveBlockedReason}</p>}

      {/*
       * 검사성적서 발행 — ⚠ **자리를 두되 비활성으로 시작한다.**
       *
       * ⛔ 감추지 않는다. 감추면 이 화면에 그 갈래가 «없는 것»이 되고, 계약이 오면 사용자는
       * 「없던 것이 생겼다」로 만난다 — 자리가 보이면 「아직 못 쓴다」로 만난다(공유계약 G-10·G-23).
       */}
      <div className="form-actions">
        <p className="field-note form-actions-secondary">{t.coaPending}</p>
        <Button type="button" variant="text" size="sm" disabled>
          {t.coaIssue}
        </Button>
      </div>

      {openedAt !== null && (
        <ConfirmDialog
          inspectionRequestNo={inspectionRequestNo}
          judgmentLabel={labelOfCode(judgmentOptions, judgment)}
          preview={preview}
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
