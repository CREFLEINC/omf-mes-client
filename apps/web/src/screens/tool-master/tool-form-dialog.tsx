import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import type { ActionAvailability } from './asset-actions';

import {
  PM_CYCLE_UNIT_OPTIONS,
  PM_TRIGGER_OPTIONS,
  type CodeOption,
  codeLabel,
  ensureOption,
  MOLD_TOOL_TYPE_CODE,
  selectableOptions,
  usesDateAxis,
  usesShotAxis,
} from './code-options';
import { SelectField } from './select-field';
import { availableShots, shotUsage, type ShotTarget } from './shot-counts';
import { countText, figureText, ratioText } from './shot-text';
import type { ToolFormValues } from './types';

const t = messages.toolMaster;

/** 값이 없는 읽기 전용 칸. 빈칸으로 두지 않고 「기록 없음」을 밝힌다(공유계약 G-9). */
const readOnlyText = (value: string | null): string =>
  value === null || value.trim() === '' ? t.fields.notRecorded : value;

interface StatusItemProps {
  label: string;
  value: string | null;
}

/**
 * 「현재 상태」 한 묶음 — 작은 이름 바로 아래 값.
 *
 * **폼 컨트롤을 잠그지 않고 값 표기로 낸다** — 잠긴 입력칸은 「언젠가 여기서 고칠 수 있다」를
 * 뜻하는데, 이 값들은 이 화면이 영영 정하지 않는다. 값은 이름표로 이어 둔다 — 화면 낭독기와
 * 시험이 「어느 값이 무엇인가」를 이름으로 찾는다.
 */
const StatusItem = ({ label, value }: StatusItemProps) => {
  const labelId = useId();

  return (
    <div className="tool-form-status-item">
      <dt id={labelId}>{label}</dt>
      <dd aria-labelledby={labelId}>{readOnlyText(value)}</dd>
    </div>
  );
};

