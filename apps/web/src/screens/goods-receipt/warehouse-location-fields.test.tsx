import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { locationFixtures, warehouseFixtures } from './fixtures';
import type { OptionListResult } from './queries';
import type { LocationView, WarehouseView } from './types';
import { WarehouseLocationFields } from './warehouse-location-fields';

const t = messages.goodsReceipt;

/* 픽스처는 화면이 읽는 필드만 담는다 — 응답 → 화면 타입 변환은 `types.test.ts`가 검사한다. */
const WAREHOUSES: WarehouseView[] = warehouseFixtures;
const LOCATIONS: LocationView[] = locationFixtures;

const list = <TItem,>(
  items: TItem[],
  overrides: Partial<OptionListResult<TItem>> = {},
): OptionListResult<TItem> => ({
  items,
  truncated: false,
  isError: false,
  isLoading: false,
  refetch: () => undefined,
  ...overrides,
});

const renderFields = (
  overrides: {
    warehouses?: OptionListResult<WarehouseView>;
    locations?: OptionListResult<LocationView>;
    warehouseValue?: string;
    locationValue?: string;
    fieldErrors?: Record<string, string>;
    isLocked?: boolean;
    warehousePlantName?: string | null;
    isPlantMismatch?: boolean;
  } = {},
) => {
  const onChangeWarehouse = vi.fn();
  const onChangeLocation = vi.fn();
  const onRetryOptions = vi.fn();

  render(
    <WarehouseLocationFields
      warehouses={overrides.warehouses ?? list(WAREHOUSES)}
      locations={overrides.locations ?? list(LOCATIONS)}
      warehouseValue={overrides.warehouseValue ?? ''}
      locationValue={overrides.locationValue ?? ''}
      fieldErrors={overrides.fieldErrors ?? {}}
      isLocked={overrides.isLocked ?? false}
      warehousePlantName={overrides.warehousePlantName ?? null}
      isPlantMismatch={overrides.isPlantMismatch ?? false}
      onChangeWarehouse={onChangeWarehouse}
      onChangeLocation={onChangeLocation}
      onRetryOptions={onRetryOptions}
    />,
  );

  return { onChangeWarehouse, onChangeLocation, onRetryOptions, user: userEvent.setup() };
};

const warehouseBox = (): HTMLElement => screen.getByRole('combobox', { name: t.fields.warehouse });
const locationBox = (): HTMLElement => screen.getByRole('combobox', { name: t.fields.location });

describe('WarehouseLocationFields — 창고를 고르기 전', () => {
  /*
   * 계약이 위치 조회에 `warehouseId`를 필수로 요구한다(실측). 열어 두면 고를 수 없는 칸을
   * 눌러 보게 되고, 잠그기만 하면 무엇을 해야 풀리는지 알 수 없다.
   */
  it('위치 칸이 잠기고 사유가 항상 보이는 문구로 붙는다', () => {
    renderFields();

    expect(locationBox()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.locationNeedsWarehouse)).toBeInTheDocument();
    expect(locationBox()).toHaveAccessibleDescription(t.actionReasons.locationNeedsWarehouse);
  });

  /* 짝 방향 — 창고 칸은 열려 있어야 한다. 둘 다 잠기면 시작할 수 없다. */
  it('창고 칸은 열려 있다', () => {
    renderFields();

    expect(warehouseBox()).not.toBeDisabled();
  });

  it('창고를 고르면 그 값이 그대로 올라간다', async () => {
    const { onChangeWarehouse, user } = renderFields();

    await user.click(warehouseBox());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-WH-01 · 합성 창고 가' }));

    expect(onChangeWarehouse).toHaveBeenCalledWith('9701');
  });
});

describe('WarehouseLocationFields — 창고를 고른 뒤', () => {
  it('위치 칸이 열린다', () => {
    renderFields({ warehouseValue: '9701' });

    expect(locationBox()).not.toBeDisabled();
    expect(screen.queryByText(t.actionReasons.locationNeedsWarehouse)).not.toBeInTheDocument();
  });

  /* 상위 위치로 묶인 1단 그룹이 실제로 그려지는지 본다(계획 결정 7). */
  it('위치 선택지가 상위 위치 그룹으로 묶여 보인다', async () => {
    const { user } = renderFields({ warehouseValue: '9701' });

    await user.click(locationBox());

    const group = screen.getByRole('group', { name: 'SAMPLE-LOC-A · 합성 구역 가' });

    expect(within(group).getByRole('option', { name: 'SAMPLE-LOC-A1 · 합성 열 가1' })).toBeInTheDocument();
    expect(within(group).getByRole('option', { name: 'SAMPLE-LOC-A2 · 합성 열 가2' })).toBeInTheDocument();
    /* 3단 깊이는 직속 상위의 그룹으로 간다 — 최상위 그룹에 올려 붙이지 않는다. */
    expect(within(group).queryByRole('option', { name: /SAMPLE-LOC-A1-1/ })).not.toBeInTheDocument();
  });

  it('상위가 없는 위치는 그룹 밖 평면으로 보인다', async () => {
    const { user } = renderFields({ warehouseValue: '9701' });

    await user.click(locationBox());

    expect(screen.getByRole('option', { name: 'SAMPLE-LOC-A · 합성 구역 가' })).toBeInTheDocument();
  });

  it('위치를 고르면 그 값이 그대로 올라간다', async () => {
    const { onChangeLocation, user } = renderFields({ warehouseValue: '9701' });

    await user.click(locationBox());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-LOC-A1 · 합성 열 가1' }));

    expect(onChangeLocation).toHaveBeenCalledWith('9802');
  });
});

