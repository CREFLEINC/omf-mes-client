import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import type { ActionAvailability } from './asset-actions';

import {
  PM_CYCLE_UNIT_OPTIONS,
  PM_TRIGGER_OPTIONS,
  TOOL_TYPE_OPTIONS,
  type CodeOption,
  codeLabel,
  ensureOption,
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

interface ReadOnlyFieldProps {
  label: string;
  value: string | null;
  note?: string;
}

/**
 * 값을 보여 주기만 하는 칸.
 *
 * **폼 컨트롤을 잠그지 않고 값 표기로 낸다** — 잠긴 입력칸은 「언젠가 여기서 고칠 수 있다」를
 * 뜻하는데, 이 값들은 이 화면이 영영 정하지 않는다. 사유는 함께 낸다.
 */
const ReadOnlyField = ({ label, value, note }: ReadOnlyFieldProps) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId}>{readOnlyText(value)}</p>
      {note !== undefined && <span className="field-note">{note}</span>}
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
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 사용자가 친 값을 지킨다. Escape 와 X 는 남긴다:
 * 둘은 나가겠다고 «말한 것»이라 파기가 곧 그 뜻이다.
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
  const plantName = lookupDisplayLabel(plantSource, values.plantId);

  const onDateAxis = usesDateAxis(values.pmTriggerTypeCode);

  /*
   * ⭐ 지금 걸려 있는 값이 선택지에 없어도 **칸이 비어 보이면 안 된다.** 서버 자료에 계약이
   * 좁힌 두 값 밖의 단위가 남아 있을 수 있고, 그때 빼 버리면 사용자가 값이 사라진 줄 알고
   * 다시 고른다 — 원래 값은 그렇게 조용히 바뀐다.
   */
  const cycleUnitOptions = ensureOption([...PM_CYCLE_UNIT_OPTIONS], values.pmCycleUnitCode);
  const triggerOptions = ensureOption([...PM_TRIGGER_OPTIONS], values.pmTriggerTypeCode);
  const typeOptions = ensureOption([...TOOL_TYPE_OPTIONS], values.toolTypeCode);

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
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
      <div className="form-grid dialog-scroll">
        {banner}

        <TextField
          label={t.fields.toolCode}
          required
          value={values.moldCode}
          onChange={(event) => onChange({ moldCode: event.target.value })}
          disabled={codeLockReason !== null}
          disabledReason={codeLockReason ?? undefined}
          error={fieldErrors.moldCode}
        />

        <TextField
          label={t.fields.toolName}
          required
          value={values.moldName}
          onChange={(event) => onChange({ moldName: event.target.value })}
          error={fieldErrors.moldName}
        />

        {/*
         * ⭐ **공장은 등록에서만 고른다.** 계약이 수정 본문에 받지 않는다 — 공장을 옮기는 것은
         * 자산을 옮기는 일이라 이 화면의 일이 아니다. 그래서 수정에서는 «잠긴 선택칸»이 아니라
         * 값 표기로 낸다.
         */}
        {mode === 'create' ? (
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
        ) : (
          <ReadOnlyField
            label={t.fields.plant}
            value={plantName}
            note={t.actionReasons.plantFixed}
          />
        )}

        <SelectField
          label={t.fields.toolType}
          required
          options={typeOptions}
          value={values.toolTypeCode}
          onChange={(value) => onChange({ toolTypeCode: value })}
          error={fieldErrors.toolTypeCode}
          note={messages.pendingCode.note}
          placeholder={t.form.typePlaceholder}
        />

        {/*
         * ⚠ **잠그지 않고 뜻을 밝힌다.** 캐비티 수는 금형에서만 뜻이 있으나(스펙 §6),
         * 도구 유형 값 목록이 아직 없어(`omf-mes#145`) **어느 코드가 금형인지 화면이 판정할 수
         * 없다.** 모르는 채로 잠그면 금형인데도 못 고치는 자리가 생긴다 — 값 목록이 들어오면
         * 그때 잠근다.
         */}
        <TextField
          label={t.fields.cavityCount}
          required
          inputMode="numeric"
          value={values.cavityCount}
          onChange={(event) => onChange({ cavityCount: event.target.value })}
          helperText={t.notes.cavityMeaningfulForMold}
          error={fieldErrors.cavityCount}
        />

        {/*
         * ⭐ **비워 두는 것을 막지 않는다** — 「적정타수 없는 것만」 조회 조건이 그 상태를 전제한다.
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

        <SelectField
          label={t.fields.pmTriggerType}
          required
          options={triggerOptions}
          value={values.pmTriggerTypeCode}
          onChange={(value) => onChange({ pmTriggerTypeCode: value })}
          error={fieldErrors.pmTriggerTypeCode}
        />

        {/*
         * 주기 두 칸은 **짝**이다. 날짜 축을 쓰지 않으면 잠그고 사유를 붙인다 — 감추지 않는다(G-2).
         * 값은 지우지 않고 남겨 둔다: 다시 날짜 축으로 바꾸면 방금 적은 것이 그대로 있고,
         * **비우는 자리는 보낼 때 하나다**(`toToolUpdate`).
         */}
        <TextField
          label={t.fields.pmCycleInterval}
          required={onDateAxis}
          inputMode="numeric"
          value={values.pmCycleInterval}
          onChange={(event) => onChange({ pmCycleInterval: event.target.value })}
          disabled={!onDateAxis}
          disabledReason={t.actionReasons.cycleNeedsDateAxis}
          error={fieldErrors.pmCycleInterval}
        />

        <SelectField
          label={t.fields.pmCycleUnit}
          required={onDateAxis}
          options={cycleUnitOptions}
          value={values.pmCycleUnitCode}
          onChange={(value) => onChange({ pmCycleUnitCode: value })}
          disabled={!onDateAxis}
          disabledReason={t.actionReasons.cycleNeedsDateAxis}
          error={fieldErrors.pmCycleUnitCode}
          placeholder={t.form.cycleUnitPlaceholder}
        />

        {mode === 'edit' && (
          <ReadOnlyField
            label={t.fields.status}
            value={statusCode === null ? null : codeLabel(statusCode, statusOptions)}
            note={t.actionReasons.statusOwnedElsewhere}
          />
        )}

        {/* ⭐ 스펙 §6 의 첫 항목 — 읽기만 하고 사유를 함께 낸다. */}
        {mode === 'edit' && (
          <ReadOnlyField
            label={t.fields.currentShotCount}
            value={currentShotCount === null ? null : countText(currentShotCount)}
            note={t.actionReasons.shotCountOwnedElsewhere}
          />
        )}

        {mode === 'edit' && (
          <ReadOnlyField
            label={t.fields.availableShotCount}
            value={figures === null ? null : figureText(availableShots(figures), countText)}
          />
        )}

        {mode === 'edit' && (
          <ReadOnlyField
            label={t.fields.shotUsageRatio}
            value={figures === null ? null : figureText(shotUsage(figures), ratioText)}
          />
        )}

        {mode === 'edit' && (
          <ReadOnlyField
            label={t.fields.lastPmDate}
            value={lastPmDate}
            note={t.actionReasons.pmDateOwnedElsewhere}
          />
        )}

        {mode === 'edit' && <ReadOnlyField label={t.fields.nextPmDate} value={nextPmDate} />}

        {/*
         * ⭐ **라벨 회차를 밝힌다** — 참조 건수가 0인데도 코드가 잠기는 이유가 이것이다(스펙 §6).
         * 잠금 사유 문구만으로는 「몇 장이 현장에 나가 있는가」를 알 수 없다.
         */}
        {mode === 'edit' && (
          <ReadOnlyField
            label={t.fields.labelIssueCount}
            value={labelIssueCount === null ? null : t.form.labelIssued(labelIssueCount)}
          />
        )}

        {/*
         * ⭐ **되돌릴 수 없는 두 조작은 폼 «본문»에 둔다** — 바닥 줄이 아니다.
         * 바닥에 두면 사유 줄까지 함께 붙어 줄이 두 층이 되고, 창이 뷰포트를 넘어
         * 「저장」과 「취소」까지 화면 밖으로 밀려난다(W-05-11 브라우저 확인에서 실측).
         *
         * ⭐ **감추지 않고 잠그고 사유를 붙인다**(공유계약 G-2). 사라진 버튼은 「원래 없는
         * 기능」과 구분되지 않아, 왜 못 하는지도 어디서 할 수 있는지도 알 수 없다.
         * 사유는 보이는 DOM 텍스트로 낸다 — 잠긴 버튼은 포커스를 못 받아 툴팁이 닿지 않는다.
         */}
        {mode === 'edit' && (
          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={isSaving || !deactivate.enabled}
              aria-describedby={deactivate.reason === null ? undefined : `${retireNoteId}-off`}
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
        )}

        {mode === 'edit' && (
          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={isSaving || !dispose.enabled}
              aria-describedby={dispose.reason === null ? undefined : `${retireNoteId}-dispose`}
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
        )}
      </div>
    </Dialog>
  );
};
