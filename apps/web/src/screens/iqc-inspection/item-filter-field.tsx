import { SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { ItemPickerDialog } from '../../patterns/item-picker';
import { useItemNames } from './reference-lookup';

const t = messages.iqcInspection.filters;

interface ItemFilterFieldProps {
  /** 고른 품목 번호. 비면 「전체」. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * 품목 조건 — **검색해서 고른다.**
 *
 * ⛔ **번호를 치라고 하지 않는다.** 종전에는 「품목 번호로 검색」 칸에 `inputMode="numeric"` 으로
 *    내부 번호를 받았다 — 품목 `12588` 을 외우는 검사자는 없다(omf-all-around#40).
 * ⛔ **선택칸으로도 못 담는다.** 품목 마스터가 9,269건이라 한 쪽에 들어가지 않는다 — 공용
 *    「품목 선택」 창이 바로 그 문제를 위해 선 자리다.
 *
 * ⭐ 칸 하나가 검색 묶음이다 — 읽기 전용 검색 입력을 누르거나 엔터를 치면 창이 열리고,
 *    지우기는 값이 있을 때만 칸 안의 × 로 낮춰 둔다(`W-03-02` 의 같은 자리와 같은 모양).
 *
 * 고른 품목의 이름은 **품목 상세로 푼다** — 주소로 들어와 창을 거치지 않은 값도 이름이 선다.
 * 지난 의뢰를 찾는 조건이라 사용 중지 품목까지 찾고(`includeInactive`), 가용 재고 열은 뺀다.
 */
export const ItemFilterField = ({ value, onChange }: ItemFilterFieldProps) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const itemId = value === '' ? null : Number(value);
  const names = useItemNames([itemId]);
  const label = itemId === null ? '' : names.labelOf(itemId);
  const open = (): void => setIsPickerOpen(true);

  return (
    <>
      <SearchInput
        label={t.item}
        value={label}
        readOnly
        title={label === '' ? undefined : label}
        placeholder={t.itemPlaceholder}
        aria-haspopup="dialog"
        clearLabel={t.itemClear}
        onClick={open}
        onSearch={open}
        onChange={() => undefined}
        onClear={() => {
          onChange('');
        }}
      />
      {isPickerOpen && (
        <ItemPickerDialog
          multiple={false}
          includeInactive
          showAvailability={false}
          confirmLabel={t.itemPick}
          onClose={() => {
            setIsPickerOpen(false);
          }}
          onConfirm={([item]) => {
            if (item !== undefined) onChange(String(item.itemId));
            setIsPickerOpen(false);
          }}
        />
      )}
    </>
  );
};