export interface ToolFormDialogProps {
  mode: 'create' | 'edit';
  values: ToolFormValues;
  onChange: (patch: Partial<ToolFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /** null이면 툴코드 편집 가능 */
  codeLockReason: string | null;
  plantOptions: CodeOption[];
  /** 공장 이름과 조회 상태 — 수정에서는 고르지 않고 읽는다 */
  plantSource: LookupSource;
  /** 도구 유형 — 서버 공통코드가 정본이다(omf-all-around#52). */
  typeSource: LookupSource;
  /** 유형 선택지의 한계 안내(값 없음·조회 실패). 없으면 붙이지 않는다 */
  typeNote?: string;
  /** 선택 목록의 한계(잘림·실패) 안내. 없으면 붙이지 않는다 */
  optionsNote?: string;
  /** 읽기 전용 값들 — 이 화면이 정하지 않는다 */
  statusCode: string | null;
  statusOptions: CodeOption[];
  currentShotCount: number | null;
  /** 사용 가능 타수·초과율의 근거가 되는 서버 값. **셈은 서버가 한다** */
  figures: ShotTarget | null;
  lastPmDate: string | null;
  nextPmDate: string | null;
  /** 이 툴로 발행된 라벨 회차 수. 코드가 잠긴 이유를 사용자가 잇게 한다 */
  labelIssueCount: number | null;
  isSaving: boolean;
  /** 사용 중지를 지금 할 수 있는가. 못 하면 사유가 함께 온다 */
  deactivate: ActionAvailability;
  /** 폐기를 지금 할 수 있는가 */
  dispose: ActionAvailability;
  onClose: () => void;
  onSave: () => void;
  onDeactivate: () => void;
  onDispose: () => void;
}

/**
 * 툴 등록·수정 창.
 *
 * ⛔ **누계 타발수에 입력칸을 만들지 않는다**(스펙 §6). 더하는 것은 툴 사용실적 입력이고
 * 되돌리는 것은 툴 예방보전 실적 등록이다 — 여기서 손으로 고칠 수 있으면 실적과 마스터가
 * 조용히 어긋나고, 어긋난 뒤에는 어느 쪽이 맞는지 아무도 모른다.
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 사용자가 친 값을 지킨다. Escape 와 [취소]는 남긴다:
 * 둘은 나가겠다고 «말한 것»이라 파기가 곧 그 뜻이다. X 는 사용자 지정으로 두지 않는다.
 */
export const ToolFormDialog = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  plantOptions,
  plantSource,
  typeSource,
  typeNote,
  optionsNote,
  statusCode,
  statusOptions,
  currentShotCount,
  figures,
  lastPmDate,
  nextPmDate,
  labelIssueCount,
  isSaving,
  deactivate,
  dispose,
  onClose,
  onSave,
  onDeactivate,
  onDispose,
}: ToolFormDialogProps) => {
  const retireNoteId = useId();
  const sectionId = useId();
  /*
   * ⭐ 비어 있는 필수 입력칸 표식 — 테두리만 빨갛게 칠한다(사용자 지정 2026-09-22). 디자인
   *   시스템 입력칸은 오류 문구 없이 테두리만 칠하는 옵션이 없어 이 창의 스타일이 맡는다.
   *   잠긴 칸은 채울 수 없으니 칠하지 않는다. 검증 규칙은 그대로다.
   */
  const emptyRequired = (value: string, required: boolean, disabled = false): string | undefined =>
    required && !disabled && value.trim() === '' ? 'tool-form-empty-required' : undefined;
  const plantName = lookupDisplayLabel(plantSource, values.plantId);

  const onDateAxis = usesDateAxis(values.pmTriggerTypeCode);

  /*
   * ⭐ 지금 걸려 있는 값이 선택지에 없어도 **칸이 비어 보이면 안 된다.** 서버 자료에 계약이
   * 좁힌 두 값 밖의 단위가 남아 있을 수 있고, 그때 빼 버리면 사용자가 값이 사라진 줄 알고
   * 다시 고른다 — 원래 값은 그렇게 조용히 바뀐다.
   */
  const cycleUnitOptions = ensureOption([...PM_CYCLE_UNIT_OPTIONS], values.pmCycleUnitCode);
  const triggerOptions = ensureOption([...PM_TRIGGER_OPTIONS], values.pmTriggerTypeCode);
  /*
   * ⭐ 사용 중인 값만 고르게 하되 **지금 걸린 값은 남긴다** — 그 값이 사용 중지돼도 칸이 비어
   *   보이면 사용자가 값이 사라진 줄 알고 다시 고른다. 원래 값은 그렇게 조용히 바뀐다.
   */
  const typeOptions = selectableOptions(typeSource, values.toolTypeCode);

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      /*
       * ⭐ 사용자 지정(2026-09-22) — 오른쪽 위 X 를 두지 않는다. 닫는 길은 아래 [취소]와 Esc 로
       *   남는다(둘 다 같은 `onClose` 로 간다) — 창을 빠져나갈 길이 막히지는 않는다.
       */
      showCloseButton={false}
      /*
       * ⭐ 한 단계 넓은 창(lg) — 예방보전 세 칸을 한 줄에, 현재 상태를 4열로 담으려면 기본 폭(md)
       *   에서는 칸이 좁아 이름이 접힌다. 칸 수가 줄어 창 높이도 함께 준다(사용자 지정 2026-09-22).
       */
      size="lg"
      title={mode === 'create' ? t.form.createTitle : t.form.editTitle}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button disabled={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      {/*
       * ⭐ **사용자 지정 배치(2026-09-22) — 되돌리지 않는다.** 모든 칸이 같은 2열에 섞여 «고칠 값»과
       *   «보기만 하는 값»이 갈리지 않았다. 「기본 정보 → 예방보전 설정 → 현재 상태」 세 구획으로
       *   나누고, 구획은 상자 대신 제목과 선 하나로 가른다.
       * ⭐ 칸마다 붙던 「어디서 정해지는가」 설명(공장·운용상태·누계 타발수·예방보전일)은 걷었다 —
       *   값이 「현재 상태」 구획에 입력칸이 아닌 글자로 서는 것으로 전한다(사용자 지정).
       */}
      <div className="dialog-scroll tool-form">
        {banner}

        <section className="tool-form-section" aria-labelledby={`${sectionId}-basic`}>
          <h3 id={`${sectionId}-basic`} className="tool-form-section-title">
            {t.form.sections.basic}
          </h3>
          <div className="form-grid tool-form-grid">
            <TextField
              label={t.fields.toolCode}
              required
              value={values.moldCode}
              onChange={(event) => onChange({ moldCode: event.target.value })}
              containerClassName={emptyRequired(values.moldCode, true, codeLockReason !== null)}
              disabled={codeLockReason !== null}
              disabledReason={codeLockReason ?? undefined}
              error={fieldErrors.moldCode}
            />

            <TextField
              label={t.fields.toolName}
              required
              value={values.moldName}
              onChange={(event) => onChange({ moldName: event.target.value })}
              containerClassName={emptyRequired(values.moldName, true)}
              error={fieldErrors.moldName}
            />

            <SelectField
              label={t.fields.toolType}
              required
              options={typeOptions}
              value={values.toolTypeCode}
              onChange={(value) => onChange({ toolTypeCode: value })}
              error={fieldErrors.toolTypeCode}
              note={typeNote}
              placeholder={t.form.typePlaceholder}
            />

            {/*
             * ⚠ **잠그지 않고 뜻을 밝힌다.** 캐비티 수는 금형에서만 뜻이 있으나(스펙 §6), 잠그면 유형을
             * 잘못 고른 채로는 고칠 수 없는 자리가 생긴다. 뜻은 짧은 도움말로만 남긴다.
             * ⭐ 도움말은 **금형이 아닌 유형을 골랐을 때만** 선다(사용자 지정 2026-09-22) — 설명은 입력을
             *   정하는 데 필요할 때만 낸다. 늘 서면 그 칸만 키가 커져 옆 칸 밑이 비고 다음 줄이 밀렸다.
             */}
            <TextField
              label={t.fields.cavityCount}
              required
              inputMode="numeric"
              value={values.cavityCount}
              onChange={(event) => onChange({ cavityCount: event.target.value })}
              containerClassName={emptyRequired(values.cavityCount, true)}
              helperText={
                values.toolTypeCode !== '' && values.toolTypeCode !== MOLD_TOOL_TYPE_CODE
                  ? t.notes.cavityMeaningfulForMold
                  : undefined
              }
              error={fieldErrors.cavityCount}
            />

            {/*
             * ⭐ **비워 두는 것을 막지 않는다** — 「적정 타수 미설정」 조회 조건이 그 상태를 전제한다.
             * 대신 비어 있을 때 **무엇이 서지 않는지**를 말한다. 타발수 축을 쓰기로 해 놓고 비워 둔
             * 경우가 그 말이 가장 필요한 자리다.
             */}
            <TextField
              label={t.fields.guaranteedShotCount}
              inputMode="numeric"
              value={values.guaranteedShotCount}
              onChange={(event) => onChange({ guaranteedShotCount: event.target.value })}
              helperText={
                values.guaranteedShotCount.trim() === '' && usesShotAxis(values.pmTriggerTypeCode)
                  ? t.notes.guaranteedMissingBlocksShotAxis
                  : undefined
              }
              error={fieldErrors.guaranteedShotCount}
            />

            {/*
             * ⭐ **공장은 등록에서만 고른다.** 계약이 수정 본문에 받지 않는다 — 공장을 옮기는 것은
             * 자산을 옮기는 일이라 이 화면의 일이 아니다. 수정에서는 「현재 상태」에 글자로 선다.
             */}
            {mode === 'create' && (
              <SelectField
                label={t.fields.plant}
                required
                options={plantOptions}
                value={values.plantId}
                onChange={(value) => onChange({ plantId: value })}
                error={fieldErrors.plantId}
                note={optionsNote}
                placeholder={t.form.plantPlaceholder}
              />
            )}
          </div>
        </section>

        <section className="tool-form-section" aria-labelledby={`${sectionId}-pm`}>
          <h3 id={`${sectionId}-pm`} className="tool-form-section-title">
            {t.form.sections.pm}
          </h3>
          {/*
           * ⭐ 세 칸을 **한 줄**에 둬 한 설정으로 읽히게 한다(사용자 지정 2026-09-22).
           * ⭐ 주기 칸이 잠긴 까닭은 **글로 쓰지 않는다** — 잠긴 칸의 모양이 그것을 말한다(사용자 지정).
           *   날짜 축을 고르면 칸이 열리고, 비어 있으면 필수 칸 표식(빨간 테두리)이 채울 곳을 가리킨다.
           */}
          <div className="form-grid tool-form-grid tool-form-pm-grid">
            <SelectField
              label={t.fields.pmTriggerType}
              required
              options={triggerOptions}
              value={values.pmTriggerTypeCode}
              onChange={(value) => onChange({ pmTriggerTypeCode: value })}
              error={fieldErrors.pmTriggerTypeCode}
            />

            {/*
             * 주기 두 칸은 **짝**이다. 날짜 축을 쓰지 않으면 잠근다 — 감추지 않는다(G-2).
             * 값은 지우지 않고 남겨 둔다: 다시 날짜 축으로 바꾸면 방금 적은 것이 그대로 있고,
             * **비우는 자리는 보낼 때 하나다**(`toToolUpdate`).
             */}
            <TextField
              label={t.fields.pmCycleInterval}
              required={onDateAxis}
              inputMode="numeric"
              value={values.pmCycleInterval}
              onChange={(event) => onChange({ pmCycleInterval: event.target.value })}
              containerClassName={emptyRequired(values.pmCycleInterval, onDateAxis, !onDateAxis)}
              disabled={!onDateAxis}
              error={fieldErrors.pmCycleInterval}
            />

            <SelectField
              label={t.fields.pmCycleUnit}
              required={onDateAxis}
              options={cycleUnitOptions}
              value={values.pmCycleUnitCode}
              onChange={(value) => onChange({ pmCycleUnitCode: value })}
              disabled={!onDateAxis}
              error={fieldErrors.pmCycleUnitCode}
              placeholder={t.form.cycleUnitPlaceholder}
            />
          </div>
        </section>

        {mode === 'edit' && (
          <section className="tool-form-section" aria-labelledby={`${sectionId}-status`}>
            <div className="tool-form-section-head">
              <h3 id={`${sectionId}-status`} className="tool-form-section-title">
                {t.form.sections.status}
              </h3>
              {/*
               * ⭐ **되돌릴 수 없는 두 조작은 폼 «본문»에 둔다** — 바닥 줄이 아니다. 바닥에 두면 사유
               * 줄까지 함께 붙어 줄이 두 층이 되고, 창이 뷰포트를 넘어 「저장」과 「취소」까지 화면 밖으로
               * 밀려난다(W-05-11 브라우저 확인에서 실측). 운용상태를 바꾸는 자리라 「현재 상태」에 둔다.
               *
               * ⭐ **감추지 않고 잠그고 사유를 붙인다**(공유계약 G-2). 사라진 버튼은 「원래 없는
               * 기능」과 구분되지 않아, 왜 못 하는지도 어디서 할 수 있는지도 알 수 없다.
               * 사유는 보이는 DOM 텍스트로 낸다 — 잠긴 버튼은 포커스를 못 받아 툴팁이 닿지 않는다.
               */}
              {/*
               * ⭐ 상태를 바꾸는 두 액션은 **「현재 상태」 제목 줄 오른쪽**에 둔다(사용자 지정 2026-09-22) —
               *   정보 목록의 한 항목처럼 읽히지 않고, 이 구획의 값을 바꾸는 손잡이로 읽힌다. 작은
               *   외곽선이라 바닥 줄의 [저장]보다 앞서지 않는다.
               */}
              <div className="tool-form-retire">
                <div className="tool-form-retire-action">
                  <Button
                    variant="outlined"
                    size="sm"
                    disabled={isSaving || !deactivate.enabled}
                    aria-describedby={
                      deactivate.reason === null ? undefined : `${retireNoteId}-off`
                    }
                    onClick={onDeactivate}
                  >
                    {t.retire.deactivateConfirm}
                  </Button>
                  {deactivate.reason !== null && (
                    <span id={`${retireNoteId}-off`} className="field-note">
                      {deactivate.reason}
                    </span>
                  )}
                </div>
                <div className="tool-form-retire-action">
                  <Button
                    variant="outlined"
                    size="sm"
                    disabled={isSaving || !dispose.enabled}
                    aria-describedby={
                      dispose.reason === null ? undefined : `${retireNoteId}-dispose`
                    }
                    onClick={onDispose}
                  >
                    {t.retire.disposeConfirm}
                  </Button>
                  {dispose.reason !== null && (
                    <span id={`${retireNoteId}-dispose`} className="field-note">
                      {dispose.reason}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/*
             * ⭐ 보기만 하는 값을 한곳에 모은다. 스펙 §6 의 목록 그대로이고 하나도 빼지 않는다 —
             * 초과율·예방보전일·라벨 발행 회차도 이 자리에 선다(라벨 회차는 참조 0건인데도 코드가
             * 잠기는 까닭이다).
             */}
            <dl className="tool-form-status">
              <StatusItem label={t.fields.plant} value={plantName} />
              <StatusItem
                label={t.fields.status}
                value={statusCode === null ? null : codeLabel(statusCode, statusOptions)}
              />
              <StatusItem
                label={t.fields.currentShotCount}
                value={currentShotCount === null ? null : countText(currentShotCount)}
              />
              <StatusItem
                label={t.fields.availableShotCount}
                value={figures === null ? null : figureText(availableShots(figures), countText)}
              />
              <StatusItem
                label={t.fields.shotUsageRatio}
                value={figures === null ? null : figureText(shotUsage(figures), ratioText)}
              />
              <StatusItem
                label={t.fields.labelIssueCount}
                value={labelIssueCount === null ? null : t.form.labelIssued(labelIssueCount)}
              />
              <StatusItem label={t.fields.lastPmDate} value={lastPmDate} />
              <StatusItem label={t.fields.nextPmDate} value={nextPmDate} />
            </dl>
          </section>
        )}
      </div>
    </Dialog>
  );
};
