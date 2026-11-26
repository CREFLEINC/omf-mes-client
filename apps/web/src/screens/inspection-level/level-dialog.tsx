import { Button, Dialog, TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import type { ItemRow } from '../../patterns/item-picker';
import { Select } from '../../patterns/select';

type InspectionLevelCode = components['schemas']['ItemInspectionLevel']['inspectionLevelCode'];

const t = messages.inspectionLevel;

export const LEVEL_CODES: readonly InspectionLevelCode[] = [
  'NONE',
  'REDUCED',
  'NORMAL',
  'TIGHTENED',
];

export interface LevelDialogValues {
  itemId: number;
  level: InspectionLevelCode;
  reason: string;
}

export interface LevelDialogProps {
  /** 수준을 지정할 품목 — IQC 상세의 검사 대상 품목(omf-all-around#133). 자동 전환은 없다. */
  item: Pick<ItemRow, 'itemId' | 'itemCode' | 'itemName'>;
  /** 서버가 돌려준 칸 오류. 로컬 검증 결과가 덮는다 */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: LevelDialogValues) => void;
}

/** 필수 표시 — 다른 화면과 같은 빨간 `*`(#208). 접근성 이름에 섞이지 않게 숨긴다. */
const RequiredMark = () => (
  <span className="required-mark" aria-hidden="true">
    {' '}
    *
  </span>
);

/** 검사 수준 지정 창 — 수준이 없는 품목에만 연다(변경은 검사 기준 관리 · #357). 사유는 선택이고 넣으면 이력에 남는다(omf-all-around#133). */
export const LevelDialog = ({
  item,
  fieldErrors,
  banner,
  isSaving,
  onClose,
  onSave,
}: LevelDialogProps) => {
  const levelId = useId();
  const reasonId = useId();
  const [level, setLevel] = useState<InspectionLevelCode>('NORMAL');
  const [reason, setReason] = useState('');

  const save = () => onSave({ itemId: item.itemId, level, reason: reason.trim() });

  return (
    <Dialog
      open
      onClose={onClose}
      /* 닫기는 [취소]로 — 우상단 × 를 두지 않는다(#133). Esc · 바깥 누름은 그대로 [취소]와 같다. */
      showCloseButton={false}
      title={t.dialog.addTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button disabled={isSaving} loading={isSaving} onClick={save}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}

      {/* 품목 · 검사 수준 · 사유를 한 열로 — 위에서 아래로 읽고 고른다(#133). */}
      <div className="form-grid inspection-level-form">
        <div className="field-cell">
          <span className="field-label">{t.dialog.itemCode}</span>
          {/* 품목은 이 창의 대상이라 값을 한 단계 크게(#133). 품목코드 · 품목명 두 칸으로 나눠 보인다(#358). */}
          <p className="inspection-level-form-item">{item.itemCode}</p>
          {fieldErrors.itemId && <span className="field-error">{fieldErrors.itemId}</span>}
        </div>
        <div className="field-cell">
          <span className="field-label">{t.dialog.itemName}</span>
          <p className="inspection-level-form-item">{item.itemName}</p>
        </div>

        <div className="field-cell">
          <span className="field-label">
            <label htmlFor={levelId}>{t.dialog.level}</label>
            <RequiredMark />
          </span>
          <Select
            id={levelId}
            options={LEVEL_CODES.map((code) => ({ value: code, label: t.levels[code] ?? code }))}
            value={level}
            onChange={(value) => setLevel(value as InspectionLevelCode)}
          />
          {fieldErrors.inspectionLevelCode && (
            <span className="field-error">{fieldErrors.inspectionLevelCode}</span>
          )}
        </div>

        <div className="field-cell">
          <label className="field-label" htmlFor={reasonId}>
            {t.dialog.reason}
          </label>
          <TextField
            id={reasonId}
            fullWidth
            placeholder={t.dialog.reasonPlaceholder}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            error={fieldErrors.reason || undefined}
          />
        </div>
      </div>
    </Dialog>
  );
};
