import { Button, Checkbox, Dialog, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import { OPERATION_FLAG_KEYS } from './operation-order';
import type { OperationDraft, SelectOption } from './types';

const t = messages.routing;

export interface OperationFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  values: OperationDraft;
  onChange: (patch: Partial<OperationDraft>) => void;
  fieldErrors: Record<string, string>;
  /** 「사용 중인 것 + 지금 고른 값」만 온다. 목록을 고르는 규칙은 화면이 갖는다. */
  processOptions: SelectOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * 디자인 시스템 `Select`에는 `label` prop이 없다(배치 규범 3).
 * 라벨을 직접 만들되 내장 라벨과 같은 토큰을 써 라벨 층 높이를 맞춘다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
interface ProcessSelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const ProcessSelectField = ({ label, options, value, onChange, error }: ProcessSelectFieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="field-cell">
      <FieldLabel htmlFor={id} label={label} required />
      <Select
        id={id}
        options={options}
        value={value === '' ? null : value}
        onChange={onChange}
        invalid={error !== undefined}
        aria-required
        aria-describedby={error === undefined ? undefined : errorId}
      />
      {error !== undefined && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
};

/**
 * 공정 라인 한 행의 전체 편집.
 *
 * **표에는 아이콘·요약만 두고 전체 편집을 이 창에서 한다** — 관리 플래그가 7개라
 * 열로 펼치면 보조기술에서 의미가 잡히지 않고 열이 화면 폭을 먹는다.
 *
 * **이 창의 확인은 서버 저장이 아니다.** 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않으므로,
 * 확인은 표(로컬 초안)에만 반영하고 서버 반영은 「저장」 한 번뿐이다(공유계약 A-5).
 * 그 사실을 창 안에서 밝힌다 — 밝히지 않으면 확인을 누르고 창을 닫은 사용자가 저장된 줄 안다.
 */
export const OperationFormDialog = ({
  open,
  mode,
  values,
  onChange,
  fieldErrors,
  processOptions,
  isSubmitting,
  onClose,
  onSubmit,
}: OperationFormDialogProps) => {
  const operationNameId = useId();
  const outsourcedNoteId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'create' ? t.dialog.operationCreateTitle : t.dialog.operationEditTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSubmitting} disabled={isSubmitting} onClick={onSubmit}>
            {messages.common.confirm}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <ProcessSelectField
          label={t.fields.process}
          options={processOptions}
          value={values.processId}
          onChange={(processId) => onChange({ processId })}
          error={fieldErrors.processId}
        />

        {/*
         * 공정명도 필수다 — 표시를 빼면 같은 창 안에서 공정(필수 표시 있음)과 규칙이 어긋난다.
         * 디자인 시스템 내장 라벨에는 표시를 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={operationNameId} label={t.fields.operationName} required />
          <TextField
            id={operationNameId}
            value={values.operationName}
            onChange={(event) => onChange({ operationName: event.target.value })}
            error={fieldErrors.operationName}
            aria-required
          />
        </div>

        {/* 단위는 초이며 0은 불가다(계약 CHECK > 0). 라벨이 그 사실을 담는다. */}
        <TextField
          type="number"
          min={1}
          label={t.fields.standardCycleTimeSec}
          value={values.standardCycleTimeSec}
          onChange={(event) => onChange({ standardCycleTimeSec: event.target.value })}
          error={fieldErrors.standardCycleTimeSec}
        />

        {/* 0~1 비율이다. 퍼센트로 보이면서 비율로 저장하면 100배 오입력이 조용히 통과한다. */}
        <TextField
          type="number"
          min={0}
          max={1}
          step={0.01}
          label={t.fields.standardYieldRate}
          value={values.standardYieldRate}
          onChange={(event) => onChange({ standardYieldRate: event.target.value })}
          error={fieldErrors.standardYieldRate}
        />
      </div>

      <div className="check-group">
        {OPERATION_FLAG_KEYS.map((key) => (
          <Checkbox
            key={key}
            checked={values[key]}
            onChange={(event) => onChange({ [key]: event.target.checked })}
          >
            {t.operationFlags[key]}
          </Checkbox>
        ))}

        {/*
         * 계약에 저장할 자리가 없다. 감추면 사용자가 「이 화면에는 없는 항목」으로 오해하고
         * 다른 곳을 찾는다 — 감추지 않고 사유와 함께 비활성으로 둔다(배치 규범 4).
         * 저장 본문에도 넣지 않는다(operation-order.ts).
         */}
        <div className="field-cell">
          <Checkbox checked={false} disabled aria-describedby={outsourcedNoteId} readOnly>
            {t.fields.outsourced}
          </Checkbox>
          <span id={outsourcedNoteId} className="field-note">
            {t.actionReasons.outsourcedUnavailable}
          </span>
        </div>
      </div>

      <p className="field-note">{t.dialog.operationLocalNote}</p>
    </Dialog>
  );
};
