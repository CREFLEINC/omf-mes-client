import { AlertBanner, Button, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import type { CodeAdapter } from './adapters';
import type { CodeFormValues, CodeOption } from './types';

const t = messages.defectCauseCode;

export interface CodeFormPaneProps {
  /** 탭이 무엇인지는 어댑터만 안다 — 이 부품은 라벨과 폼 값만 다룬다. */
  adapter: CodeAdapter;
  mode: 'create' | 'edit';
  values: CodeFormValues;
  onChange: (patch: Partial<CodeFormValues>) => void;
  /** 폼 입력칸 이름 기준의 인라인 오류. 서버 필드 이름은 화면이 미리 옮겨 준다. */
  fieldErrors: Partial<Record<keyof CodeFormValues, string>>;
  /** 저장 실패·선택 목록 안내 배너 슬롯 */
  banner: ReactNode;
  /** null이면 코드 입력 가능 */
  codeLockReason: string | null;
  parentOptions: CodeOption[];
  /** null이 아니면 상위 선택칸을 잠그고 이 사유를 낸다(차단 R3의 1차 방어) */
  parentLockReason: string | null;
  isActive: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
}

/** 우 페인 — 코드 하나를 등록하거나 고치는 자리. 두 탭이 같은 부품을 쓴다. */
export const CodeFormPane = ({
  adapter,
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  parentOptions,
  parentLockReason,
  isActive,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
}: CodeFormPaneProps) => {
  const parentId = useId();
  const parentErrorId = `${parentId}-error`;
  const parentLockId = `${parentId}-lock`;
  const parentNoteId = `${parentId}-note`;
  const activeLabelId = useId();
  const deactivateNoteId = useId();

  const parentError = fieldErrors.parentId;
  const describedBy = [
    parentError === undefined ? null : parentErrorId,
    parentLockReason === null ? null : parentLockId,
    parentNoteId,
  ]
    .filter((id): id is string => id !== null)
    .join(' ');

  /*
   * 대분류는 되돌리기 어려운 축이다. 상위를 비운 채 등록하려 할 때만 경고한다 —
   * 수정이나 상세 등록에서는 만들어지는 것이 대분류가 아니다.
   */
  const showCategoryWarning = mode === 'create' && values.parentId === '';

  return (
    <section aria-label={adapter.labels.tab}>
      {banner}

      {showCategoryWarning && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.categoryWarning}</AlertBanner>
        </div>
      )}

      <div className="form-grid">
        <TextField
          label={adapter.labels.code}
          value={values.code}
          onChange={(event) => onChange({ code: event.target.value })}
          disabled={codeLockReason !== null}
          disabledReason={codeLockReason}
          error={fieldErrors.code}
        />

        <TextField
          label={adapter.labels.name}
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          error={fieldErrors.name}
        />

        {/*
         * 디자인 시스템 Select에는 label prop이 없다. 라벨을 직접 만들어 htmlFor로 이어야
         * 스크린리더 접근명과 테스트의 라벨 조회가 함께 성립한다(배치 규범 3).
         */}
        <div className="field-cell">
          <span className="field-label">
            <label htmlFor={parentId}>{adapter.labels.parent}</label>
          </span>
          <Select
            id={parentId}
            options={[{ value: '', label: t.values.noParent }, ...parentOptions]}
            value={values.parentId}
            onChange={(value) => onChange({ parentId: value })}
            disabled={parentLockReason !== null}
            invalid={parentError !== undefined}
            aria-describedby={describedBy}
          />
          {parentError !== undefined && (
            <span id={parentErrorId} className="field-error">
              {parentError}
            </span>
          )}
          {/*
           * 배치 규범 4 — 비활성 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더한다.
           * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 닿을 수 없다.
           */}
          {parentLockReason !== null && (
            <span id={parentLockId} className="field-note">
              {parentLockReason}
            </span>
          )}
          {/* 대분류 목록이 확정되기 전이라는 사실을 감추지 않는다. */}
          <span id={parentNoteId} className="field-note">
            {t.parentListProvisional}
          </span>
        </div>

        {/* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다. */}
        {mode === 'edit' && (
          <div className="field-cell">
            <span className="field-label" id={activeLabelId}>
              {t.fields.isActive}
            </span>
            <p aria-labelledby={activeLabelId}>{isActive ? t.values.active : t.values.inactive}</p>
            {/* 이미 미사용인 코드에는 중지할 대상이 없다. 감추지 않고 사유를 밝힌다(배치 규범 4). */}
            <Button
              variant="outlined"
              disabled={!isActive}
              aria-describedby={isActive ? undefined : deactivateNoteId}
              onClick={onDeactivate}
            >
              {messages.common.deactivate}
            </Button>
            {!isActive && (
              <span id={deactivateNoteId} className="field-note">
                {t.actionReasons.deactivateNeedsActive}
              </span>
            )}
          </div>
        )}
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
