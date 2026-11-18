import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { jsonResponse, renderWithProviders } from '../../../test/api-harness';
import {
  ReleaseMaterials,
  useReleaseMaterials,
  stockQuantity,
  normalizedRate,
  editableRate,
  type MaterialRequirement,
} from './release-materials';
const row: MaterialRequirement = {
  bomComponentId: 1,
  itemId: 2,
  itemCode: 'SYN-RESIN',
  itemName: '시험 자재',
  bomQty: 367,
  bomUomId: 1,
  bomUomCode: 'GR',
  stockUomId: 2,
  stockUomCode: 'KG',
  stockUomScale: 3,
  stockQty: 0.367,
  conversionSource: 'COMMON',
  conversionRate: 1000,
  confirmationRequired: true,
};
const Harness = () => {
  const review = useReleaseMaterials([{ workOrderId: 1, workOrderNo: 'SYN-WO' }], true);
  return (
    <>
      <ReleaseMaterials review={review} />
      <button disabled={!review.ready}>배포</button>
      <output aria-label="배포 본문">{JSON.stringify(review.confirmations)}</output>
    </>
  );
};
describe('자재 환산 확인', () => {
  it('재고 단위 자릿수로 정확히 올리고 입력 비율을 8자리 반올림한다', () => {
    expect(stockQuantity(367, 1000, 3)).toBe('0.367');
    expect(stockQuantity(0.4, 1000, 3)).toBe('0.001');
    expect(stockQuantity(1, 3, 0)).toBe('1');
    expect(normalizedRate('0.000000004')).toBeNull();
    expect(normalizedRate('0.000000005')).toBe(0.00000001);
    expect(editableRate(row)).toBe(false);
    expect(editableRate({ ...row, bomUomCode: 'PC', stockUomCode: 'EA' })).toBe(true);
    expect(editableRate({ ...row, conversionSource: 'ITEM' })).toBe(false);
  });
  it('공통 질량 환산은 편집 없이 확인해야 배포할 수 있다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, { fetch: async () => jsonResponse({ items: [row] }) });
    const checkbox = await screen.findByRole('checkbox', { name: 'SYN-WO SYN-RESIN 환산 확인' });
    expect(screen.getByRole('button', { name: '배포' })).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: /환산 비율/ })).not.toBeInTheDocument();
    await user.click(checkbox);
    expect(screen.getByRole('button', { name: '배포' })).toBeEnabled();
    expect(screen.getByLabelText('배포 본문')).toHaveTextContent('"confirmed":true');
  });
  it('환산이 없으면 비율 입력·결과 확인 후 배포하고 비율 수정 시 확인을 해제한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, {
      fetch: async () =>
        jsonResponse({
          items: [{ ...row, conversionSource: 'NONE', conversionRate: null, stockQty: null }],
        }),
    });
    const input = await screen.findByRole('textbox', { name: 'SYN-WO SYN-RESIN 환산 비율' });
    const checkbox = screen.getByRole('checkbox', { name: /환산 확인/ });
    expect(checkbox).toBeDisabled();
    await user.type(input, '1000');
    expect(screen.getByText('0.367 KG')).toBeVisible();
    await user.click(checkbox);
    expect(screen.getByRole('button', { name: '배포' })).toBeEnabled();
    expect(screen.getByLabelText('배포 본문')).toHaveTextContent('"conversionRate":1000');
    await user.clear(input);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: '배포' })).toBeDisabled();
  });
  it('조회 실패 시 배포를 허용하지 않는다', async () => {
    renderWithProviders(<Harness />, { fetch: async () => jsonResponse({}, { status: 500 }) });
    await screen.findByText('자재 소요를 조회하지 못했습니다. 다시 조회하세요.');
    expect(screen.getByRole('button', { name: '배포' })).toBeDisabled();
  });
});
