import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { causeCodeAdapter, defectCodeAdapter } from './adapters';
import { CodeFilterBar, type CodeFilterBarProps } from './code-filter-bar';
import type { CodeFilters } from './types';

const NO_FILTERS: CodeFilters = { q: '', includeInactive: false, page: 1, size: 20 };

const renderBar = (overrides: Partial<CodeFilterBarProps> = {}) => {
  const props: CodeFilterBarProps = {
    adapter: defectCodeAdapter,
    appliedFilters: NO_FILTERS,
    onApplyFilters: vi.fn(),
    actions: <button type="button">대분류 추가</button>,
    ...overrides,
  };

  render(<CodeFilterBar {...props} />);

  return { props, user: userEvent.setup() };
};

describe('CodeFilterBar — 조회 조건', () => {
  it('검색어를 넣고 조회를 누르면 조건이 적용된다', async () => {
    const { props, user } = renderBar();

    await user.type(screen.getByLabelText('불량코드 검색'), 'DF-1');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      q: 'DF-1',
      includeInactive: false,
      page: 1,
      size: 20,
    });
  });

  it('미사용 포함은 해제 축이라 바꾸는 즉시 적용된다', async () => {
    const { props, user } = renderBar();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      q: '',
      includeInactive: true,
      page: 1,
      size: 20,
    });
  });

  it('초기화는 조건을 모두 비운다', async () => {
    const { props, user } = renderBar({
      appliedFilters: { q: 'DF-1', includeInactive: true, page: 1, size: 20 },
    });

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      q: '',
      includeInactive: false,
      page: 1,
      size: 20,
    });
  });

  it('적용된 조건은 칩으로 보이고 칩을 지우면 그 조건만 풀린다', async () => {
    const { props, user } = renderBar({
      appliedFilters: { q: 'DF-1', includeInactive: true, page: 1, size: 20 },
    });

    expect(screen.getByText('검색어: DF-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '검색어 조건 제거' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      q: '',
      includeInactive: true,
      page: 1,
      size: 20,
    });
  });

  it('탭마다 검색 라벨이 다르고, 불량코드 검색 칸에는 입력 안내가 있다', () => {
    renderBar();
    expect(screen.getByPlaceholderText('불량코드 또는 불량명을 입력하세요')).toBeInTheDocument();
  });

  it('원인코드 탭은 원인코드 검색 라벨을 쓴다', () => {
    renderBar({ adapter: causeCodeAdapter });

    expect(screen.getByLabelText('원인코드 검색')).toBeInTheDocument();
  });

  it('조회 · 초기화 뒤에 화면 단추를 그대로 낸다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: '대분류 추가' })).toBeInTheDocument();
  });
});