describe('WarehouseLocationFields — 목록의 한계', () => {
  /*
   * **M21** — 잘린 목록을 완전한 것으로 읽으면 사용자가 「그런 창고가 없다」로 결론짓는다.
   * 고를 수 없는 값이 생겼다는 사실을 밝힌다.
   */
  it('창고 목록이 잘리면 그 사실을 밝힌다', () => {
    renderFields({ warehouses: list(WAREHOUSES, { truncated: true }) });

    expect(warehouseBox()).toHaveAccessibleDescription(t.filters.lookupTruncated);
  });

  it('위치 목록이 잘리면 그 사실을 밝힌다', () => {
    renderFields({ warehouseValue: '9701', locations: list(LOCATIONS, { truncated: true }) });

    expect(locationBox()).toHaveAccessibleDescription(t.filters.lookupTruncated);
  });

  /* 짝 방향 — 잘리지 않았으면 안내를 내지 않는다. 늘 뜨는 안내는 아무것도 말하지 않는다. */
  it('잘리지 않으면 안내를 내지 않는다', () => {
    renderFields({ warehouseValue: '9701' });

    expect(screen.queryByText(t.filters.lookupTruncated)).not.toBeInTheDocument();
  });

  /* 실패는 잘림과 다르다 — 다시 부르면 풀릴 수 있으므로 복구 수단을 함께 낸다. */
  it('선택지 조회가 실패하면 사유와 다시 시도가 함께 나온다', async () => {
    const { onRetryOptions, user } = renderFields({
      warehouses: list<WarehouseView>([], { isError: true }),
    });

    expect(screen.getByText(t.reasons.postOptionsFailed)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryOptions).toHaveBeenCalledTimes(1);
  });

  it('실패가 아니면 다시 시도를 내지 않는다', () => {
    renderFields();

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});

describe('WarehouseLocationFields — 공장 표기', () => {
  /* 요청에 싣는 공장은 입하 전표의 값이다 — 어디서 오는지 밝히지 않으면 화면에서 읽을 수 없다. */
  it('공장이 입하 전표에서 온다는 사실을 늘 밝힌다', () => {
    renderFields();

    expect(screen.getByText(t.notes.plantFromInboundReceipt)).toBeInTheDocument();
  });

  it('고른 창고의 공장을 함께 보인다', () => {
    renderFields({ warehouseValue: '9701', warehousePlantName: 'SAMPLE-PLT-01 · 합성 공장 가' });

    expect(
      screen.getByText(t.notes.warehousePlant('SAMPLE-PLT-01 · 합성 공장 가')),
    ).toBeInTheDocument();
  });

  /* 다르면 눈에 보이게 하되 **막지 않는다** — 조합 규칙이 데이터에 없어 화면이 판정할 수 없다. */
  it('창고의 공장이 전표와 다르면 그 사실을 밝히고도 칸을 잠그지 않는다', () => {
    renderFields({
      warehouseValue: '9702',
      warehousePlantName: 'SAMPLE-PLT-02 · 합성 공장 나',
      isPlantMismatch: true,
    });

    expect(screen.getByText(t.notes.warehousePlantDiffers)).toBeInTheDocument();
    expect(warehouseBox()).not.toBeDisabled();
    expect(locationBox()).not.toBeDisabled();
  });

  it('어긋나지 않으면 그 안내를 내지 않는다', () => {
    renderFields({ warehouseValue: '9701', warehousePlantName: 'SAMPLE-PLT-01 · 합성 공장 가' });

    expect(screen.queryByText(t.notes.warehousePlantDiffers)).not.toBeInTheDocument();
  });
});

describe('WarehouseLocationFields — 전송 중', () => {
  it('두 칸과 다시 시도가 모두 잠긴다', () => {
    renderFields({
      warehouseValue: '9701',
      isLocked: true,
      warehouses: list(WAREHOUSES, { isError: true }),
    });

    expect(warehouseBox()).toBeDisabled();
    expect(locationBox()).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeDisabled();
  });
});
