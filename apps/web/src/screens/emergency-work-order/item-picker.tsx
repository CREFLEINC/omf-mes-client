import { AlertBanner, Button, Dialog, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { ITEM_SEARCH_SIZE, useItemSearch } from './queries';
import { type SelectedItem, toSelectedItem } from './types';

export interface ItemPickerProps {
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem | null) => void;
}

/**
 * 품목 선택.
 *
 * ⭐ **찾는 일은 대화상자에서 한다**(사용자 결정 2026-09-21). 검색칸과 결과 목록을 본문에 두면
 * 고른 뒤에도 그 자리가 남아, 「지금 무엇이 골라져 있나」보다 「찾는 중인 것」이 먼저 읽힌다.
 * 본문에는 **고른 품목 한 줄**만 서고, 찾는 동안에는 대화상자가 그 일만 맡는다.
 *
 * ⛔ **찾는 방법은 그대로다.** 질의·선택·잘림 판정은 한 줄도 바꾸지 않았다 — 자리만 옮겼다.
 *
 * ⚠ **Routing 이 있는 품목만 검색한다**(omf-all-around#43) — 그 까닭은 `queries.ts` 에 있다.
 *
 * ⛔ **잘린 목록을 잘렸다고 말한다.** 안 말하면 「찾는 품목이 없다」로 읽는다 — 목록에 없는
 * 것과 목록이 잘린 것은 다른 사실이고, 사용자가 할 일이 다르다.
 *
 * ⚠ **글자마다 찾지 않는다.** 치는 값과 **찾기로 한 값**을 갈라 두어, 확정했을 때만 요청이
 * 나간다. 긴급 화면이라고 서버를 글자 수만큼 두드릴 이유는 없다.
 */
export const ItemPicker = ({ selected, onSelect }: ItemPickerProps) => {
  const t = messages.emergencyWorkOrder.itemPicker;
  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const search = useItemSearch(keyword);

  const items = search.data?.items ?? [];
  const total = search.data?.page?.total ?? 0;

  return (
    <section className="pane emergency-work-order-pane" aria-label={t.title}>
      <h2 className="pane-title">
        {t.title}
        <span aria-hidden="true" className="required-mark">
          *
        </span>
      </h2>

      {selected === null ? (
        <p className="emergency-work-order-picker-empty">{t.notChosen}</p>
      ) : (
        <div className="emergency-work-order-selected-item">
          <div className="field-cell">
            <span className="field-label">{t.selected}</span>
            <strong>{`${selected.itemCode} · ${selected.itemName}`}</strong>
          </div>
          <Button
            variant="outlined"
            onClick={() => {
              onSelect(null);
            }}
          >
            {t.clear}
          </Button>
        </div>
      )}

      <div className="emergency-work-order-picker-actions">
        <Button
          variant="outlined"
          onClick={() => {
            setOpen(true);
          }}
        >
          {selected === null ? t.open : t.change}
        </Button>
      </div>

      <Dialog
        open={isOpen}
        title={t.title}
        onClose={() => {
          setOpen(false);
        }}
      >
        <div className="emergency-work-order-search-row">
          <SearchInput
            aria-label={t.label}
            placeholder={t.placeholder}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onSearch={setKeyword}
            loading={search.isFetching}
            clearLabel={messages.common.clear}
          />
          <Button
            onClick={() => {
              setKeyword(draft);
            }}
          >
            {t.search}
          </Button>
        </div>

        {search.isFetching && <p role="status">{t.searching}</p>}

        {search.isError && (
          <div className="banner-slot">
            <AlertBanner variant="error">{t.error}</AlertBanner>
          </div>
        )}

        {search.isSuccess && !search.isFetching && items.length === 0 && <p>{t.empty}</p>}

        {items.length > 0 && (
          <ul className="emergency-work-order-search-results">
            {items.map((item) => (
              <li className="emergency-work-order-search-result" key={item.itemId}>
                <span className="emergency-work-order-search-result-text">
                  <strong>{item.itemCode}</strong>
                  <span>{item.itemName}</span>
                </span>
                <Button
                  variant="outlined"
                  /* 접근명은 «코드 · 이름»을 싣는다 — 줄마다 「선택」만 읽히면 무엇을 고르는지 알 수 없다. */
                  aria-label={t.select(`${item.itemCode} · ${item.itemName}`)}
                  onClick={() => {
                    onSelect(toSelectedItem(item));
                    setOpen(false);
                  }}
                >
                  {t.selectAction}
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
      </Dialog>
    </section>
  );
};
