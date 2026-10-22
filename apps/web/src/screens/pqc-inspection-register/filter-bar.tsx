import { Button, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type FormEvent } from 'react';

import { ItemPickerDialog } from '../../patterns/item-picker';
import { useItem } from '../production-result/flow-queries';

const t = messages.pqcInspectionRegister.filters;

/** 걸어 둔 조건 — 품목(번호)과 의뢰번호 검색어. 비면 좁히지 않는다. */
export interface PqcFilters {
  itemId: number | null;
  keyword: string;
}

export const EMPTY_PQC_FILTERS: PqcFilters = { itemId: null, keyword: '' };

export interface PqcFilterBarProps {
  applied: PqcFilters;
  onSearch: (filters: PqcFilters) => void;
  onReset: () => void;
}

/**
 * W-03-11 목록 조건 줄(omf-all-around#135) — IQC 판정 화면(#133)의 조건 줄과 같은 모양이다.
 * 품목 검색(품목 검색 창으로 고른다) · 의뢰번호 검색 · [조회][초기화]. 서버 목록 질의 `itemId`·`q` 를 그대로 쓴다.
 * PQC 는 대상이 작업지시라 공급사·LOT 스캔 조건이 없다.
 */
export const PqcFilterBar = ({ applied, onSearch, onReset }: PqcFilterBarProps) => {
  const [itemId, setItemId] = useState<number | null>(applied.itemId);
  const [keyword, setKeyword] = useState(applied.keyword);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const item = useItem(itemId);
  const itemLabel =
    itemId === null
      ? ''
      : item.data === undefined
        ? String(itemId)
        : `${item.data.itemCode} · ${item.data.itemName}`;
  const open = (): void => setIsPickerOpen(true);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSearch({ itemId, keyword: keyword.trim() });
  };

  return (
    <form className="filter-bar pqc-web-filter-bar" onSubmit={submit}>
      <SearchInput
        label={t.item}
        value={itemLabel}
        readOnly
        title={itemLabel === '' ? undefined : itemLabel}
        placeholder={t.itemPlaceholder}
        aria-haspopup="dialog"
        clearLabel={t.itemClear}
        onClick={open}
        onSearch={open}
        onChange={() => undefined}
        onClear={() => setItemId(null)}
      />
      {isPickerOpen && (
        <ItemPickerDialog
          multiple={false}
          compact
          includeInactive
          showAvailability={false}
          confirmLabel={t.itemPick}
          onClose={() => setIsPickerOpen(false)}
          onConfirm={([picked]) => {
            if (picked !== undefined) setItemId(picked.itemId);
            setIsPickerOpen(false);
          }}
        />
      )}
      <TextField
        label={t.keyword}
        placeholder={t.keywordPlaceholder}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <div className="filter-actions field-cell-unlabeled pqc-web-filter-actions">
        <Button type="submit" variant="filled">
          {t.apply}
        </Button>
        <Button
          type="button"
          variant="outlined"
          onClick={() => {
            setItemId(null);
            setKeyword('');
            onReset();
          }}
        >
          {t.reset}
        </Button>
      </div>
    </form>
  );
};
