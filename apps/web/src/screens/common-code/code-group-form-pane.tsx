import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import type { CodeGroupFormValues } from './types';

const t = messages.commonCode;

export type CodeGroupFormMode = 'create' | 'edit';

export interface CodeGroupFormPaneProps {
  /** `create`면 아직 없는 코드그룹을 만드는 폼이다 — 사용 중지가 없고 주 액션이 등록이다. */
  mode: CodeGroupFormMode;
  values: CodeGroupFormValues;
  onChange: (patch: Partial<CodeGroupFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /** null이면 그룹코드를 편집할 수 있다. */
  codeLockReason: string | null;
  /** null이면 사용 중지를 누를 수 있다. 값이 있으면 그것이 비활성 사유다. */
  deactivateDisabledReason: string | null;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
}

/**
 * 우 칸 위쪽 — 코드그룹 정보.
 *
 * **사용 여부를 입력칸으로 두지 않는다.** 전용 액션(`:deactivate`)으로만 바뀌므로
 * 입력칸을 두면 저장 본문에 실릴 여지가 생긴다.
 *
 * **그룹코드의 잠금은 서버가 준 편집 가능 여부만 읽는다.** 화면이 스스로 판정하지 않는다 —
 * 상위(`screen.tsx`)가 `codeLockMessage`로 만든 사유를 그대로 받는다.
 */
export const CodeGroupFormPane = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  deactivateDisabledReason,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
}: CodeGroupFormPaneProps) => {
  const codeId = useId();
  const nameId = useId();
  const descriptionId = useId();

  return (
    <section className="pane" aria-label={t.panes.codeGroupForm}>
      {banner}

      <div className="form-grid">
        {/*
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={codeId} label={t.codeGroup.fields.groupCode} required />
          <TextField
            id={codeId}
            value={values.groupCode}
            onChange={(event) => onChange({ groupCode: event.target.value })}
            disabled={codeLockReason !== null}
            disabledReason={codeLockReason}
            error={fieldErrors.groupCode}
            aria-required
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={nameId} label={t.codeGroup.fields.groupName} required />
          <TextField
            id={nameId}
            value={values.groupName}
            onChange={(event) => onChange({ groupName: event.target.value })}
            error={fieldErrors.groupName}
            aria-required
          />
        </div>

        {/* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={descriptionId} label={t.codeGroup.fields.description} />
          <TextField
            id={descriptionId}
            value={values.description}
            onChange={(event) => onChange({ description: event.target.value })}
            error={fieldErrors.description}
          />
        </div>
      </div>

      <div className="form-actions">
        {/*
         * 등록 폼에는 사용 중지 자리를 두지 않는다 — 아직 없는 자원이라
         * 「언젠가 풀린다」가 아니라 애초에 해당하지 않는 액션이다.
         */}
        {mode === 'edit' &&
          (deactivateDisabledReason === null ? (
            <div className="field-cell form-actions-secondary">
              <Button variant="outlined" onClick={onDeactivate}>
                {messages.common.deactivate}
              </Button>
            </div>
          ) : (
            <DisabledAction
              label={messages.common.deactivate}
              reason={deactivateDisabledReason}
              className="form-actions-secondary"
            />
          ))}

        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {mode === 'create' ? t.actions.addCodeGroup : messages.common.save}
        </Button>
      </div>
    </section>
  );
};
