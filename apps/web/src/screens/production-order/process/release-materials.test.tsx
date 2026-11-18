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
  it('등록된 환산 비율은 별도 확인 없이 배포 본문에 반영한다', async () => {
    renderWithProviders(<Harness />, { fetch: async () => jsonResponse({ items: [row] }) });
    expect(await screen.findByText('0.367 KG')).toBeVisible();
    expect(screen.getByRole('button', { name: '배포' })).toBeEnabled();
    expect(screen.getByLabelText('배포 본문')).toHaveTextContent('"confirmed":true');
    expect(screen.queryByRole('button', { name: /수량 확인/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 조회' })).not.toBeInTheDocument();
  });
  it('환산이 없으면 유효한 비율 입력 후 배포하고 입력을 지우면 배포를 막는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, {
      fetch: async () =>
        jsonResponse({
          items: [{ ...row, conversionSource: 'NONE', conversionRate: null, stockQty: null }],
        }),
    });
    const input = await screen.findByRole('textbox', { name: 'SYN-WO SYN-RESIN 환산 비율' });
    expect(screen.getByRole('button', { name: '배포' })).toBeDisabled();
    await user.type(input, '1000');
    expect(screen.getByText('0.367 KG')).toBeVisible();
    expect(screen.getByRole('button', { name: '배포' })).toBeEnabled();
    expect(screen.getByLabelText('배포 본문')).toHaveTextContent('"conversionRate":1000');
    expect(screen.getByLabelText('배포 본문')).toHaveTextContent('"confirmed":true');
    await user.clear(input);
    expect(screen.getByRole('button', { name: '배포' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('환산 비율을 확인하세요.');
  });
  it('0 입력 오류는 입력란 밖에 표시하고 단위와 확인 버튼 배치를 유지한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, {
      fetch: async () =>
        jsonResponse({
          items: [{ ...row, conversionSource: 'NONE', conversionRate: null, stockQty: null }],
        }),
    });
    const input = await screen.findByRole('textbox', { name: /환산 비율/ });
    await user.type(input, '0');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('환산 비율에 0을 입력할 수 없습니다.');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(error.closest('.release-material-rate')).toBeNull();
    expect(screen.getByRole('button', { name: '배포' })).toBeDisabled();
  });
  it('소수 자릿수가 많은 소요량과 환산 비율도 생략하지 않는다', async () => {
    renderWithProviders(<Harness />, {
      fetch: async () =>
        jsonResponse({
          items: [
            {
              ...row,
              bomQty: 0.00000001,
              stockQty: 1.234567,
              stockUomScale: 6,
              conversionRate: 0.00012345,
              conversionSource: 'ITEM',
            },
          ],
        }),
    });
    expect(await screen.findByText('0.00000001 GR')).toBeVisible();
    expect(screen.getByText('1.234567 KG')).toBeVisible();
    expect(screen.getByText('0.00012345')).toBeVisible();
  });
  it('환산 출처는 도움말에만 표시한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, { fetch: async () => jsonResponse({ items: [row] }) });
    expect(await screen.findByRole('heading', { name: '자재 소요량 확인' })).toBeVisible();
    const help = await screen.findByRole('button', { name: 'SYN-WO SYN-RESIN 환산 비율 도움말' });
    expect(screen.queryByText('공통 환산')).not.toBeInTheDocument();
    await user.hover(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '단위 사이에 정해진 기본 환산 비율',
    );
  });
  it('환산 미등록 표시는 입력 전까지만 보이고 입력 후에는 비율만 표시한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, {
      fetch: async () =>
        jsonResponse({
          items: [{ ...row, conversionSource: 'NONE', conversionRate: null, stockQty: null }],
        }),
    });
    expect(await screen.findByText('환산 비율 미등록')).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: /환산 비율/ }), '2');
    expect(screen.queryByText('환산 비율 미등록')).not.toBeInTheDocument();
    expect(screen.queryByText('직접 입력한 비율')).not.toBeInTheDocument();
  });
  it('조회 실패 시 배포를 허용하지 않는다', async () => {
    renderWithProviders(<Harness />, { fetch: async () => jsonResponse({}, { status: 500 }) });
    await screen.findByText('자재 소요를 조회하지 못했습니다. 다시 조회하세요.');
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '배포' })).toBeDisabled();
  });
});
