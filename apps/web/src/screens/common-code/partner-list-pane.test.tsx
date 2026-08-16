import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { partnerFixtures } from './fixtures';
import { EMPTY_PARTNER_FILTERS, PartnerListPane } from './partner-list-pane';
import { toPageView } from './pagination';
import type { PartnerFilters } from './types';

const baseProps = (
  overrides: Partial<Parameters<typeof PartnerListPane>[0]> = {},
): Parameters<typeof PartnerListPane>[0] => ({
  partners: partnerFixtures,
  isLoading: false,
  appliedFilters: EMPTY_PARTNER_FILTERS,
  onApplyFilters: vi.fn<(next: PartnerFilters) => void>(),
  pageView: toPageView(
    { page: 1, size: 50, total: partnerFixtures.length },
    partnerFixtures.length,
  ),
  onChangePage: vi.fn<(page: number) => void>(),
  selectedPartnerId: null,
  onSelect: vi.fn<(partnerId: number) => void>(),
  loadError: null,
  ...overrides,
});

const renderPane = (overrides: Partial<Parameters<typeof PartnerListPane>[0]> = {}) => {
  const props = baseProps(overrides);
  const view = render(<PartnerListPane {...props} />);

  return { ...props, ...view, user: userEvent.setup() };
};

describe('PartnerListPane — 목록 표시', () => {
  it('거래처코드·거래처명 두 열만 낸다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['거래처코드', '거래처명']);
  });

  /* 좁은 좌 페인에서 「사용 여부」 열을 더 두면 이름 열이 짓눌린다. */
  it('미사용 행은 열을 늘리지 않고 이름 뒤 접미로 알린다', () => {
    renderPane();

    expect(screen.getByText('샘플 거래처 다 (미사용)')).toBeInTheDocument();
    expect(screen.getByText('샘플 거래처 가')).toBeInTheDocument();
  });

  it('고른 거래처의 행에 선택 표식이 붙는다', () => {
    renderPane({ selectedPartnerId: 9002 });

    expect(screen.getByRole('button', { name: 'SAMPLE-PTNR-B' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'SAMPLE-PTNR-A' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('거래처코드를 누르면 그 거래처 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-C' }));

    expect(onSelect).toHaveBeenCalledWith(9003);
  });

  /*
   * **내부 번호를 화면에 내지 않는다**(결정 12) — 주소와 조회에만 쓰는 식별자라
   * 보이면 사용자가 자료로 읽는다. 목록이 실제로 그려진 뒤에 잰다.
   */
  it('거래처 번호를 표에 내지 않는다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: 'SAMPLE-PTNR-A' })).toBeInTheDocument();
    expect(screen.queryByText('9001')).not.toBeInTheDocument();
  });

  /* 실패를 「등록된 거래처가 없습니다」로 보이면 사실과 다른 안내가 된다. */
  it('조회 실패 표시가 있으면 표와 빈 상태를 함께 내지 않는다', () => {
    renderPane({ partners: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 거래처가 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 진행 안내를 낸다', () => {
    renderPane({ partners: [], isLoading: true });

    expect(screen.getByRole('status', { name: '거래처 목록을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /**
   * **`getRowId` 감지기**(전례 대조 목록 2번). 미지정이면 인덱스가 React key가 되어
   * 앞 줄이 사라질 때 **누르고 있던 줄의 DOM 노드가 대신 지워진다** — 포커스가 말없이
   * 다른 거래처의 버튼으로 옮겨 붙고, 사용자는 자기가 고른 줄이 바뀐 것을 알아채지 못한다.
   */
  it('앞 줄이 사라져도 고른 줄의 포커스가 남는다', async () => {
    const { rerender, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-C' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'SAMPLE-PTNR-C' }));

    rerender(<PartnerListPane {...baseProps({ partners: partnerFixtures.slice(1) })} />);

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'SAMPLE-PTNR-C' }));
  });
});

describe('PartnerListPane — 조건', () => {
  it('검색어를 넣고 조회를 누르면 그 조건을 알린다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(screen.getByLabelText('거래처 검색'), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'SAMPLE', includeInactive: false });
  });

  /* 해제 축이라 조회를 기다리지 않는다 — 켜는 즉시 적용한다. */
  it('미사용 포함은 켜는 즉시 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: true });
  });

  it('초기화를 누르면 빈 조건을 알린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SAMPLE', includeInactive: true },
    });

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith(EMPTY_PARTNER_FILTERS);
  });

  /* 적용된 조건이 컨트롤에 그대로 서야 무엇으로 조회했는지 읽을 수 있다. */
  it('적용된 조건이 컨트롤에 실려 있다', () => {
    renderPane({ appliedFilters: { q: 'SAMPLE', includeInactive: true } });

    expect(screen.getByLabelText('거래처 검색')).toHaveValue('SAMPLE');
    expect(screen.getByRole('checkbox', { name: '미사용 포함' })).toBeChecked();
  });
});

