import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProgressFilterBar, type ProgressFilterBarProps } from './filter-bar';
import type { ProgressFilters } from './filters';
import { LOOKUP_SIZE, type NameLookup } from './lookups';
import type { StatusOptions } from './status-options';

const t = messages.workOrderProgress.filters;

const APPLIED: ProgressFilters = {
  from: '2026-07-01',
  to: '2026-07-31',
  productionLineId: '',
  statusCode: '',
  productionOrderId: '',
  keyword: '',
};

const lookup = (overrides: Partial<NameLookup> = {}): NameLookup => ({
  labelOf: () => '',
  options: [{ value: '7', label: 'SYN-LINE-A · 합성 라인' }],
  isPending: false,
  isError: false,
  isTruncated: false,
  ...overrides,
});

const statusOptions = (overrides: Partial<StatusOptions> = {}): StatusOptions => ({
  options: [{ value: 'SYN_RUN', label: '진행중' }],
  labelOf: () => '',
  isPending: false,
  isError: false,
  isUnavailable: false,
  ...overrides,
});

const renderBar = (overrides: Partial<ProgressFilterBarProps> = {}) => {
  const props: ProgressFilterBarProps = {
    appliedFilters: APPLIED,
    lineLookup: lookup(),
    productionOrderLookup: lookup({ options: [{ value: '31', label: 'SYN-PO-0031' }] }),
    statusOptions: statusOptions(),
    onSearch: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };

  return { ...props, ...render(<ProgressFilterBar {...props} />), user: userEvent.setup() };
};

const searchButton = (): HTMLElement => screen.getByRole('button', { name: t.search });

const selectOption = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  optionLabel: string,
): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: optionLabel }));
};

