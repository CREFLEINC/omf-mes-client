import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { SelectOption } from '@crefle/web-ui';
import { useQuery } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';

import { useApiClient } from './api-context';
import { runRequest } from './request';
import { type PagedOption, PagedSelect, type PagedSelectProps } from './select';

/** 한 쪽 건수 — 목록이 내려갈 만큼만. */
export const ITEM_SELECT_PAGE_SIZE = 50;

/** 품목 선택지 글자 — 품목코드 · 품목명. 화면이 이미 아는 이름으로 `selectedOption` 을 만들 때도 이것을 쓴다. */
export const itemOptionLabel = (item: { itemCode: string; itemName: string }): string =>
  `${item.itemCode} · ${item.itemName}`;

/** 목록 줄 글자 — 중지된 품목은 표식을 붙인다(`includeInactive` 일 때만 섞여 온다). */
const optionLabel = (item: Item): string =>
  item.isActive
    ? itemOptionLabel(item)
    : `${itemOptionLabel(item)}${messages.common.reference.inactiveSuffix}`;

export interface ItemSelectProps extends Omit<
  PagedSelectProps,
  'queryKey' | 'fetchPage' | 'onOptionChange'
> {
  /** 중지된 품목도 고른다 — 지난 자료를 찾는 조건 줄의 것. 새로 등록하는 칸은 끈다. */
  includeInactive?: boolean;
  /** 고른 품목 전체 — 기준단위 등 품목의 다른 값을 함께 채우는 칸의 것. `onChange` 뒤에 부른다. */
  onItemChange?: (item: Item) => void;
}

type Item = components['schemas']['Item'];

/**
 * 품목 선택 칸 — 품목 마스터(9천여 건)를 통째로 받지 않는다. 펼칠 때 첫 쪽, 검색어는 서버(`q` = 품목코드 · 품목명)로,
 * 목록 끝에 닿으면 다음 쪽(사용자 지시 2026-10-29). 값은 `itemId` 문자열이다.
 *
 * 화면은 `options` 없이 `value` · `onChange` 만 넘기면 된다 — 고른 품목의 이름은 이 칸이 번호로 받는다.
 */
export const ItemSelect = forwardRef<HTMLButtonElement, ItemSelectProps>(function ItemSelect(
  { includeInactive = false, onItemChange, onChange, selectedOption, ...rest },
  ref,
) {
  const { client } = useApiClient();
  /** 목록에서 고른 품목 — 이름을 이미 아니 번호로 다시 받지 않는다. */
  const [picked, setPicked] = useState<SelectOption | null>(null);

  /*
   * 고른 값의 이름 — 화면이 넘기지 않으면 번호로 하나 받는다. 받은 쪽(첫 50건)에 없는 품목도 칸에 이름이 보이게.
   * 넘긴 이름이 있으면 부르지 않는다.
   */
  const value = rest.value ?? null;
  const itemId = value !== null && /^\d+$/.test(value) ? Number(value) : null;
  const given =
    selectedOption?.value === value ? selectedOption : picked?.value === value ? picked : null;
  const known = given !== null && given !== undefined;
  const byId = useQuery({
    queryKey: ['item-select', 'by-id', itemId],
    enabled: itemId !== null && !known,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId: itemId ?? 0 } } }),
      );
      return { value: String(data.item.itemId), label: optionLabel(data.item) };
    },
  });
  const resolved = known ? given : (byId.data ?? null);

  return (
    <PagedSelect
      {...rest}
      ref={ref}
      selectedOption={resolved}
      queryKey={['item-select', includeInactive]}
      {...(onChange !== undefined ? { onChange } : {})}
      onOptionChange={(option) => {
        setPicked({ value: option.value, label: option.label });
        if (option.data !== undefined) onItemChange?.(option.data as Item);
      }}
      fetchPage={async (q, page) => {
        const data = await runRequest(() =>
          client.GET('/mdm/items', {
            params: {
              query: {
                /* 빈 검색어는 축을 싣지 않는다 — 빈 문자열을 검색어로 보내지 않는다. */
                ...(q === '' ? {} : { q }),
                ...(includeInactive ? { includeInactive: true } : {}),
                page,
                size: ITEM_SELECT_PAGE_SIZE,
              },
            },
          }),
        );
        return {
          options: data.items.map((item): PagedOption => ({
            value: String(item.itemId),
            label: optionLabel(item),
            data: item,
          })),
          total: data.page.total,
        };
      }}
    />
  );
});
