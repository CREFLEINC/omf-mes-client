import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { pickDate } from '../../test/date-picker';
import { createBuMapDraft, type BuMapDraft } from './bu-map-draft';
import { BuMapFormDialog } from './bu-map-form-dialog';
import type { SelectOption } from './types';

const draft = (overrides: Partial<BuMapDraft> = {}): BuMapDraft => ({
  ...createBuMapDraft(),
  ...overrides,
});

const BUSINESS_UNITS: SelectOption[] = [
  { value: '5001', label: 'SYN-BU-01 · 합성 사업부 A' },
  { value: '5002', label: 'SYN-BU-02 · 합성 사업부 B' },
];

/** 창 안의 품목 고르기가 검색을 부를 수 있어야 한다 — 부르지 않는 것이 이 창의 기본 상태다. */
const itemSearchStub = createStubFetch([
  {
    match: (request) => new URL(request.url).pathname === '/mdm/items',
    respond: () => jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
  },
]);

const renderDialog = (overrides: Partial<Parameters<typeof BuMapFormDialog>[0]> = {}) => {
  const onClose = vi.fn<() => void>();
  const onConfirm = vi.fn<(next: BuMapDraft) => void>();

  renderWithProviders(
    <BuMapFormDialog
      draft={draft()}
      isNew
      businessUnitOptions={() => BUSINESS_UNITS}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
    { fetch: itemSearchStub },
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

const filled = (overrides: Partial<BuMapDraft> = {}): BuMapDraft =>
  draft({
    fromBusinessUnitId: '5001',
    toBusinessUnitId: '5002',
    toItemId: '1002',
    effectiveFrom: '2026-01-01',
    ...overrides,
  });

/**
 * 전체 치환이라 **확인은 저장이 아니다.**
 * 밝히지 않으면 사용자가 창을 닫는 순간 저장된 줄 알고 화면을 떠난다.
 */
describe('BuMapFormDialog — 확인은 저장이 아니다', () => {
  it('창 안에 표에만 반영된다는 안내가 있다', () => {
    renderDialog();

    expect(
      screen.getByText('확인을 눌러도 아직 저장되지 않습니다. 표를 확인한 뒤 저장하세요.'),
    ).toBeInTheDocument();
  });

  it('확인을 누르면 고친 줄을 바깥에 알린다', async () => {
    const { onConfirm, user } = renderDialog({ draft: filled() });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
      fromBusinessUnitId: '5001',
      toBusinessUnitId: '5002',
      toItemId: '1002',
      effectiveFrom: '2026-01-01',
    });
  });

  it('취소는 바깥에 닫으라고만 알린다', async () => {
    const { onClose, onConfirm, user } = renderDialog({ draft: filled() });

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('BuMapFormDialog — 검증', () => {
  it('필수 넷을 비우면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getAllByText('필수 입력 항목입니다.')).toHaveLength(4);
  });

  /* 계약 `ck_item_bu_map_distinct`. */
  it('보내는 사업부와 받는 사업부가 같으면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: filled({ toBusinessUnitId: '5001' }),
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText('보내는 사업부와 받는 사업부는 서로 달라야 합니다.'),
    ).toBeInTheDocument();
  });

  /* 계약 `ck_item_bu_map_dates` — 짝 제약이라 두 칸에 함께 낸다. */
  it('유효 종료가 유효 시작보다 앞서면 두 칸 모두에 오류가 뜬다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: filled({ effectiveFrom: '2026-03-01', effectiveTo: '2026-02-01' }),
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getAllByText('유효 종료는 유효 시작과 같거나 뒤여야 합니다.')).toHaveLength(2);
  });

  it('유효 종료만 비어 있으면 막지 않는다 — 비우면 무기한이다', async () => {
    const { onConfirm, user } = renderDialog({ draft: filled({ effectiveTo: '' }) });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  /* 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  it('짝 오류는 한쪽만 고쳐도 두 칸에서 함께 사라진다', async () => {
    const { user } = renderDialog({
      draft: filled({ effectiveFrom: '2026-03-01', effectiveTo: '2026-02-01' }),
    });

    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.getAllByText('유효 종료는 유효 시작과 같거나 뒤여야 합니다.')).toHaveLength(2);

    await pickDate(user, screen.getByLabelText('유효 종료'), '2026-04-01');

    expect(
      screen.queryByText('유효 종료는 유효 시작과 같거나 뒤여야 합니다.'),
    ).not.toBeInTheDocument();
  });

  /* 보내는·받는 사업부는 함께 구별 제약을 만든다 — 한쪽을 고치면 그 판정을 다시 한다. */
  it('보내는 사업부를 고치면 구별 제약 오류가 사라진다', async () => {
    const { user } = renderDialog({ draft: filled({ toBusinessUnitId: '5001' }) });

    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(
      screen.getByText('보내는 사업부와 받는 사업부는 서로 달라야 합니다.'),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText('보내는 사업부'));
    await user.click(screen.getByRole('option', { name: 'SYN-BU-02 · 합성 사업부 B' }));

    expect(
      screen.queryByText('보내는 사업부와 받는 사업부는 서로 달라야 합니다.'),
    ).not.toBeInTheDocument();
  });
});

/**
 * M29(사업부 매핑 몫) — 계약이 이 표에 유일 제약을 적지 않았다.
 * 화면이 없는 제약을 흉내 내면 서버가 허용하는 값을 막는다(결정 7).
 */
describe('BuMapFormDialog — 중복을 막지 않는다 (M29)', () => {
  it('다른 줄을 창에 넘기는 통로가 없다', () => {
    renderDialog({ draft: filled() });

    // 창이 다른 줄을 받지 않으므로 중복 판정을 할 수단 자체가 없다.
    expect(screen.queryByText(/중복/)).not.toBeInTheDocument();
  });
});

describe('BuMapFormDialog — 대상 품목은 검색해서 고른다 (결정 8)', () => {
  it('번호를 직접 입력받는 칸이 없다', () => {
    renderDialog({ draft: filled() });

    expect(screen.queryByLabelText('대상 품목 번호')).not.toBeInTheDocument();
    expect(screen.getByLabelText('대상 품목 검색')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '찾기' })).toBeInTheDocument();
  });

  /* 검색 결과에 없어도 지금 고른 값이 이름으로 보여야 한다 — 번호를 내지 않는다. */
  it('지금 고른 대상 품목을 이름으로 낸다', async () => {
    const { user } = renderDialog({
      draft: filled(),
      selectedItemLabel: 'SYN-ITEM-02 · 합성 품목 B',
    });

    await user.click(screen.getByLabelText('대상 품목'));

    expect(screen.getByRole('option', { name: 'SYN-ITEM-02 · 합성 품목 B' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '1002' })).not.toBeInTheDocument();
  });
});
