import { AlertBanner, Button, Chip, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { Select } from '../../patterns/select';
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

/** 필수 표시 — 다른 화면과 같은 빨간 `*`(#208). 접근성 이름에 섞이지 않게 숨긴다. */
const RequiredMark = () => (
  <span className="required-mark" aria-hidden="true">
    {' '}
    *
  </span>
);

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
  const codeId = useId();
  const nameId = useId();
  const parentId = useId();
  const parentErrorId = `${parentId}-error`;
  const parentLockId = `${parentId}-lock`;
  const parentNoteId = `${parentId}-note`;
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

  /*
   * 비어 있는 필수 칸은 처음부터 테두리만 빨갛게 한다 — 「필수 입력 항목입니다」 글은 화면에 띄우지 않고
   * 화면 읽기로만 남긴다(검사 기준 탭과 같다 · #208). 다른 오류(중복 · 공백만)는 글로 낸다.
   */
  const requiredMessage = t.validation.required;
  const requiredText = (error: string | undefined, value: string) => {
    if (error !== undefined && error !== requiredMessage) return { error };
    return value.trim() === ''
      ? { error: requiredMessage, containerClassName: 'inspection-standard-border-only' }
      : {};
  };

  return (
    <section className="defect-cause-form" aria-label={t.panes.form(adapter.labels.tab)}>
      {/* 제목 · 사용 상태 칩을 한 줄에, 오른쪽 끝에 사용 중지(검사 기준 탭 상세 머리와 같다 · #208). */}
      <div className="defect-cause-form-head">
        <div className="defect-cause-form-title">
          <h2 className="pane-title">{t.panes.form(adapter.labels.tab)}</h2>
          {mode === 'edit' && (
            <Chip variant="status" status={isActive ? 'success' : 'idle'}>
              {isActive ? t.values.active : t.values.inactive}
            </Chip>
          )}
        </div>
        {mode === 'edit' && (
          /*
           * 이미 미사용인 코드에는 중지할 대상이 없다. 감추지 않고 사유를 잇는다(배치 규범 4) —
           * 글은 줄을 늘리지 않게 감추고 마우스를 올리면 보인다(#208).
           */
          <span
            className="defect-cause-reason"
            title={isActive ? undefined : t.actionReasons.deactivateNeedsActive}
          >
            <Button
              variant="outlined"
              leadingIcon={<Icon name="block" size={18} />}
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
          </span>
        )}
      </div>
      {banner}

      {showCategoryWarning && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.categoryWarning}</AlertBanner>
        </div>
      )}

      {/* 코드는 짧게 · 명칭은 넓게 한 줄, 상위 대분류는 다음 줄(#208 — 칸 폭을 값 길이에 맞춘다). */}
      <div className="form-grid defect-cause-form-grid">
        <div className="field-cell">
          <span className="field-label">
            <label htmlFor={codeId}>{adapter.labels.code}</label>
            <RequiredMark />
          </span>
          <TextField
            id={codeId}
            value={values.code}
            placeholder={t.placeholders.code}
            onChange={(event) => onChange({ code: event.target.value })}
            disabled={codeLockReason !== null}
            disabledReason={codeLockReason}
            aria-required
            /* 잠긴 칸은 사유를 보여야 한다 — 필수 표시 테두리로 그 글을 가리지 않는다. */
            {...(codeLockReason === null ? requiredText(fieldErrors.code, values.code) : {})}
          />
        </div>

        <div className="field-cell">
          <span className="field-label">
            <label htmlFor={nameId}>{adapter.labels.name}</label>
            <RequiredMark />
          </span>
          <TextField
            id={nameId}
            value={values.name}
            placeholder={t.placeholders.name}
            onChange={(event) => onChange({ name: event.target.value })}
            aria-required
            {...requiredText(fieldErrors.name, values.name)}
          />
        </div>

        {/*
         * 디자인 시스템 Select에는 label prop이 없다. 라벨을 직접 만들어 htmlFor로 이어야
         * 스크린리더 접근명과 테스트의 라벨 조회가 함께 성립한다(배치 규범 3).
         */}
        <div className="field-cell defect-cause-parent">
          <span className="field-label">
            <label htmlFor={parentId}>{adapter.labels.parent}</label>
          </span>
          {/* 「DF-20 · 치수」 정도의 값이라 칸 폭을 줄인다(#208). */}
          <div className="defect-cause-parent-select">
            <Select
              id={parentId}
              options={[{ value: '', label: t.values.noParent }, ...parentOptions]}
              value={values.parentId}
              onChange={(value) => onChange({ parentId: value })}
              disabled={parentLockReason !== null}
              invalid={parentError !== undefined}
              aria-describedby={describedBy}
            />
          </div>
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
      </div>

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>
        <Button
          variant="filled"
          disabled={!isDirty || isSaving}
          loading={isSaving}
          onClick={onSave}
        >
          {messages.common.save}
        </Button>
      </div>
    </section>
  );
};
