import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import type { CodeValueFormValues } from './code-value-types';
import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';

const t = messages.commonCode.codeValue;

export type CodeValueFormMode = 'create' | 'edit';

export interface CodeValueFormPaneProps {
  /** `create`면 아직 없는 코드값을 만드는 폼이다 — 사용 중지가 없고 주 액션이 등록이다. */
  mode: CodeValueFormMode;
  values: CodeValueFormValues;
  onChange: (patch: Partial<CodeValueFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /** null이면 코드를 편집할 수 있다. */
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
 * 우 칸 아래 — 코드값 정보.
 *
 * **정렬 순서는 이 폼의 숫자 칸 하나다.** 표에 순서 이동 버튼을 두지 않는다 —
 * 저장이 행 단위라 한 번의 이동이 여러 행을 바꾸면 각 행이 자기 잠금 토큰을 요구한다.
 *
 * ⚠ 수신본 편집 잠금이 서버에서 강제되지 않는다.
 *    수신본을 판정할 컬럼이 아직 없어(omf-mes#65) 이 자원은 잠정적으로 전 필드 편집 가능으로
 *    열려 있다. 화면은 서버가 주는 편집 가능 여부만 읽고 스스로 잠그지 않는다 —
 *    화면이 먼저 잠그면 컬럼이 생겨 서버가 잠금을 열어 줄 때 화면만 잠긴 채 남는다.
 *    컬럼이 생기면 서버가 그 값으로 잠그고 이 주석을 걷는다.
 *
 * 코드값 편집 한 벌의 부품이다 — 다른 자원의 부품·타입·주소를 참조하지 않는다.
 */
export const CodeValueFormPane = ({
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
}: CodeValueFormPaneProps) => {
  const codeId = useId();
  const nameId = useId();
  const orderId = useId();
  const fromId = useId();
  const toId = useId();

  return (
    <section className="pane" aria-label={t.formPaneTitle}>
      {banner}

      <div className="form-grid">
        {/*
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={codeId} label={t.fields.code} required />
          <TextField
            id={codeId}
            value={values.code}
            onChange={(event) => onChange({ code: event.target.value })}
            disabled={codeLockReason !== null}
            disabledReason={codeLockReason}
            error={fieldErrors.code}
            aria-required
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={nameId} label={t.fields.codeName} required />
          <TextField
            id={nameId}
            value={values.codeName}
            onChange={(event) => onChange({ codeName: event.target.value })}
            error={fieldErrors.codeName}
            aria-required
          />
        </div>

        {/* 하한을 두지 않는다 — 계약에 하한이 없어 음수도 허용값이다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={orderId} label={t.fields.displayOrder} required />
          <TextField
            id={orderId}
            type="number"
            step={1}
            value={values.displayOrder}
            onChange={(event) => onChange({ displayOrder: event.target.value })}
            error={fieldErrors.displayOrder}
            aria-required
          />
        </div>

        {/* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={fromId} label={t.fields.effectiveFrom} />
          <TextField
            id={fromId}
            type="date"
            value={values.effectiveFrom}
            onChange={(event) => onChange({ effectiveFrom: event.target.value })}
            error={fieldErrors.effectiveFrom}
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={toId} label={t.fields.effectiveTo} />
          <TextField
            id={toId}
            type="date"
            value={values.effectiveTo}
            onChange={(event) => onChange({ effectiveTo: event.target.value })}
            error={fieldErrors.effectiveTo}
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

        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {mode === 'create' ? t.actions.add : messages.common.save}
        </Button>
      </div>
    </section>
  );
};
