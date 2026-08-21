import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { GROUP_TYPE_OPTIONS, type CodeOption } from './code-options';
import { SelectField } from './select-field';
import type { GroupFormValues } from './types';

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
  isActive: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
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
  isActive,
  isDirty,
  isSaving,
  onSave,
  onCancel,
}: GroupFormPaneProps) => {
  const activeLabelId = useId();

  return (
    <section aria-label={mode === 'create' ? t.form.createTitle : t.form.editTitle}>
      {banner}

      <div className="form-grid">
        <SelectField
          label={t.fields.plant}
          required={mode === 'create'}
          options={plantOptions}
          value={values.plantId}
          onChange={(value) => onChange({ plantId: value })}
          disabled={mode === 'edit'}
          disabledReason={mode === 'edit' ? t.actionReasons.plantFixedAfterCreate : undefined}
          error={fieldErrors.plantId}
        />

        <TextField
          label={t.fields.groupCode}
          required
          value={values.groupCode}
          onChange={(event) => onChange({ groupCode: event.target.value })}
          disabled={codeLockReason !== null}
          disabledReason={codeLockReason ?? undefined}
          error={fieldErrors.groupCode}
        />

        <TextField
          label={t.fields.groupName}
          required
          value={values.groupName}
          onChange={(event) => onChange({ groupName: event.target.value })}
          error={fieldErrors.groupName}
        />

        <SelectField
          label={t.fields.groupType}
          required
          options={GROUP_TYPE_OPTIONS}
          value={values.groupTypeCode}
          onChange={(value) => onChange({ groupTypeCode: value })}
          note={messages.pendingCode.note}
          error={fieldErrors.groupTypeCode}
        />

        <SelectField
          label={t.fields.parentGroup}
          options={parentOptions}
          value={values.parentGroupId}
          onChange={(value) => onChange({ parentGroupId: value })}
          /*
           * 고를 수 없는 값이 있다는 사실을 밝힌다. 밝히지 않으면 사용자는 찾는 그룹이
           * 왜 목록에 없는지 알 수 없고, 값이 사라진 줄 안다.
           */
          note={mode === 'edit' ? t.actionReasons.parentExcludesSelfAndDescendants : undefined}
          error={fieldErrors.parentGroupId}
        />

        {/* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다. */}
        <div>
          <span className="field-label" id={activeLabelId}>
            {t.fields.isActive}
          </span>
          <p aria-labelledby={activeLabelId}>{isActive ? t.values.active : t.values.inactive}</p>
        </div>
      </div>

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>
        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {messages.common.save}
        </Button>
      </div>
    </section>
  );
};
