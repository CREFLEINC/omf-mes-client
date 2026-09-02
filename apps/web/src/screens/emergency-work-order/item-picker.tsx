import { AlertBanner, Button, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { ITEM_SEARCH_SIZE, useItemSearch } from './queries';
import { type SelectedItem, toSelectedItem } from './types';

export interface ItemPickerProps {
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem | null) => void;
}

/**
 * 품목 고르기.
 *
 * ⛔ **Routing 보유로 미리 거르지 않는다.** 거르면 찾던 품목이 아예 안 나와, 사용자가 「없는
 * 품목」과 「Routing 이 없어 발행할 수 없는 품목」을 구분할 수 없다. 고르게 한 뒤 사유와 함께
 * 막는 것은 전개와 잠금의 몫이다.
 *
 * ⛔ **잘린 목록을 잘렸다고 말한다.** 안 말하면 「찾는 품목이 없다」로 읽는다 — 목록에 없는
 * 것과 목록이 잘린 것은 다른 사실이고, 사용자가 할 일이 다르다.
 *
 * ⚠ **글자마다 찾지 않는다.** 치는 값과 **찾기로 한 값**을 갈라 두어, 확정했을 때만 요청이
 * 나간다. 긴급 화면이라고 서버를 글자 수만큼 두드릴 이유는 없다.
 */
export const ItemPicker = ({ selected, onSelect }: ItemPickerProps) => {
  const t = messages.emergencyWorkOrder.itemPicker;
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const search = useItemSearch(keyword);

  const items = search.data?.items ?? [];
  const total = search.data?.page?.total ?? 0;

  return (
    <section aria-label={t.title}>
      <SearchInput
        aria-label={t.label}
        placeholder={t.placeholder}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onSearch={setKeyword}
        loading={search.isFetching}
      />
      <Button
        onClick={() => {
          setKeyword(draft);
        }}
      >
        {t.search}
      </Button>

      {selected !== null && (
        <div className="field-cell">
          <span className="field-label">{t.selected}</span>
          <span>{`${selected.itemCode} · ${selected.itemName}`}</span>
          <Button
            variant="text"
            onClick={() => {
              onSelect(null);
            }}
          >
            {t.clear}
          </Button>
        </div>
      )}

      {search.isFetching && <p role="status">{t.searching}</p>}

      {search.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.error}</AlertBanner>
        </div>
      )}

      {search.isSuccess && !search.isFetching && items.length === 0 && <p>{t.empty}</p>}

      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.itemId}>
              <Button
                variant="text"
                onClick={() => {
                  onSelect(toSelectedItem(item));
                }}
              >
                {t.select(`${item.itemCode} · ${item.itemName}`)}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {total > ITEM_SEARCH_SIZE && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.truncated(items.length)}</AlertBanner>
        </div>
      )}
    </section>
  );
};
