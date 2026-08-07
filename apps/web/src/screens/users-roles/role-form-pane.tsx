import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { codeLockMessage, type Editability } from '../../patterns/master';
import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import type { RoleFormValues } from './types';

const t = messages.usersRoles;

export type RoleFormMode = 'create' | 'edit';

export interface RoleFormPaneProps {
  /** `create`면 아직 없는 역할을 만드는 폼이다 — 사용 중지가 없고 주 액션이 등록이다. */
  mode: RoleFormMode;
  values: RoleFormValues;
  onChange: (patch: Partial<RoleFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /**
   * 상세 응답이 함께 준 코드 편집 가능 여부. **등록에는 없다**(아직 자원이 없다).
   *
   * 이 값을 그대로 받는 것이 중요하다 — 잠금 문구까지 상위가 만들어 넘기면
   * 「무엇이 판정의 주인인가」가 이 부품 밖으로 흩어진다.
   */
  editability: Editability | null;
  /** null이면 사용 중지를 누를 수 있다. 값이 있으면 그것이 비활성 사유다. */
  deactivateDisabledReason: string | null;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
}

/**
 * 우 칸 위쪽 — 역할 정보.
 *
 * **역할 코드는 입력칸이다.** 로그인 ID와 갈리는 자리다 — 계약의 수정 본문에 그 키가 있고
 * 참조 건수를 셀 수 있어 잠금 판정이 정상으로 내려온다(계획 결정 10).
 *
 * **판정의 주인은 `editability.codeEditable`이다.** `reason`은 문구 선택에만 쓴다 —
 * `codeEditable=false`인데 `reason=EDITABLE`인 어긋난 조합이 실제로 내려오며, `reason`을 따라
 * 읽으면 잠겨야 하는 칸이 열려 사용자가 고친 값이 저장 시점에야 거부된다.
 * 그 규칙의 정본은 `patterns/master`의 `codeLockMessage`이고 여기서는 그것을 부르기만 한다.
 *
 * **사용 여부를 입력칸으로 두지 않는다.** 전용 액션(`:deactivate`)으로만 바뀌므로
 * 입력칸을 두면 저장 본문에 실릴 여지가 생긴다.
 */
export const RoleFormPane = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  editability,
  deactivateDisabledReason,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
}: RoleFormPaneProps) => {
  const roleCodeId = useId();
  const roleNameId = useId();
  const descriptionId = useId();
  const saveLabel = mode === 'create' ? t.actions.addRole : messages.common.save;

  /* 등록에는 잠글 대상이 없다 — 아직 만들어지지 않은 자원이라 상세도 `editability`도 없다. */
  const codeLockReason = editability === null ? null : codeLockMessage(editability);

  return (
    <section className="pane" aria-label={t.panes.roleForm}>
      {banner}

      <div className="form-grid">
        {/*
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         * 비활성 사유는 **`TextField`가 내장으로 다룬다** — 항상 보이는 DOM 텍스트로 렌더하고
         * `aria-describedby`로 잇는다(배치 규범 4의 이탈 조건: 디자인 시스템이 이미 처리한다).
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={roleCodeId} label={t.role.fields.roleCode} required />
          <TextField
            id={roleCodeId}
            value={values.roleCode}
            onChange={(event) => onChange({ roleCode: event.target.value })}
            error={fieldErrors.roleCode}
            disabled={codeLockReason !== null}
            disabledReason={codeLockReason ?? undefined}
            aria-required
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={roleNameId} label={t.role.fields.roleName} required />
          <TextField
            id={roleNameId}
            value={values.roleName}
            onChange={(event) => onChange({ roleName: event.target.value })}
            error={fieldErrors.roleName}
            aria-required
          />
        </div>

        {/* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={descriptionId} label={t.role.fields.description} />
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

        {/*
         * 고친 것이 없으면 주 액션을 **비활성 + 사유**로 둔다(배치 규범 4) —
         * 사유가 없으면 사용자는 버튼이 왜 안 눌리는지 알 방법이 없다.
         * 저장 중에는 진행 표시가 그 자리를 대신하므로 사유를 내지 않는다.
         */}
        {isDirty || isSaving ? (
          <Button disabled={isSaving} loading={isSaving} onClick={onSave}>
            {saveLabel}
          </Button>
        ) : (
          <DisabledAction
            variant="filled"
            label={saveLabel}
            reason={mode === 'create' ? t.actionReasons.addRoleNoInput : t.actionReasons.saveNoChanges}
          />
        )}
      </div>
    </section>
  );
};
