import { messages } from '@omf-mes/i18n';

import { useApiClient } from '../../patterns/api-context';
import { PagedSelect } from '../../patterns/select';
import type { CodeAdapter } from './adapters';
import type { HierarchyCode } from './types';

const t = messages.defectCauseCode;

/** 한 쪽 건수 — 종전 검색 창의 첫 쪽과 같다. */
const CODE_SELECT_PAGE_SIZE = 20;

export interface CodeSelectProps {
  id: string;
  adapter: CodeAdapter;
  /** 목록 조건의 미사용 포함 — 종전 창처럼 같은 범위에서 찾는다(목록에 없는 코드를 고르지 않게). */
  includeInactive: boolean;
  /** 칸에 걸린 검색어(코드). 비면 「전체」. */
  value: string;
  /** 고른 코드 — 「전체」면 null. */
  onPick: (code: HierarchyCode | null) => void;
}

/**
 * 코드를 칸에서 바로 검색해서 고르는 선택 칸(omf-all-around#226) — 종전 코드 검색 창(`CodePickerDialog`)과 같은 조회
 * (목록과 같은 `q`)를 쓴다. 칸에는 종전처럼 검색어(코드)를 그대로 보인다.
 */
export const CodeSelect = ({ id, adapter, includeInactive, value, onPick }: CodeSelectProps) => {
  const { client } = useApiClient();

  return (
    <PagedSelect
      id={id}
      queryKey={[...adapter.keys.all, 'code-select', includeInactive]}
      fetchPage={async (q, page) => {
        const data = await adapter.fetchList(client, {
          q,
          includeInactive,
          inactiveOnly: false,
          dispositionTypeCode: '',
          processId: '',
          page,
          size: CODE_SELECT_PAGE_SIZE,
        });
        return {
          options: data.items.map((code) => ({
            value: code.code,
            label: `${code.code} · ${code.name}`,
            data: code,
          })),
          total: data.page.total,
        };
      }}
      selectedOption={value === '' ? null : { value, label: value }}
      leadingOptions={[{ value: '', label: t.filters.all }]}
      value={value}
      placeholder={t.filters.all}
      onOptionChange={(option) => onPick((option.data as HierarchyCode | undefined) ?? null)}
    />
  );
};
