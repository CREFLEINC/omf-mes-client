import { createApiClient } from '@omf-mes/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientProvider } from '../../patterns/api-context';
import { jsonResponse } from '../../test/api-harness';
import { EMPTY_INSPECTION_INSIGHT_FILTERS } from './filters';
import { InspectionInsightFilterBar } from './filter-bar';

const options = {
  inspectionType: [{ value: 'PQC', label: '공정검사' }],
  process: [{ value: '501', label: '합성 공정' }],
  judgment: [{ value: 'REJECTED', label: '불합격' }],
};

/* 품목 칸(`ItemSelect`)은 펼칠 때 `/mdm/items` 를 부른다 — 한 건만 돌려준다. 다시 그려도 남게 wrapper 로 감싼다. */
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <ApiClientProvider
      client={createApiClient({
        baseUrl: 'http://test.invalid',
        fetch: async () =>
          jsonResponse({
            items: [{ itemId: 101, itemCode: 'ITEM-101', itemName: '합성 품목', isActive: true }],
            page: { page: 1, size: 50, total: 1 },
          }),
      })}
    >
      {children}
    </ApiClientProvider>
  </QueryClientProvider>
);

/** 처음 값 — 화면은 오늘 · 오늘로 연다. */
const TODAY = { ...EMPTY_INSPECTION_INSIGHT_FILTERS, from: '2026-08-31', to: '2026-08-31' };

