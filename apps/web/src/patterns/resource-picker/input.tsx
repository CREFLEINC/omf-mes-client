import { SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { ResourcePickerDialog } from './dialog';
import type { ResourceKind, ResourceRow } from './queries';

const t = messages.resourcePicker;

export interface ResourcePickerInputProps {
  id: string;
  kind: ResourceKind;
  plantId: number | null;
  /** 설비만 — 주면 창이 그 라인의 설비만 보인다 */
  lineId?: number | null;
  /** 고른 값의 「코드 · 이름」. 비었으면 빈 칸이다 */
  valueLabel: string;
  disabled?: boolean;
  'aria-describedby'?: string;
  onPick: (row: ResourceRow) => void;
  onClear: () => void;
}

/**
 * 설비·금형 한 칸. 칸은 읽기 전용이고 누르거나 엔터를 치면 찾기 창이 열린다 — 4M 담당 작업자 칸과 같다.
 * 라벨·오류 줄은 부르는 화면이 그린다(화면마다 필수 표시 방식이 다르다).
 */
export const ResourcePickerInput = ({
  id,
  kind,
  plantId,
  lineId = null,
  valueLabel,
  disabled = false,
  'aria-describedby': describedBy,
  onPick,
  onClear,
}: ResourcePickerInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = (): void => {
    if (!disabled) setIsOpen(true);
  };

  return (
    <>
      <SearchInput
        id={id}
        containerClassName="work-order-worker-field"
        value={valueLabel}
        readOnly
        title={valueLabel === '' ? undefined : valueLabel}
        placeholder={t.open}
        aria-haspopup="dialog"
        aria-describedby={describedBy}
        clearLabel={t.clear[kind]}
        disabled={disabled}
        onClick={open}
        onSearch={open}
        onChange={() => undefined}
        onClear={onClear}
      />
      {isOpen && (
        <ResourcePickerDialog
          kind={kind}
          plantId={plantId}
          lineId={lineId}
          onClose={() => setIsOpen(false)}
          onConfirm={(row) => {
            onPick(row);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
};