describe('PartnerListPane — 빈 상태', () => {
  it('조건 없는 0건은 「등록된 것이 없다」로 낸다', () => {
    renderPane({ partners: [], pageView: toPageView({ page: 1, size: 50, total: 0 }, 0) });

    expect(screen.getByText('등록된 거래처가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 거래처가 없습니다')).not.toBeInTheDocument();
  });

  /* 거래처는 외부 시스템에서 받는다 — 없는 조치(「거래처 추가」)를 지시하지 않는다. */
  it('0건 안내가 자료의 출처를 밝히고 없는 조치를 지시하지 않는다', () => {
    renderPane({ partners: [], pageView: toPageView({ page: 1, size: 50, total: 0 }, 0) });

    expect(
      screen.getByText('거래처는 외부 시스템에서 받아 옵니다. 원본 시스템을 확인하세요.'),
    ).toBeInTheDocument();
  });

  it('조건이 걸린 0건에는 초기화로 돌아갈 길을 함께 준다', async () => {
    const { onApplyFilters, user } = renderPane({
      partners: [],
      appliedFilters: { q: 'SAMPLE', includeInactive: false },
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('조건에 맞는 거래처가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 거래처가 없습니다')).not.toBeInTheDocument();

    /* 빈 상태의 「초기화」와 조건 줄의 「초기화」가 같은 뜻이라 이름이 겹친다. */
    await user.click(screen.getAllByRole('button', { name: '초기화' })[0]!);
    expect(onApplyFilters).toHaveBeenCalledWith(EMPTY_PARTNER_FILTERS);
  });

  /* 결과는 있는데 이 쪽에 없다 — 「등록된 것이 없다」로 내면 거짓말이 된다. */
  it('범위 밖 쪽에는 첫 쪽으로 돌아갈 길을 준다', async () => {
    const { onChangePage, user } = renderPane({
      partners: [],
      pageView: toPageView({ page: 9, size: 50, total: 240 }, 0),
    });

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 거래처가 없습니다')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));
    expect(onChangePage).toHaveBeenCalledWith(1);
  });
});

describe('PartnerListPane — 쪽 이동', () => {
  it('다음을 누르면 다음 쪽을 알린다', async () => {
    const { onChangePage, user } = renderPane({
      pageView: toPageView({ page: 2, size: 50, total: 240 }, 50),
    });

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChangePage).toHaveBeenCalledWith(3);
  });
});

describe('PartnerListPane — 만들 수 없는 것', () => {
  /*
   * 거래처 본체는 ERP 수신 마스터라 계약에 **등록·수정·사용 중지 경로가 없다.**
   * 잠긴 버튼으로도 두지 않는다 — 잠근 버튼은 「언젠가 풀린다」는 뜻이 된다.
   * 목록이 실제로 그려진 뒤(양성 앵커)에 잰다.
   */
  it('거래처를 더하거나 고치는 버튼이 없다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: 'SAMPLE-PTNR-A' })).toBeInTheDocument();

    const buttonNames = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttonNames).toEqual([
      '조회',
      '초기화',
      'SAMPLE-PTNR-A',
      'SAMPLE-PTNR-B',
      'SAMPLE-PTNR-C',
      '이전',
      '다음',
    ]);
  });
});
