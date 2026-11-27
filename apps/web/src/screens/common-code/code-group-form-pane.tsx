import { Button, Dialog, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { CodeLockLabel, LockedFieldIcon } from '../../patterns/master';
import { requiredEmptyClass } from '../users-roles/required-empty';
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
  /**
   * **막을 것 — 전역이다.** 이 화면의 코드그룹 저장은 한 번에 하나뿐이라(훅 하나에 요청 하나),
   * 다른 코드그룹의 저장이 나가는 중이면 여기서도 새 저장을 시작할 수 없다. 두 번째를 내면
   * 앞 저장의 무효화·성공·**실패**가 통째로 오지 않는다. 등록과 수정이 **한 저장 자리**를 쓰므로
   * 두 훅 중 하나라도 나가는 중이면 잠긴다.
   *
   * **입력칸은 잠그지 않는다.** 늦게 온 성공이 **남의** 폼을 덮지 않도록 상위가 대상을 견주므로,
   * 남의 저장을 기다리는 동안 편집을 막을 이유가 없다. 다만 **자기 저장 중의 편집은 그 성공이
   * 서버 값으로 덮는다** — 구획 전체를 잠가 그 갈래를 아예 닫는 자격 구획과 갈리는 자리다
   * (D-6·D-7 · 입력칸마다 사유를 붙이는 비용을 치르지 않기로 한 판단이다).
   */
  isLocked: boolean;
  /**
   * **가릴 것 — 지금 이 구획의 저장인가.** 진행 표시는 자기 저장에만 돈다 —
   * 남의 저장으로 스피너를 돌리면 화면이 손댄 적 없는 코드그룹을 「저장 중」이라고 말한다.
   */
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
  isLocked,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
}: CodeGroupFormPaneProps) => {
  const codeId = useId();
  const nameId = useId();
  const descriptionId = useId();

  /* 저장 자리 이름 — 등록 팝업은 「추가」 이름, 수정은 「저장」. */
  const saveLabel = mode === 'create' ? t.actions.addCodeGroup : messages.common.save;

  /** 저장 자리. 잠긴 까닭을 단추 아래 문구로 내지 않는다 — 꺼진 단추로만(사용자 지시 2026-11-25). */
  const saveAction = (): ReactNode => {
    /* 내 저장이 나가는 중이면 진행 표시가 사유 자리를 대신한다. */
    if (isSaving) {
      return (
        <Button disabled loading>
          {saveLabel}
        </Button>
      );
    }

    /* 남의 저장이 나가는 중이다 — 잠그기만 한다. 저장 단추 아래 사유 문구는 두지 않는다(사용자 지시 2026-11-25). */
    if (isLocked) {
      return <Button disabled>{saveLabel}</Button>;
    }

    return (
      <Button disabled={!isDirty} onClick={onSave}>
        {saveLabel}
      </Button>
    );
  };

  const formGrid = (
    <div className="form-grid">
      {/*
       * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
       * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
       */}
      <div className="field-cell">
        {/* 잠긴 코드는 사유 문장 대신 칸 이름 오른쪽 「변경 불가」 라벨(사용자 지시 2026-11-24). */}
        <CodeLockLabel reason={codeLockReason} reasonId={`${codeId}-lock`}>
          <FieldLabel htmlFor={codeId} label={t.codeGroup.fields.groupCode} required />
        </CodeLockLabel>
        <TextField
          id={codeId}
          value={values.groupCode}
          placeholder={t.codeGroup.placeholders.groupCode}
          onChange={(event) => onChange({ groupCode: event.target.value })}
          disabled={codeLockReason !== null}
          trailingIcon={
            codeLockReason === null ? undefined : <LockedFieldIcon reason={codeLockReason} />
          }
          aria-describedby={codeLockReason === null ? undefined : `${codeId}-lock`}
          /* 필수 칸이 비면 빨간 테두리 — 사용자 역할 화면과 같은 방식(#333). 잠긴 칸은 고칠 수 없어 뺀다. */
          containerClassName={
            codeLockReason === null ? requiredEmptyClass(values.groupCode) : undefined
          }
          error={fieldErrors.groupCode}
          aria-required
        />
      </div>

      <div className="field-cell">
        <FieldLabel htmlFor={nameId} label={t.codeGroup.fields.groupName} required />
        <TextField
          id={nameId}
          value={values.groupName}
          placeholder={t.codeGroup.placeholders.groupName}
          onChange={(event) => onChange({ groupName: event.target.value })}
          containerClassName={requiredEmptyClass(values.groupName)}
          error={fieldErrors.groupName}
          aria-required
        />
      </div>

      {/* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다. 설명은 줄 전체 폭(사용자 지시 2026-11-25). */}
      <div className="field-cell form-grid-full">
        <FieldLabel htmlFor={descriptionId} label={t.codeGroup.fields.description} />
        <TextField
          id={descriptionId}
          value={values.description}
          placeholder={t.codeGroup.placeholders.description}
          onChange={(event) => onChange({ description: event.target.value })}
          error={fieldErrors.description}
        />
      </div>
    </div>
  );

  /*
   * 등록은 팝업 — 사용자 추가 팝업과 같은 모양(사용자 지시 2026-11-25 · #333). 열고 닫힘은 종전대로 주소의 등록 상태가
   * 쥐고, 닫기(취소)는 등록 폼을 접는 같은 처리로 간다. 저장 자리 세 상태(진행 · 잠금 · 고친 것 없음)도 그대로다.
   */
  if (mode === 'create') {
    return (
      <Dialog
        open
        onClose={onCancel}
        size="lg"
        title={t.actions.addCodeGroup}
        closeOnBackdropClick={false}
        showCloseButton={false}
        footer={
          <>
            <Button variant="outlined" onClick={onCancel}>
              {messages.common.cancel}
            </Button>
            {saveAction()}
          </>
        }
      >
        {banner}
        {formGrid}
      </Dialog>
    );
  }

  return (
    <section className="pane" aria-label={t.panes.codeGroupForm}>
      {/*
       * 사용자 관리 상세와 같은 머리 — 제목 줄 오른쪽에 「사용 중지」(사용자 지시 2026-11-24). 폼 값 저장과 따로 서버에
       * 바로 나가는 작업이라 아래 「취소 · 저장」과 떨어져 선다.
       */}
      <div className="pane-heading-row users-roles-heading">
        <h3 className="pane-title">{t.panes.codeGroupForm}</h3>
        <div className="users-roles-account-actions">
          <Button
            variant="outlined"
            size="sm"
            disabled={deactivateDisabledReason !== null}
            title={deactivateDisabledReason ?? undefined}
            leadingIcon={<Icon name="block" size={18} />}
            onClick={onDeactivate}
          >
            {messages.common.deactivate}
          </Button>
        </div>
      </div>
      {banner}

      {formGrid}

      <div className="form-actions">
        {/* 수정에서 「취소」는 **기준값으로 되돌리는 것**이라 고친 것이 있을 때만 의미가 있다. */}
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {saveAction()}
      </div>
    </section>
  );
};
