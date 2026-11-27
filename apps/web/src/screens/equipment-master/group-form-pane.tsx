import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { UsageChip } from '../../patterns/usage-chip';
import { CodeLockTextField } from '../../patterns/master';
import { GROUP_TYPE_OPTIONS, type CodeOption } from './code-options';
import { SelectField } from './select-field';
import type { GroupFormValues } from './types';

export type LocationField =
  'defaultFgLocationId';
const LOCATION_FIELDS: {
  field: LocationField;
  label: 'defaultFgLocation';
}[] = [
  { field: 'defaultFgLocationId', label: 'defaultFgLocation' },
];

export interface GroupFormPaneProps {
  mode: 'create' | 'edit';
  values: GroupFormValues;
  onChange: (patch: Partial<GroupFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증과 서버 오류가 합쳐져 온다 */
  fieldErrors: Record<string, string>;
  /** 저장 실패·충돌 배너 슬롯 */
  banner: ReactNode;
  /** null이면 그룹코드 편집 가능. 값이 있으면 잠그고 그 사유를 보인다 */
  codeLockReason: string | null;
  plantOptions: CodeOption[];
  /** 상위 그룹 선택지. 자기 자신과 후손은 이미 빠져 있다 */
  parentOptions: CodeOption[];
  /** 기본 위치 칸별 선택지 — 그 공장의, 칸에 맞는 창고 유형의 위치만 온다. */
  locationOptions: Record<LocationField, CodeOption[]>;
  /** 위치 선택지가 잘렸거나 공장을 아직 고르지 않았을 때의 안내 */
  locationNote?: string;
  /** 담당 부서 선택지 — 「지정 없음」이 첫 줄이다. */
  departmentOptions: CodeOption[];
  /** 담당 부서 선택지가 잘렸거나 실패했을 때의 안내. 알림 규칙은 라벨 옆 ⓘ 가 늘 갖는다 */
  departmentNote?: string;
  isActive: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
  /** 아래 [취소][저장] 줄을 그릴지. 등록 팝업은 팝업 단추 줄이 대신한다. */
  actions?: boolean;
}

const t = messages.equipmentMaster;

export const GroupFormPane = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  plantOptions,
  parentOptions,
  locationOptions,
  locationNote,
  departmentOptions,
  departmentNote,
  isActive,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
  actions = true,
}: GroupFormPaneProps) => {
  const activeLabelId = useId();
  const deactivateNoteId = useId();

  return (
    <section
      className="equipment-master-form"
      aria-label={mode === 'create' ? t.form.createTitle : t.form.editTitle}
    >
      {banner}

      <div className="form-grid">
        <SelectField
          label={t.fields.plant}
          placeholder={t.form.plantPlaceholder}
          required={mode === 'create'}
          options={plantOptions}
          value={values.plantId}
          onChange={(value) => onChange({ plantId: value })}
          disabled={mode === 'edit'}
          disabledReason={mode === 'edit' ? t.actionReasons.plantFixedAfterCreate : undefined}
          error={fieldErrors.plantId}
        />

        <CodeLockTextField
          lockReason={codeLockReason}
          label={t.fields.groupCode}
          placeholder={t.form.codePlaceholder}
          required
          value={values.groupCode}
          onChange={(event) => onChange({ groupCode: event.target.value })}
          error={fieldErrors.groupCode}
        />

        <TextField
          label={t.fields.groupName}
          placeholder={t.form.namePlaceholder}
          required
          value={values.groupName}
          onChange={(event) => onChange({ groupName: event.target.value })}
          error={fieldErrors.groupName}
        />

        <SelectField
          label={t.fields.groupType}
          placeholder={t.form.typePlaceholder}
          required
          options={GROUP_TYPE_OPTIONS}
          value={values.groupTypeCode}
          onChange={(value) => onChange({ groupTypeCode: value })}
          error={fieldErrors.groupTypeCode}
        />

        <SelectField
          label={t.fields.department}
          options={departmentOptions}
          value={values.departmentId}
          onChange={(value) => onChange({ departmentId: value })}
          note={departmentNote}
          /* 알림이 이 부서로 간다는 규칙은 ⓘ 로 — 칸 아래에 늘 펼치지 않는다(관리웹 정리 시안 A). */
          info={t.form.departmentHelp}
          error={fieldErrors.departmentId}
        />

        <SelectField
          label={t.fields.parentGroup}
          options={parentOptions}
          value={values.parentGroupId}
          onChange={(value) => onChange({ parentGroupId: value })}
          /*
           * 고를 수 없는 값이 있다는 사실을 밝힌다. 밝히지 않으면 사용자는 찾는 그룹이
           * 왜 목록에 없는지 알 수 없고, 값이 사라진 줄 안다 — 라벨 옆 ⓘ 로(관리웹 정리 시안 A).
           */
          info={mode === 'edit' ? t.actionReasons.parentExcludesSelfAndDescendants : undefined}
          error={fieldErrors.parentGroupId}
        />

        {LOCATION_FIELDS.map(({ field, label }) => (
          <SelectField
            key={field}
            label={t.fields[label]}
            options={locationOptions[field]}
            value={values[field]}
            onChange={(value) => onChange({ [field]: value })}
            note={locationNote}
            error={fieldErrors[field]}
          />
        ))}

        {/* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다. */}
        <div>
          <span className="field-label" id={activeLabelId}>
            {t.fields.isActive}
          </span>
          <p aria-labelledby={activeLabelId}>
            <UsageChip isActive={isActive} />
          </p>
          {/* 아직 등록되지 않은 그룹에는 사용 중지할 대상이 없다. 이미 중지된 것도 마찬가지다. */}
          {mode === 'edit' && isActive && (
            <div className="field-cell">
              {/*
               * ⚠ **저장하지 않은 입력이 있으면 잠근다.** 사용 중지는 상세를 다시 불러오므로
               * 그때 폼이 새로 세워지고, 사용자가 친 값이 말없이 사라진다.
               * 감추지 않고 사유를 함께 낸다 — 비활성 컨트롤은 포커스를 받지 못하므로
               * 사유는 화면 읽기 도구에만 두고 `aria-describedby` 로 잇는다(사용자 지시 2026-11-27 · #360).
               */}
              <Button
                variant="outlined"
                disabled={isDirty}
                aria-describedby={isDirty ? deactivateNoteId : undefined}
                onClick={onDeactivate}
              >
                {messages.common.deactivate}
              </Button>
              {isDirty && (
                <span id={deactivateNoteId} className="visually-hidden">
                  {t.actionReasons.deactivateNeedsCleanForm}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {actions && (
        <div className="form-actions">
          <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
            {messages.common.cancel}
          </Button>
          <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        </div>
      )}
    </section>
  );
};