describe('검사 결과 공통 필터', () => {
  it('기간 전에는 조회를 막고 무관한 rerender에 편집 초안을 보존한다', async () => {
    const user = userEvent.setup();
    const props = {
      appliedFilters: EMPTY_INSPECTION_INSIGHT_FILTERS,
      defaults: TODAY,
      options,
      onSearch: vi.fn(),
      onReset: vi.fn(),
    };
    const { rerender } = render(<InspectionInsightFilterBar {...props} />, { wrapper });

    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
    expect(screen.getByText('조회 기간을 선택하세요.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('시작일 선택'), '2026-08-01');
    rerender(
      <InspectionInsightFilterBar
        {...props}
        appliedFilters={{ ...EMPTY_INSPECTION_INSIGHT_FILTERS }}
      />,
    );
    expect(screen.getByLabelText('시작일 선택')).toHaveValue('2026-08-01');
    await user.type(screen.getByLabelText('종료일 선택'), '2026-08-31');
    expect(screen.getByRole('button', { name: '조회' })).toBeEnabled();
    expect(screen.getByLabelText('검사 유형 선택')).toHaveTextContent('전체');
    // 검사 유형 「전체」 안내는 뺐다(사용자 2026-10-30).
    expect(
      screen.queryByText(/전체 선택 시 요약·추이는 검사유형별로 분리/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(props.onSearch).toHaveBeenCalledWith({
      ...EMPTY_INSPECTION_INSIGHT_FILTERS,
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('표시명 선택과 명시 교정 필터를 공통 조회 조건으로 전달한다', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <InspectionInsightFilterBar
        appliedFilters={EMPTY_INSPECTION_INSIGHT_FILTERS}
        defaults={TODAY}
        options={options}
        onSearch={onSearch}
        onReset={() => undefined}
      />,
      { wrapper },
    );

    await user.type(screen.getByLabelText('시작일 선택'), '2026-08-01');
    await user.type(screen.getByLabelText('종료일 선택'), '2026-08-31');
    // 윗줄은 시작일 → 종료일 → LOT 스캔, 나머지 조건은 접힌 아랫줄에 있다(사용자 2026-10-30).
    const [from, to, lot] = ['시작일 선택', '종료일 선택', 'LOT 스캔'].map((label) =>
      screen.getByLabelText(label),
    );
    expect(from!.compareDocumentPosition(to!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(to!.compareDocumentPosition(lot!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const toggle = screen.getByRole('button', { name: '조건 더보기' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // 최종 회차는 윗줄(LOT 스캔 옆)이라 접혀 있어도 보인다.
    expect(screen.getByRole('checkbox', { name: '최종 회차' })).toBeVisible();
    await user.click(toggle);
    expect(screen.getByRole('button', { name: '조건 접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    for (const [field, option] of [
      ['검사 유형 선택', '공정검사'],
      ['품목 검색', 'ITEM-101 · 합성 품목'],
      ['공정 선택', '합성 공정'],
      ['교정 상태 선택', '검교정 만료만'],
    ]) {
      await user.click(screen.getByLabelText(field!));
      await user.click(await screen.findByRole('option', { name: option! }));
    }
    await user.click(screen.getByRole('checkbox', { name: '최종 회차' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith({
      from: '2026-08-01',
      to: '2026-08-31',
      inspectionTypeCode: 'PQC',
      itemId: '101',
      processId: '501',
      overallJudgmentCode: '',
      lotNo: '',
      finalRoundOnly: false,
      calibrationExpired: 'only',
    });
    // 회차 안내 줄은 뺐다(사용자 2026-11-02).
    expect(screen.queryByText('재검 사슬 전체를 회차 순서로 조회합니다.')).not.toBeInTheDocument();
    expect(screen.queryByText('101')).not.toBeInTheDocument();
  });

  /* LOT 칸은 검사 조회·판정의 LOT 스캔 칸처럼 바로 옆 「검색」으로 조회한다 — LOT 이 있으면 기간 없이 된다(#217). */
  it('LOT 를 넣고 「검색」을 누르면 기간 없이 그 LOT 로 조회하고, 단추는 조회 → 초기화 차례다', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <InspectionInsightFilterBar
        appliedFilters={EMPTY_INSPECTION_INSIGHT_FILTERS}
        defaults={TODAY}
        options={options}
        onSearch={onSearch}
        onReset={vi.fn()}
      />,
      { wrapper },
    );

    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled();
    await user.type(screen.getByLabelText('LOT 스캔'), 'LOT-0001');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ lotNo: 'LOT-0001', from: '' }));
    const [search, reset] = [
      screen.getByRole('button', { name: '조회' }),
      screen.getByRole('button', { name: '초기화' }),
    ];
    expect(search.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('「초기화」는 처음 값(오늘 · 오늘)에서는 없고, 바꾼 것이 생기면 나타난다(C-6)', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <InspectionInsightFilterBar
        appliedFilters={TODAY}
        defaults={TODAY}
        options={options}
        onSearch={vi.fn()}
        onReset={onReset}
      />,
      { wrapper },
    );

    expect(screen.queryByRole('button', { name: '초기화' })).toBeNull();

    await user.type(screen.getByLabelText('LOT 스캔'), 'L');
    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onReset).toHaveBeenCalledOnce();
    /* 치던 값도 처음으로 — 조회에 쓰인 값이 이미 처음 값이면 주소가 바뀌지 않는다. */
    expect(screen.getByLabelText('LOT 스캔')).toHaveValue('');
  });

  it('접힌 칸에 걸린 조건은 칩으로 보이고, × 는 그 조건만 풀어 조회한다 — 펼치면 칩을 거둔다', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const applied = { ...TODAY, processId: '501', calibrationExpired: 'only' as const };
    render(
      <InspectionInsightFilterBar
        appliedFilters={applied}
        defaults={TODAY}
        options={options}
        onSearch={onSearch}
        onReset={vi.fn()}
      />,
      { wrapper },
    );

    expect(screen.getByRole('button', { name: '조건 더보기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('검사 공정: 합성 공정')).toBeInTheDocument();
    expect(screen.getByText('교정 상태: 검교정 만료만')).toBeInTheDocument();
    /* 보이는 칸(기간 · LOT · 최종 회차)은 칩으로 겹쳐 적지 않는다. */
    expect(screen.queryByText(/^시작일 선택: /)).toBeNull();

    await user.click(screen.getByRole('button', { name: '검사 공정 조건 제거' }));
    expect(onSearch).toHaveBeenCalledWith({ ...applied, processId: '' });

    await user.click(screen.getByRole('button', { name: '조건 더보기' }));
    expect(screen.queryByText('검사 공정: 합성 공정')).toBeNull();
  });
});
