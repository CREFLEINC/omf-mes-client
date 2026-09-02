import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  EMPTY_LOADING_INFO_DRAFT,
  LoadingInfoPane,
  resolveWarehouse,
  resolvedWarehouseId,
  toWarehouseOptions,
  type WarehouseResolution,
} from './loading-info-pane';
import type { LookupResult } from './lookups';

const warehouse = (overrides: Partial<Parameters<typeof toWarehouseOptions>[0][number]> = {}) => ({
  warehouseId: 1001,
  plantId: 1,
  businessUnitId: 1,
  warehouseCode: 'WH-01',
  warehouseName: 'Synthetic Warehouse',
  warehouseTypeCode: 'PRODUCT',
  managementLevelCode: 'STANDARD',
  isExternal: false,
  isDefect: false,
  isActive: true,
  ...overrides,
});

describe('toWarehouseOptions', () => {
  it('코드·이름 라벨로 옮긴다', () => {
    expect(toWarehouseOptions([warehouse()])).toEqual([
      { warehouseId: 1001, label: 'WH-01 · Synthetic Warehouse' },
    ]);
  });
});

describe('resolveWarehouse', () => {
  it('불러오는 중이면 PENDING', () => {
    expect(resolveWarehouse(undefined, true, false)).toEqual({ kind: 'PENDING' });
  });

  it('실패하면 ERROR', () => {
    expect(resolveWarehouse(undefined, false, true)).toEqual({ kind: 'ERROR' });
  });

  it('활성 창고가 없으면 NONE', () => {
    expect(resolveWarehouse([], false, false)).toEqual({ kind: 'NONE' });
  });

  it('정확히 하나면 AUTO', () => {
    const options = toWarehouseOptions([warehouse()]);
    expect(resolveWarehouse(options, false, false)).toEqual({
      kind: 'AUTO',
      warehouseId: 1001,
      label: 'WH-01 · Synthetic Warehouse',
    });
  });

  it('둘 이상이면 AMBIGUOUS', () => {
    const options = toWarehouseOptions([
      warehouse(),
      warehouse({ warehouseId: 1002, warehouseCode: 'WH-02' }),
    ]);
    expect(resolveWarehouse(options, false, false)).toEqual({ kind: 'AMBIGUOUS', options });
  });
});

describe('resolvedWarehouseId', () => {
  it('AUTO면 그 값을 낸다', () => {
    expect(resolvedWarehouseId({ kind: 'AUTO', warehouseId: 1001, label: 'x' }, '')).toBe(1001);
  });

  it('AMBIGUOUS이고 아직 고르지 않았으면 null', () => {
    expect(resolvedWarehouseId({ kind: 'AMBIGUOUS', options: [] }, '')).toBeNull();
  });

  it('AMBIGUOUS이고 골랐으면 그 값을 낸다', () => {
    expect(resolvedWarehouseId({ kind: 'AMBIGUOUS', options: [] }, '1002')).toBe(1002);
  });

  it('NONE·ERROR·PENDING이면 null', () => {
    expect(resolvedWarehouseId({ kind: 'NONE' }, '')).toBeNull();
    expect(resolvedWarehouseId({ kind: 'ERROR' }, '')).toBeNull();
    expect(resolvedWarehouseId({ kind: 'PENDING' }, '')).toBeNull();
  });
});

const emptyLookup: LookupResult = {
  entries: [],
  truncated: false,
  isError: false,
  isLoading: false,
};

describe('LoadingInfoPane', () => {
  it('6항목 입력칸을 낸다', () => {
    render(
      <LoadingInfoPane
        draft={EMPTY_LOADING_INFO_DRAFT}
        onChange={vi.fn()}
        workerLookup={emptyLookup}
        carrierLookup={emptyLookup}
        warehouseResolution={{ kind: 'AUTO', warehouseId: 1001, label: 'WH-01 · X' }}
      />,
    );

    expect(screen.getByLabelText('차량번호')).toBeInTheDocument();
    expect(screen.getByLabelText('운전자명')).toBeInTheDocument();
    expect(screen.getByLabelText('봉인번호')).toBeInTheDocument();
    expect(screen.getByLabelText('운송장번호')).toBeInTheDocument();
    expect(screen.getByText('상차담당자')).toBeInTheDocument();
    expect(screen.getByText('운송사')).toBeInTheDocument();
  });

  it('입력칸을 고치면 onChange를 부른다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <LoadingInfoPane
        draft={EMPTY_LOADING_INFO_DRAFT}
        onChange={onChange}
        workerLookup={emptyLookup}
        carrierLookup={emptyLookup}
        warehouseResolution={{ kind: 'NONE' }}
      />,
    );

    await user.type(screen.getByLabelText('차량번호'), 'A');

    expect(onChange).toHaveBeenCalledWith({ vehicleNo: 'A' });
  });

  it('창고가 하나면 자동 채움 문구를 낸다', () => {
    render(
      <LoadingInfoPane
        draft={EMPTY_LOADING_INFO_DRAFT}
        onChange={vi.fn()}
        workerLookup={emptyLookup}
        carrierLookup={emptyLookup}
        warehouseResolution={{
          kind: 'AUTO',
          warehouseId: 1001,
          label: 'WH-01 · Synthetic Warehouse',
        }}
      />,
    );

    expect(screen.getByText(/활성 창고가 하나뿐이라 자동으로 정했습니다/)).toBeInTheDocument();
  });

  it('활성 창고가 없으면 오류 배너를 내고 Select를 두지 않는다', () => {
    render(
      <LoadingInfoPane
        draft={EMPTY_LOADING_INFO_DRAFT}
        onChange={vi.fn()}
        workerLookup={emptyLookup}
        carrierLookup={emptyLookup}
        warehouseResolution={{ kind: 'NONE' }}
      />,
    );

    expect(
      screen.getByText(
        '활성 창고가 없어 출하 처리를 할 수 없습니다. 기준정보에서 창고를 등록해 주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('창고가 둘 이상이면 경고 배너와 필수 선택칸을 낸다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const resolution: WarehouseResolution = {
      kind: 'AMBIGUOUS',
      options: [
        { warehouseId: 1001, label: 'WH-01 · X' },
        { warehouseId: 1002, label: 'WH-02 · Y' },
      ],
    };

    render(
      <LoadingInfoPane
        draft={EMPTY_LOADING_INFO_DRAFT}
        onChange={onChange}
        workerLookup={emptyLookup}
        carrierLookup={emptyLookup}
        warehouseResolution={resolution}
      />,
    );

    expect(screen.getByText(/활성 창고가 여러 곳입니다/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('출하 창고'));
    await user.click(screen.getByRole('option', { name: 'WH-02 · Y' }));

    expect(onChange).toHaveBeenCalledWith({ warehouseId: '1002' });
  });

  it('작업자·운송사 조회가 실패하면 사유를 낸다', () => {
    const failed: LookupResult = { entries: [], truncated: false, isError: true, isLoading: false };

    render(
      <LoadingInfoPane
        draft={EMPTY_LOADING_INFO_DRAFT}
        onChange={vi.fn()}
        workerLookup={failed}
        carrierLookup={failed}
        warehouseResolution={{ kind: 'NONE' }}
      />,
    );

    expect(screen.getByText('상차담당자 목록을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('운송사 목록을 불러오지 못했습니다.')).toBeInTheDocument();
  });
});
