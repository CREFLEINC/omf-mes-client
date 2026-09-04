import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

const t = messages.returnReceipt;

export interface DirectLotEntryProps {
  isSearching: boolean;
  /** 마지막 찾기의 결과 문구 — 못 찾음 · 이미 있음 · 실패. 찾았으면 비운다 */
  message: string | undefined;
  isLocked: boolean;
  onFind: (lotNo: string) => void;
}

/**
 * 원 출하 없이 등록 — LOT 번호를 정확히 적어 줄을 더한다.
 *
 * 품목·단위는 LOT 이 정하고, 원 출하 수량은 모르므로 반품 수량에 상한이 없다. 그 사실을 칸 옆에 상시 둔다.
 */
export const DirectLotEntry = ({ isSearching, message, isLocked, onFind }: DirectLotEntryProps) => {
  const [lotNo, setLotNo] = useState('');
  const trimmed = lotNo.trim();
  const find = (): void => {
    if (trimmed === '' || isSearching || isLocked) return;
    onFind(trimmed);
  };

  return (
    <div className="return-receipt-lot-entry">
      <TextField
        label={t.lot.label}
        value={lotNo}
        placeholder={t.lot.placeholder}
        fullWidth
        disabled={isLocked}
        error={message}
        helperText={isSearching ? t.lot.searching : t.lot.help}
        onChange={(event) => setLotNo(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') find();
        }}
      />
      <div className="field-cell field-cell-unlabeled">
        <Button
          variant="outlined"
          disabled={trimmed === '' || isSearching || isLocked}
          onClick={find}
        >
          {t.actions.findLot}
        </Button>
      </div>
    </div>
  );
};
