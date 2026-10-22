import { SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useSupplierOptions } from './reference-lookup';
import { SupplierPickerDialog } from './supplier-picker-dialog';

const t = messages.iqcInspection.filters;

interface SupplierFilterFieldProps {
  /** 고른 거래처 번호. 비면 「전체」. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * 공급사 조건 — 품목 조건(`item-filter-field.tsx`)처럼 **검색 창으로 찾아 고른다**(#133).
 * 읽기 전용 검색 입력을 누르거나 엔터를 치면 창이 열리고, 지우기는 값이 있을 때만 칸 안의 × 다.
 *
 * 고른 값의 이름은 종전 선택지 목록(`useSupplierOptions`)으로 푼다 — 주소로 들어온 값도 이름이 선다.
 */
export const SupplierFilterField = ({ value, onChange }: SupplierFilterFieldProps) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const suppliers = useSupplierOptions();
  const label =
    value === ''
      ? ''
      : (suppliers.options.find((option) => option.value === value)?.label ?? value);
  const open = (): void => setIsPickerOpen(true);

  return (
    <>
      <SearchInput
        label={t.supplier}
        value={label}
        readOnly
        title={label === '' ? undefined : label}
        placeholder={t.supplierPlaceholder}
        aria-haspopup="dialog"
        clearLabel={t.supplierClear}
        onClick={open}
        onSearch={open}
        onChange={() => undefined}
        onClear={() => {
          onChange('');
        }}
      />
      {isPickerOpen && (
        <SupplierPickerDialog
          onClose={() => {
            setIsPickerOpen(false);
          }}
          onConfirm={(partner) => {
            onChange(String(partner.partnerId));
            setIsPickerOpen(false);
          }}
        />
      )}
    </>
  );
};
