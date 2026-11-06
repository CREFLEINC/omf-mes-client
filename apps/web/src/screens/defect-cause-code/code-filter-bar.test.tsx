import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { defectCodeAdapter } from './adapters';
import { CodeFilterBar, type CodeFilterBarProps } from './code-filter-bar';
import type { CodeFilters } from './types';

const NO_FILTERS: CodeFilters = {
  q: '',
  includeInactive: false,
  inactiveOnly: false,
  dispositionTypeCode: '',
  processId: '',
  page: 1,
  size: 20,
};

const renderBar = (overrides: Partial<CodeFilterBarProps> = {}) => {
  const props: CodeFilterBarProps = {
    adapter: defectCodeAdapter,
    appliedFilters: NO_FILTERS,
    onApplyFilters: vi.fn(),
    actions: <button type="button">대분류 추가</button>,
    processLabelOf: (processId) => (processId === 7001 ? 'P-10 · 조립' : null),
    ...overrides,
  };

  /* 코드 · 공정 칸은 펼칠 때 서버에 묻는다(#226) — 공정 하나만 돌려준다. */
  renderWithProviders(<CodeFilterBar {...props} />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/processes',
        respond: () =>
          jsonResponse({
            items: [{ processId: 7001, processCode: 'P-10', processName: '조립' }],
            page: { page: 1, size: 20, total: 1 },
          }),
      },
    ]),
  });

  return { props, user: userEvent.setup() };
};

describe('CodeFilterBar — 조회 조건', () => {
  it('검색 칸은 칸에서 바로 검색해 고른다 — 창(팝업)이 열리지 않는다(#226)', async () => {
    const { user } = renderBar();

    const field = screen.getByLabelText('불량코드 검색');
    expect(field).toHaveTextContent('전체');
    await user.click(field);

    expect(
      await screen.findByRole('searchbox', { name: messages.common.selectSearch }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('조회를 누르면 지금 조건이 적용된다', async () => {
    const { props, user } = renderBar();

    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      q: '',
      includeInactive: false,
      inactiveOnly: false,
      dispositionTypeCode: '',
      processId: '',
      page: 1,
      size: 20,
    });
  });

  it('「미사용 포함」 확인칸을 두지 않는다 — 탭 줄 사용 여부 칩이 맡는다(#209)', () => {
    renderBar();

    expect(screen.queryByRole('checkbox', { name: '미사용 포함' })).not.toBeInTheDocument();
  });

  it('초기화는 조건을 모두 비운다', async () => {
    const { props, user } = renderBar({
      appliedFilters: {
        q: 'DF-1',
        includeInactive: true,
        inactiveOnly: false,
        dispositionTypeCode: '',
        processId: '',
        page: 1,
        size: 20,
      },
    });

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      q: '',
      includeInactive: false,
      inactiveOnly: false,
      dispositionTypeCode: '',
      processId: '',
      page: 1,
      size: 20,
    });
  });

  it('적용된 조건은 칩으로 보이고 칩을 지우면 그 조건만 풀린다', async () => {
    const { props, user } = renderBar({
      appliedFilters: {
        q: 'DF-1',
        includeInactive: true,
        inactiveOnly: false,
        dispositionTypeCode: '',
        processId: '',
        page: 1,
        size: 20,
      },
    });

    expect(screen.getByText('검색어: DF-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '검색어 조건 제거' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      q: '',
      includeInactive: true,
      inactiveOnly: false,
      dispositionTypeCode: '',
      processId: '',
      page: 1,
      size: 20,
    });
  });

  it('탭마다 검색 라벨이 다르다 — 불량코드 탭은 불량코드 검색', () => {
    renderBar();
    expect(screen.getByLabelText('불량코드 검색')).toBeInTheDocument();
  });

  it('불량코드 탭에는 처분 유형 · 공정 조건이 있고, 조회를 눌러야 적용된다(#209)', async () => {
    const { props, user } = renderBar();

    await user.click(screen.getByRole('combobox', { name: '처분 유형 선택' }));
    await user.click(screen.getByRole('option', { name: '폐기' }));
    expect(props.onApplyFilters).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(props.onApplyFilters).toHaveBeenCalledWith(
      expect.objectContaining({ dispositionTypeCode: 'SCRAP' }),
    );
  });

  it('공정 칸은 고른 공정 이름을 보이고, 칸에서 바로 검색해 고른다(#209 · #226)', async () => {
    const { props, user } = renderBar({
      appliedFilters: {
        q: '',
        includeInactive: false,
        inactiveOnly: false,
        dispositionTypeCode: '',
        processId: '7001',
        page: 1,
        size: 20,
      },
    });

    const field = screen.getByLabelText('공정 검색');
    expect(field).toHaveTextContent('P-10 · 조립');

    /* 「전체」는 종전 × 자리다 — 조회를 눌러야 적용된다. */
    await user.click(field);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: '전체' }));
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(props.onApplyFilters).toHaveBeenCalledWith(expect.objectContaining({ processId: '' }));
  });

  it('조회 · 초기화 뒤에 화면 단추를 그대로 낸다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: '대분류 추가' })).toBeInTheDocument();
  });
});
