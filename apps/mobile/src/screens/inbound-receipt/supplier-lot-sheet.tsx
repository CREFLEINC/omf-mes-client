import { Checkbox, Dialog, TextField } from '@crefle/web-ui';
import type { InboundLotDetail, InboundLotMaterialLot } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { Button } from '../../patterns/button';

const t = messages.inboundReceipt.sheet;

/** 공급사 LOT 번호 최대 길이(계약 §3 — 100자). */
export const SUPPLIER_LOT_MAX = 100;

export interface SupplierLotSheetProps {
  detail: InboundLotDetail;
  lot: InboundLotMaterialLot;
  saving: boolean;
  /** 서버가 400 `RANGE` 로 돌려준 칸 오류. */
  fieldError: string | null;
  onCancel: () => void;
  /** 저장 — 고칠 LOT 들과 값(빈 값이면 null = 지움). */
  onSave: (lotIds: number[], supplierLotNo: string | null) => void;
}

/**
 * 공급사 LOT 번호 시트(screens/M-01-01.md · plan 확인할 것 14) — 자재 관리 LOT 줄을 누르면 연다.
 *
 * ⭐ [저장]이 곧 서버 반영(`PATCH …/lots/supplier-lot-no`)이다 — 빈 값은 지움. 「나머지에도」를 고르면 이 카드의
 *    나머지 자재 관리 LOT 에 같은 번호를 넣는다(N : 1).
 */
export const SupplierLotSheet = ({
  detail,
  lot,
  saving,
  fieldError,
  onCancel,
  onSave,
}: SupplierLotSheetProps) => {
  const [value, setValue] = useState(lot.supplierLotNo ?? '');
  const [applyRest, setApplyRest] = useState(false);
  const rest = detail.lots.filter(
    (each) => each.lotId !== lot.lotId && each.lifecycleStatusCode !== 'WAITING',
  );
  const differing = rest.filter(
    (each) => each.supplierLotNo !== null && each.supplierLotNo !== value.trim(),
  ).length;
  const tooLong = value.trim().length > SUPPLIER_LOT_MAX;

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t.title}
      size="sm"
      className="receive-sheet"
      footer={
        <>
          <Button variant="outlined" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button
            loading={saving}
            disabled={tooLong}
            onClick={() => {
              const trimmed = value.trim();

              onSave(
                applyRest ? [lot.lotId, ...rest.map((each) => each.lotId)] : [lot.lotId],
                trimmed === '' ? null : trimmed,
              );
            }}
          >
            {t.save}
          </Button>
        </>
      }
    >
      <p className="receive-sheet__lot">{lot.lotNo}</p>
      <p className="receive-sheet__note">{t.status(detail.inboundLotNo)}</p>
      <TextField
        label={t.label}
        value={value}
        error={tooLong ? t.tooLong : (fieldError ?? undefined)}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
      {lot.fromSupplierLabel && lot.supplierLotNo !== null ? (
        <p className="receive-sheet__note">{t.prefilled}</p>
      ) : null}
      {rest.length === 0 ? null : (
        <Checkbox
          checked={applyRest}
          onChange={(event) => {
            setApplyRest(event.target.checked);
          }}
        >
          {t.applyRest(rest.length)}
          {applyRest && differing > 0 ? ` (${t.applyRestNote(differing)})` : ''}
        </Checkbox>
      )}
      <p className="receive-sheet__note">{t.note}</p>
    </Dialog>
  );
};
