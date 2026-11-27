import { Button, Dialog, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { CodeLockTextField } from '../../patterns/master';
import type { ActionAvailability } from './asset-actions';
import { type CodeOption, codeLabel } from './code-options';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { GaugeFormValues } from './types';

const t = messages.gaugeMaster;

/** 값이 없는 읽기 전용 칸. 빈칸으로 두지 않고 「기록 없음」을 밝힌다(공유계약 G-9). */
const readOnlyText = (value: string | null): string =>
  value === null || value.trim() === '' ? t.fields.notRecorded : value;

interface ReadOnlyFieldProps {
  label: string;
  value: string | null;
  /** 이 칸의 규칙 — 칸 아래 문장 대신 이름 옆 ⓘ 로 낸다(사용자 지시 · #360). */
  info?: string;
}

/**
 * 값을 보여 주기만 하는 칸.
 *
 * **폼 컨트롤을 잠그지 않고 값 표기로 낸다** — 잠긴 입력칸은 「언젠가 여기서 고칠 수 있다」를
 * 뜻하는데, 이 값들은 이 화면이 영영 정하지 않는다. 사유는 이름 옆 ⓘ 로 낸다(사용자 지시 · #360).
 */
const ReadOnlyField = ({ label, value, info }: ReadOnlyFieldProps) => {
  const labelId = useId();
  const labelNode = (
    <span className="field-label" id={labelId}>
      {label}
    </span>
  );

  return (
    <div className="field-cell">
      {info === undefined ? (
        labelNode
      ) : (
        <span className="info-label">
          {labelNode}
          <InfoTip text={info} />
        </span>
      )}
      <p aria-labelledby={labelId}>{readOnlyText(value)}</p>
    </div>
  );
};

export interface GaugeFormDialogProps {
  /** 고를 수 있는 계측기 유형. 서버의 코드값 목록에서 온다 */
  typeOptions: CodeOption[];
  /** 유형 목록의 한계(잘림·실패) 안내 */
  typeOptionsNote?: string;
  mode: 'create' | 'edit';
  values: GaugeFormValues;
  onChange: (patch: Partial<GaugeFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /** null이면 계측기번호 편집 가능 */
  codeLockReason: string | null;
  plantOptions: CodeOption[];
  /** 공장 이름과 조회 상태 — 수정에서는 고르지 않고 읽는다 */
  plantSource: LookupSource;
  cycleOptions: CodeOption[];
  uomOptions: CodeOption[];
  /** 선택 목록의 한계(잘림·실패) 안내. 없으면 붙이지 않는다 */
  optionsNote?: string;
  /** 읽기 전용 값들 — 이 화면이 정하지 않는다 */
  statusCode: string | null;
  statusOptions: CodeOption[];
  lastCalibrationDate: string | null;
  calibrationDueDate: string | null;
  /** 검교정 이력 자리. 등록에는 아직 이력이 없어 부르는 쪽이 `null` 을 준다 */
  history: ReactNode;
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
 * 계측기 등록·수정 창.
 *
 * ⭐ **이 화면이 검교정 주기와 정밀도를 정한다**(공유계약 B-13). 형제 화면(W-05-12)은 같은
 * 두 값을 **읽기 전용 표기로만** 낸다 — 정하는 자리가 둘이면 어느 쪽이 맞는지 알 수 없다.
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 사용자가 친 값을 지킨다. Escape 와 X 는 남긴다:
 * 둘은 나가겠다고 «말한 것»이라 파기가 곧 그 뜻이다.
 */
export const GaugeFormDialog = ({
  mode,
  values,
  onChange,
  typeOptions,
  typeOptionsNote,
  fieldErrors,
  banner,
  codeLockReason,
  plantOptions,
  plantSource,
  cycleOptions,
  uomOptions,
  optionsNote,
  statusCode,
  statusOptions,
  lastCalibrationDate,
  calibrationDueDate,
  history,
  isSaving,
  deactivate,
  dispose,
  onClose,
  onSave,
  onDeactivate,
  onDispose,
}: GaugeFormDialogProps) => {
  const calibrationId = useId();
  const retireNoteId = useId();

  const plantName = lookupDisplayLabel(plantSource, values.plantId);

  return (
    <Dialog
      className={mode === 'create' ? 'dialog-icon-add' : 'dialog-icon-edit'}
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

        <CodeLockTextField
          lockReason={codeLockReason}
          label={t.fields.gaugeCode}
          placeholder={t.form.codePlaceholder}
          required
          value={values.equipmentCode}
          onChange={(event) => onChange({ equipmentCode: event.target.value })}
          error={fieldErrors.equipmentCode}
        />

        <TextField
          label={t.fields.gaugeName}
          placeholder={t.form.namePlaceholder}
          required
          value={values.equipmentName}
          onChange={(event) => onChange({ equipmentName: event.target.value })}
          error={fieldErrors.equipmentName}
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
            info={t.actionReasons.plantFixed}
          />
        )}

        <SelectField
          label={t.fields.gaugeType}
          required
          options={typeOptions}
          value={values.equipmentTypeCode}
          onChange={(value) => onChange({ equipmentTypeCode: value })}
          error={fieldErrors.equipmentTypeCode}
          placeholder={t.form.typePlaceholder}
          note={typeOptionsNote}
        />

        {/*
         * ⭐ **켜고 끄는 것을 언제나 열어 둔다.** 형제 화면은 주기를 편집할 수 없어 「주기 없이
         * 켜면 저장에서 거절당한다」는 이유로 켜기를 잠그는데, 여기서는 켜는 즉시 주기 두 칸이
         * 열리므로 잠글 이유가 없다 — 잠그면 이 화면에서 검교정을 시작할 수가 없다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={calibrationId} label={t.fields.calibrationRequired} />
          <Switch
            id={calibrationId}
            checked={values.calibrationRequired}
            onChange={(event) => onChange({ calibrationRequired: event.target.checked })}
          />
        </div>

        {/*
         * 주기 두 칸은 **짝**이다. 대상이 아니면 잠근다 — 감추지 않는다(G-2). 잠긴 까닭 문장은 걷었다(사용자 지시 · #360).
         * 값은 지우지 않고 남겨 둔다: 다시 켜면 방금 적은 것이 그대로 있고,
         * **비우는 자리는 보낼 때 하나다**(`toGaugeUpdate`).
         */}
        <SelectField
          label={t.fields.calibrationCycleType}
          required={values.calibrationRequired}
          options={cycleOptions}
          value={values.calibrationCycleTypeCode}
          onChange={(value) => onChange({ calibrationCycleTypeCode: value })}
          disabled={!values.calibrationRequired}
          error={fieldErrors.calibrationCycleTypeCode}
          placeholder={t.form.cyclePlaceholder}
        />

        <TextField
          label={t.fields.calibrationCycleInterval}
          placeholder={t.form.cycleIntervalPlaceholder}
          required={values.calibrationRequired}
          inputMode="numeric"
          value={values.calibrationCycleInterval}
          onChange={(event) => onChange({ calibrationCycleInterval: event.target.value })}
          disabled={!values.calibrationRequired}
          error={fieldErrors.calibrationCycleInterval}
        />

        {/* 정밀도도 짝이다 — 「0.01」만으로는 mm 인지 μm 인지 알 수 없다. 다만 필수는 아니다. */}
        {/* 한쪽을 채우면 다른 쪽이 필수가 된다 — 그때만 * 를 단다. */}
        <TextField
          label={t.fields.precisionValue}
          placeholder={t.form.precisionValuePlaceholder}
          required={values.precisionUomId !== ''}
          inputMode="decimal"
          value={values.precisionValue}
          onChange={(event) => onChange({ precisionValue: event.target.value })}
          error={fieldErrors.precisionValue}
        />

        <SelectField
          label={t.fields.precisionUom}
          required={values.precisionValue.trim() !== ''}
          options={uomOptions}
          value={values.precisionUomId}
          onChange={(value) => onChange({ precisionUomId: value })}
          error={fieldErrors.precisionUomId}
          note={optionsNote}
          placeholder={t.form.uomPlaceholder}
        />

        {mode === 'edit' && (
          <ReadOnlyField
            label={t.fields.status}
            value={statusCode === null ? null : codeLabel(statusCode, statusOptions)}
            info={t.actionReasons.statusOwnedElsewhere}
          />
        )}

        {/*
         * ⭐ **검교정 «일자»는 이 화면이 정하지 않는다** — 검교정 이력 등록이 정한다(스펙 §6).
         * 주기는 여기서 정하고 일자는 저기서 정하는 것이 헷갈리기 쉬워 사유를 붙여 둔다.
         */}
        {mode === 'edit' && (
          <ReadOnlyField
            label={t.fields.lastCalibrationDate}
            value={lastCalibrationDate}
            info={t.actionReasons.calibrationDateOwnedElsewhere}
          />
        )}

        {mode === 'edit' && (
          <ReadOnlyField label={t.fields.calibrationDueDate} value={calibrationDueDate} />
        )}

        {/*
         * ⭐ **되돌릴 수 없는 두 조작은 폼 «본문»에 둔다** — 바닥 줄이 아니다.
         * 바닥에 두면 사유 줄까지 함께 붙어 줄이 두 층이 되고, 창이 뷰포트를 넘어
         * **「저장」과 「취소」까지 화면 밖으로 밀려난다**(브라우저 확인 ③에서 실측).
         * 형제 화면(W-05-12)도 같은 자리에 둔다.
         *
         * ⭐ **감추지 않고 잠근다**(공유계약 G-2). 사라진 버튼은 「원래 없는 기능」과 구분되지 않는다.
         * 잠긴 까닭 문장은 걷었다 — 꺼진 단추로만(사용자 지시 · #360). 상세를 못 읽은 사실만은 남긴다
         * (읽기 실패를 알릴 자리가 이 줄뿐이다).
         */}
        {/*
         * 이력은 표라 **두 칸을 다 쓴다** — 폼 칸과 같은 폭에 넣으면 열이 뭉개진다.
         * 창 본문이 스크롤되므로(`.dialog-scroll`) 아래로 길어져도 바닥 액션은 남는다.
         */}
        {history !== null && <div className="form-grid-full">{history}</div>}

        {mode === 'edit' && (
          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={isSaving || !deactivate.enabled}
              aria-describedby={
                deactivate.reason === t.actionReasons.targetUnknown
                  ? `${retireNoteId}-off`
                  : undefined
              }
              onClick={onDeactivate}
            >
              {t.retire.deactivateConfirm}
            </Button>
            {deactivate.reason === t.actionReasons.targetUnknown && (
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
              aria-describedby={
                dispose.reason === t.actionReasons.targetUnknown
                  ? `${retireNoteId}-dispose`
                  : undefined
              }
              onClick={onDispose}
            >
              {t.retire.disposeConfirm}
            </Button>
            {dispose.reason === t.actionReasons.targetUnknown && (
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
