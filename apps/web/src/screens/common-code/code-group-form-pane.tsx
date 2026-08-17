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
  /**
   * **막을 것 — 전역이다.** 이 화면의 코드그룹 저장은 한 번에 하나뿐이라(훅 하나에 요청 하나),
   * 다른 코드그룹의 저장이 나가는 중이면 여기서도 새 저장을 시작할 수 없다. 두 번째를 내면
   * 앞 저장의 무효화·성공·**실패**가 통째로 오지 않는다. 등록과 수정이 **한 저장 자리**를 쓰므로
   * 두 훅 중 하나라도 나가는 중이면 잠긴다.
   *
   * **입력칸은 잠그지 않는다.** 늦게 온 성공이 남의 폼을 덮지 않도록 상위가 대상을 견주므로,
   * 여기서 편집까지 막으면 기다리는 동안 아무것도 못 하게 된다.
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

  const saveLabel = mode === 'create' ? t.actions.addCodeGroup : messages.common.save;

  /* 사유 문면이 두 벌인 이유: 저장 자리의 **컨트롤 이름이 모드마다 다르고**, 문구는 그 이름으로 시작한다(배치 규범 4-5). */
  const saveLockedReason =
    mode === 'create'
      ? t.codeGroup.actionReasons.addLockedByOtherCodeGroup
      : t.codeGroup.actionReasons.saveLockedByOtherCodeGroup;

  /**
   * 저장 자리의 세 상태. **잠금에서 오는 비활성에는 반드시 사유가 붙는다**(배치 규범 4) —
   * 남의 저장이 왜 내 저장을 막는지는 이 구획 어디에도 드러나지 않아, 사유가 없으면
   * 사용자에게 「고장」으로 읽힌다.
   *
   * **셋째 갈래에는 사유를 두지 않는다.** 그 비활성은 잠김(남의 사정)이 아니라
   * **고친 것이 없음**(자기 사정)이라 원인이 사용자가 방금 한 일에 그대로 있다.
   * 형제 구획(자격)과 같은 갈래 순서이며, 자격의 셋째 갈래(중복 짝 차단)에 해당하는 사정이
   * 이 구획에는 없다 — 서버가 거부할 것을 미리 아는 자리가 없다.
   */
  const saveAction = (): ReactNode => {
    /* 내 저장이 나가는 중이면 진행 표시가 사유 자리를 대신한다. */
    if (isSaving) {
      return (
        <Button disabled loading>
          {saveLabel}
        </Button>
      );
    }

    /* 남의 저장이 나가는 중이다 — 잠그되 **무엇을 기다리는지** 밝힌다. */
    if (isLocked) {
      return <DisabledAction label={saveLabel} reason={saveLockedReason} />;
    }

    return (
      <Button disabled={!isDirty} onClick={onSave}>
        {saveLabel}
      </Button>
    );
  };

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

        {/*
         * 등록에서 「취소」는 **폼을 닫는 것**이라 고친 것이 없어도 눌러야 한다.
         * 수정에서는 **기준값으로 되돌리는 것**이라 고친 것이 있을 때만 의미가 있다.
         */}
        <Button variant="outlined" disabled={mode === 'edit' && !isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {saveAction()}
      </div>
    </section>
  );
};
