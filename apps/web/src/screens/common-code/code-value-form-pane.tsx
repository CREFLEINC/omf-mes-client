import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { CodeLockLabel } from '../../patterns/master';
import { requiredEmptyClass } from '../users-roles/required-empty';
import type { CodeValueFormValues } from './code-value-types';
import { DateField } from './date-field';
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
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
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
  isDirty,
  isSaving,
  onSave,
  onCancel,
}: CodeValueFormPaneProps) => {
  const codeId = useId();
  const nameId = useId();
  const orderId = useId();

  const formGrid = (
    <div className="form-grid">
      {/*
       * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
       * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
       */}
      <div className="field-cell">
        {/* 잠긴 코드는 사유 문장 대신 칸 이름 오른쪽 「변경 불가」 라벨(사용자 지시 2026-11-24). */}
        <CodeLockLabel reason={codeLockReason} reasonId={`${codeId}-lock`}>
          <FieldLabel htmlFor={codeId} label={t.fields.code} required />
        </CodeLockLabel>
        <TextField
          id={codeId}
          value={values.code}
          placeholder={t.placeholders.code}
          onChange={(event) => onChange({ code: event.target.value })}
          disabled={codeLockReason !== null}
          aria-describedby={codeLockReason === null ? undefined : `${codeId}-lock`}
          /* 필수 칸이 비면 빨간 테두리 — 사용자 역할 화면과 같은 방식(#333). 잠긴 칸은 고칠 수 없어 뺀다. */
          containerClassName={codeLockReason === null ? requiredEmptyClass(values.code) : undefined}
          error={fieldErrors.code}
          aria-required
        />
      </div>

      <div className="field-cell">
        <FieldLabel htmlFor={nameId} label={t.fields.codeName} required />
        <TextField
          id={nameId}
          value={values.codeName}
          placeholder={t.placeholders.codeName}
          onChange={(event) => onChange({ codeName: event.target.value })}
          containerClassName={requiredEmptyClass(values.codeName)}
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
          placeholder={t.placeholders.displayOrder}
          onChange={(event) => onChange({ displayOrder: event.target.value })}
          containerClassName={requiredEmptyClass(values.displayOrder)}
          error={fieldErrors.displayOrder}
          aria-required
        />
      </div>

      {/*
       * 날짜 입력은 DS `DatePicker`다(변경 통지 #63).
       * 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다.
       */}
      <DateField
        label={t.fields.effectiveFrom}
        value={values.effectiveFrom}
        onChange={(effectiveFrom) => onChange({ effectiveFrom })}
        error={fieldErrors.effectiveFrom}
      />

      <DateField
        label={t.fields.effectiveTo}
        value={values.effectiveTo}
        onChange={(effectiveTo) => onChange({ effectiveTo })}
        error={fieldErrors.effectiveTo}
      />
    </div>
  );

  /*
   * 등록 · 수정 모두 팝업 — 사용자 추가 팝업과 같은 모양(등록 2026-11-25 · 수정 2026-11-26 사용자 지시 · #333).
   * 표 아래에 상세 · 편집 칸을 두지 않는다. 사용 중지는 표 줄의 [사용 중지]가 맡는다.
   * 열고 닫힘은 종전대로 바깥(등록은 주소의 등록 상태, 수정은 고른 줄)이 쥐고, 저장 단추의 막힘 조건(고친 것 없음 · 저장 중)도 그대로다.
   */
  return (
    <Dialog
      open
      onClose={onCancel}
      size="lg"
      title={mode === 'create' ? t.actions.add : t.actions.editTitle}
      closeOnBackdropClick={false}
      showCloseButton={false}
      footer={
        <>
          <Button variant="outlined" onClick={onCancel}>
            {messages.common.cancel}
          </Button>
          <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
            {mode === 'create' ? t.actions.add : messages.common.save}
          </Button>
        </>
      }
    >
      {banner}
      {formGrid}
    </Dialog>
  );
};
