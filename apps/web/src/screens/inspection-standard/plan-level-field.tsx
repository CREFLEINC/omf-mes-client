import { TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { Select } from '../../patterns/select';
import { LEVEL_CODES } from '../inspection-level/level-dialog';
import { FieldLabel } from './field-label';

type ItemInspectionLevel = components['schemas']['ItemInspectionLevel'];
export type InspectionLevelCode = ItemInspectionLevel['inspectionLevelCode'];

const t = messages.inspectionStandard.itemLevel;
const levelNames = messages.inspectionLevel.levels;

/** 창에서 고른 검사 수준 · 사유. 고르지 않았으면(지금 수준 그대로) `null`. */
export interface LevelDraft {
  itemId: number;
  level: InspectionLevelCode;
  reason: string;
}

export interface PlanLevelFieldProps {
  itemId: number;
  /** 품목의 지금 수준 — 미지정이면 `null` */
  current: ItemInspectionLevel | null;
  status: 'pending' | 'error' | 'ready';
  /** 검사 수준 관리 권한(W-03-12)이 없으면 보기만 */
  canEdit: boolean;
  draft: LevelDraft | null;
  onChange: (next: LevelDraft | null) => void;
  /** 저장 실패 때 서버가 짚은 칸 오류 */
  fieldErrors: Record<string, string>;
}

/**
 * 「기본 정보 수정」 창의 「검사 수준」 칸(omf-all-around#357) — IQC 기준 · 품목이 있을 때만 선다.
 * 바꾸면 사유 칸(선택)이 나오고, 창의 「저장」이 기본 정보와 함께 저장한다. 미지정 품목은 「미지정」에서 고르면 지정이다.
 */
export const PlanLevelField = ({
  itemId,
  current,
  status,
  canEdit,
  draft,
  onChange,
  fieldErrors,
}: PlanLevelFieldProps) => {
  const levelId = useId();
  const reasonId = useId();
  const currentCode = current?.inspectionLevelCode ?? '';
  const value = draft?.level ?? currentCode;
  const isChanged = draft !== null && draft.level !== currentCode;

  const readOnlyText =
    status === 'pending'
      ? '…'
      : status === 'error'
        ? t.loadFailed
        : currentCode === ''
          ? t.unset
          : (levelNames[currentCode] ?? currentCode);

  return (
    <>
      <div className="field-cell inspection-standard-level-cell">
        {status === 'ready' && canEdit ? (
          <FieldLabel htmlFor={levelId} label={t.label} />
        ) : (
          <span className="field-label" id={levelId}>
            {t.label}
          </span>
        )}
        {status === 'ready' && canEdit ? (
          <Select
            id={levelId}
            options={[
              /* 미지정 품목만 「미지정」을 둔다 — 지정한 수준을 없애는 길은 없다(서버에 삭제가 없다). */
              ...(currentCode === '' ? [{ value: '', label: t.unset }] : []),
              ...LEVEL_CODES.map((code) => ({ value: code, label: levelNames[code] ?? code })),
            ]}
            value={value}
            onChange={(next) =>
              onChange(
                next === '' || next === currentCode
                  ? null
                  : { itemId, level: next as InspectionLevelCode, reason: draft?.reason ?? '' },
              )
            }
          />
        ) : (
          <p className="inspection-standard-plan-routing" aria-labelledby={levelId}>
            {readOnlyText}
          </p>
        )}
        {fieldErrors.inspectionLevelCode !== undefined && (
          <span className="field-error">{fieldErrors.inspectionLevelCode}</span>
        )}
      </div>
      {isChanged && (
        <div className="field-cell inspection-standard-level-reason">
          <FieldLabel htmlFor={reasonId} label={t.reason} />
          <TextField
            id={reasonId}
            fullWidth
            placeholder={t.reasonPlaceholder}
            value={draft.reason}
            maxLength={500}
            onChange={(event) => onChange({ ...draft, reason: event.target.value })}
            error={fieldErrors.reason || undefined}
          />
        </div>
      )}
    </>
  );
};