describe('ProgressFilterBar', () => {
  /*
   * ⭐ 고르는 즉시 조회가 나가면 세 칸을 채우는 동안 세 번 조회된다 — 「조회」를 눌러야 걸린다.
   */
  it('고쳐도 「조회」를 누르기 전에는 나가지 않는다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.keyword), 'SYN-WO');

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('「조회」를 누르면 고친 값을 그대로 넘긴다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.keyword), 'SYN-WO');
    await user.click(searchButton());

    expect(onSearch).toHaveBeenCalledWith({ ...APPLIED, keyword: 'SYN-WO' });
  });

  it('「초기화」를 누르면 알린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: t.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  /*
   * ⛔ 되돌리지 않으면 뒤로 갔는데 입력칸만 옛 값으로 남는다 — 화면이 보여 주는 조건과
   * 실제로 걸린 조건이 갈린다.
   */
  it('⛔ 걸린 조건이 밖에서 바뀌면 입력칸도 그 값이 된다', () => {
    const { rerender } = renderBar();

    rerender(
      <ProgressFilterBar
        appliedFilters={{ ...APPLIED, keyword: 'SYN-WO-0007' }}
        lineLookup={lookup()}
        productionOrderLookup={lookup()}
        statusOptions={statusOptions()}
        onReset={vi.fn()}
        onSearch={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(t.keyword)).toHaveValue('SYN-WO-0007');
  });

  describe('기간', () => {
    /* L-3 — 무제한 조회를 허용하면 실적이 쌓인 뒤 목록이 멎는다. */
    it.each([
      ['시작일이 비면', { from: '' }],
      ['종료일이 비면', { to: '' }],
    ])('⛔ %s 조회를 막고 무엇을 채우면 되는지 적는다', (_name, overrides) => {
      renderBar({ appliedFilters: { ...APPLIED, ...overrides } });

      expect(searchButton()).toBeDisabled();
      expect(screen.getByText(t.periodRequired)).toBeInTheDocument();
    });

    it('⛔ 시작일이 종료일보다 뒤면 막고 어떻게 풀지 적는다', () => {
      renderBar({ appliedFilters: { ...APPLIED, from: '2026-07-31', to: '2026-07-01' } });

      expect(searchButton()).toBeDisabled();
      expect(screen.getByText(t.periodReversed)).toBeInTheDocument();
    });

    it('막힌 채로 Enter 를 눌러도 조회가 나가지 않는다', async () => {
      const { onSearch, user } = renderBar({ appliedFilters: { ...APPLIED, from: '' } });

      await user.type(screen.getByLabelText(t.keyword), '{Enter}');

      expect(onSearch).not.toHaveBeenCalled();
    });

    /*
     * ⛔ **버튼을 끄는 것만으로는 모자란다.** 위의 Enter 가 막히는 것은 「기본 제출 버튼이
     * 꺼져 있으면 암묵 제출이 일어나지 않는다」는 브라우저 규칙 덕이고, form 은 그 규칙을
     * 거치지 않고도 제출될 수 있다. 막는 판단은 **제출 처리기 안에도** 있어야 한다.
     */
    it('⛔ 막힌 채로 form 이 제출돼도 조회가 나가지 않는다', () => {
      const { onSearch } = renderBar({ appliedFilters: { ...APPLIED, from: '' } });

      fireEvent.submit(screen.getByRole('form', { name: t.legend }));

      expect(onSearch).not.toHaveBeenCalled();
    });

    /* ⛔ 넓게 봐야 하는 일이 실제로 있다 — 막지 않고 느려질 수 있다는 사실만 알린다. */
    it('⛔ 기간이 3개월을 넘어도 막지 않는다 — 경고만 한다', () => {
      renderBar({ appliedFilters: { ...APPLIED, from: '2026-01-01', to: '2026-07-31' } });

      expect(searchButton()).toBeEnabled();
      expect(screen.getByText(t.periodWide)).toBeInTheDocument();
    });

    it('넉넉하지 않은 기간에는 경고를 적지 않는다', () => {
      renderBar();

      expect(screen.queryByText(t.periodWide)).not.toBeInTheDocument();
    });
  });

  describe('선택지', () => {
    it('고른 값을 조회 조건으로 넘긴다', async () => {
      const { onSearch, user } = renderBar();

      await selectOption(user, t.productionLine, 'SYN-LINE-A · 합성 라인');
      await user.click(searchButton());

      expect(onSearch).toHaveBeenCalledWith({ ...APPLIED, productionLineId: '7' });
    });

    /* ⛔ 「전체」의 값이 비어 있어야 조회 조건에서 빠진다 — 아니면 없는 값으로 걸러진다. */
    it('⛔ 「전체」를 고르면 그 조건이 빠진다', async () => {
      const { onSearch, user } = renderBar({
        appliedFilters: { ...APPLIED, productionLineId: '7' },
      });

      await selectOption(user, t.productionLine, t.all);
      await user.click(searchButton());

      expect(onSearch).toHaveBeenCalledWith({ ...APPLIED, productionLineId: '' });
    });

    /* G-1·G-2 — 감추지 않고 끄고 사유를 적는다. */
    it('⛔ 상태 선택지를 세울 수 없으면 감추지 않고 끄고 사유를 적는다', () => {
      renderBar({ statusOptions: statusOptions({ options: [], isUnavailable: true }) });

      expect(screen.getByLabelText(t.status)).toBeDisabled();
      expect(screen.getByText(t.statusUnavailable)).toBeInTheDocument();
    });

    it('⛔ 선택지 조회가 실패하면 끄고 사유를 적는다', () => {
      renderBar({ lineLookup: lookup({ options: [], isError: true }) });

      expect(screen.getByLabelText(t.productionLine)).toBeDisabled();
      expect(screen.getByText(t.lookupFailed)).toBeInTheDocument();
    });

    /*
     * ⛔ 받는 중에 끄면 **사유를 적을 것이 없는 비활성**이 생긴다(G-2 위반). 잠깐 뒤면
     * 채워지므로 열어 둔다.
     */
    it('⛔ 받는 중에는 끄지 않는다 — 사유 없는 비활성을 만들지 않는다', () => {
      renderBar({ lineLookup: lookup({ options: [], isPending: true }) });

      expect(screen.getByLabelText(t.productionLine)).toBeEnabled();
    });

    /* ⛔ 적지 않으면 「여기 없으면 없는 것」으로 읽힌다. */
    it('⛔ 선택지가 잘렸으면 그 사실을 적는다', () => {
      renderBar({ productionOrderLookup: lookup({ isTruncated: true }) });

      expect(screen.getByText(t.optionsTruncated(LOOKUP_SIZE))).toBeInTheDocument();
    });

    it('잘리지 않았으면 적지 않는다 — 없는 걱정을 만들지 않는다', () => {
      renderBar();

      expect(screen.queryByText(t.optionsTruncated(LOOKUP_SIZE))).not.toBeInTheDocument();
    });
  });

  /*
   * A-11 — 계약에 공정으로 거를 파라미터가 없다. ⛔ 자리만 만들어 두고 늘 비활성이면
   * 「고장 났나」로 읽힌다. 대신 한 문장으로 적는다.
   */
  it('⛔ 공정 칸을 만들지 않고 못 거른다는 사실을 적는다', () => {
    renderBar();

    expect(screen.getByText(t.processUnavailable)).toBeInTheDocument();
    expect(screen.queryByLabelText('공정')).not.toBeInTheDocument();
  });
});
