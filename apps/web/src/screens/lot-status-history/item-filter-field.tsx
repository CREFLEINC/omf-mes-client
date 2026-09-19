import { SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { ItemPickerDialog } from '../../patterns/item-picker';
import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import { useItemNameSources } from './reference-options';

const t = messages.lotStatusHistory;

interface ItemFilterFieldProps {
  /** 고른 품목 번호. 비면 「전체」. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * 품목 필터 — 검색해서 고른다(사용자 지시 2026-09-19).
 *
 * 선택칸은 품목 목록의 첫 쪽만 실어 그 너머 품목을 고를 수 없었다(「일부 품목만 표시됩니다」).
 * 공용 「품목 선택」 창을 쓰되, 지난 LOT 을 찾는 필터라 사용 중지 품목까지 찾고 가용 재고 열은 뺀다.
 *
 * ⭐ 칸 하나가 검색 묶음이다 — LOT 번호 칸과 같은 DS 검색 입력을 읽기 전용으로 두고, 누르거나
 * 엔터를 치면 창이 열린다. 지우기는 값이 있을 때만 칸 안의 × 로 낮춰 둔다(사용자 지시 2026-09-19).
 * 고른 품목의 이름은 품목 상세로 푼다 — 주소로 들어와 창을 거치지 않은 값도 이름이 선다.
 */
export const ItemFilterField = ({ value, onChange }: ItemFilterFieldProps) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const itemId = value === '' ? null : Number(value);
  const names = useItemNameSources(itemId === null ? [] : [itemId]);
  const source: LookupSource = (itemId === null ? undefined : names.get(itemId)) ?? {
    entries: [],
    isError: false,
    isLoading: true,
  };
  const label = itemId === null ? '' : lookupDisplayLabelWithInactive(source, itemId);
  const open = (): void => setIsPickerOpen(true);

  return (
    <>
      <SearchInput
        label={t.lotFilter.fields.item}
        containerClassName="lot-status-filter-item"
        value={label}
        readOnly
        title={label === '' ? undefined : label}
        placeholder={t.lotFilter.itemPlaceholder}
        aria-haspopup="dialog"
        clearLabel={t.lotFilter.itemClear}
        onClick={open}
        onSearch={open}
        onChange={() => undefined}
        onClear={() => onChange('')}
      />
      {isPickerOpen && (
        <ItemPickerDialog
          multiple={false}
          includeInactive
          showAvailability={false}
          confirmLabel={t.lotFilter.itemPick}
          onClose={() => setIsPickerOpen(false)}
          onConfirm={([item]) => {
            if (item !== undefined) onChange(String(item.itemId));
            setIsPickerOpen(false);
          }}
        />
      )}
    </>
  );
};
