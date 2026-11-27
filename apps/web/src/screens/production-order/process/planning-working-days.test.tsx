import { expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { createApiClient } from '@omf-mes/api-client';
import userEvent from '@testing-library/user-event';
import { planningDaysResponse, planningDayFixture } from '../../../test/planning-day-fixture';
import { jsonResponse, renderWithProviders } from '../../../test/api-harness';
import { resolvePlanningDays, planningDayKey, PlanningDayNotice } from './planning-working-days';
import { previewSegments } from './segmented-distribution-model';
import { PlanSplitDialog } from './plan-split-dialog';
import { appendProductionPlanRow } from '../../production-plan/editor-state';
it('92일·50대상 한도로 나누며 모든 날짜를 검증하고 조회 누락·실패를 정상으로 보지 않는다', async () => {
  const calls: Request[] = [];
  const api = createApiClient({
    baseUrl: 'http://api.test',
    fetch: async (request) => {
      calls.push(request.clone());
      return planningDaysResponse(request);
    },
  });
  const result = await resolvePlanningDays(
    api.client,
    Array.from({ length: 51 }, (_, i) => ({
      plantId: i + 1,
      from: '2026-01-01',
      to: '2026-07-20',
    })),
  );
  expect(calls.length).toBe(4);
  for (const request of calls) {
    const body = await request.clone().json();
    expect(body.targets.length).toBeLessThanOrEqual(50);
    expect(request.headers.get('Idempotency-Key')).toBeNull();
  }
  expect(result.get(planningDayKey(51, null, '2026-07-20'))?.statusCode).toBe('UNDETERMINED');
  const bad = createApiClient({
    baseUrl: 'http://api.test',
    fetch: async () => jsonResponse({ items: [] }),
  });
  await expect(
    resolvePlanningDays(bad.client, [{ plantId: 1, from: '2026-11-01', to: '2026-11-02' }]),
  ).rejects.toThrow('모두 받지 못했습니다');
});
it('균등 분배는 휴일만 제외하고 수량을 보존하며 직접 일일 입력은 휴일도 허용한다', () => {
  const target = {
    id: 'A',
    label: 'ERP A',
    unit: 'EA',
    pending: 10,
    decimalScale: 0,
    lines: [{ id: 1, code: 'L', name: '라인' }],
  };
  const segment = {
    id: 's',
    owner: 'A',
    start: '2026-11-09',
    end: '2026-11-11',
    lineId: '1',
    mode: 'equal' as const,
    quantity: '10',
    daily: { '2026-11-10': '4' },
  };
  const days = new Map([
    [
      's',
      [
        planningDayFixture('2026-11-09', 'WORKING'),
        planningDayFixture('2026-11-10', 'HOLIDAY'),
        planningDayFixture('2026-11-11', 'UNDETERMINED'),
      ],
    ],
  ]);
  const result = previewSegments([target], [segment], [], days);
  expect(result.drafts.map((d) => [d.planDate, d.plannedQty, d.planDateSourceCode])).toEqual([
    ['2026-11-09', '5', 'SYSTEM'],
    ['2026-11-11', '5', 'SYSTEM'],
  ]);
  expect(
    previewSegments([target], [{ ...segment, includeHolidays: true }], [], days).drafts,
  ).toEqual([
    expect.objectContaining({
      planDate: '2026-11-09',
      plannedQty: '4',
      planDateSourceCode: 'SYSTEM',
    }),
    expect.objectContaining({
      planDate: '2026-11-10',
      plannedQty: '3',
      planDateSourceCode: 'USER',
    }),
    expect.objectContaining({
      planDate: '2026-11-11',
      plannedQty: '3',
      planDateSourceCode: 'SYSTEM',
    }),
  ]);
  expect(previewSegments([target], [{ ...segment, mode: 'daily' }], [], days).drafts).toEqual([
    expect.objectContaining({
      planDate: '2026-11-10',
      plannedQty: '4',
      planDateSourceCode: 'USER',
    }),
  ]);
  expect(() =>
    previewSegments(
      [target],
      [segment],
      [],
      new Map([
        [
          's',
          [9, 10, 11].map((n) =>
            planningDayFixture(`2026-11-${String(n).padStart(2, '0')}`, 'HOLIDAY'),
          ),
        ],
      ]),
    ),
  ).toThrow('편성 가능한 날짜');
});
it('분할 순차 날짜는 기존 휴일을 제외하고 SYSTEM 출처와 총수량을 유지한다', async () => {
  const user = userEvent.setup(),
    onApply = vi.fn();
  const row = appendProductionPlanRow([], 'new', {
    bomId: '1',
    routingId: '1',
    planDate: '2026-11-13',
    plannedQty: '10',
    plannedLineId: '1',
  })[0]!;
  renderWithProviders(
    <PlanSplitDialog
      row={row}
      plantId={1}
      planName="계획 A"
      lineName="라인 A"
      unit="EA"
      decimalScale={0}
      onClose={() => {}}
      onApply={onApply}
    />,
    {
      fetch: (request) =>
        planningDaysResponse(request, (date) =>
          [0, 6].includes(new Date(date + 'T12:00:00Z').getUTCDay()) ? 'HOLIDAY' : 'WORKING',
        ),
    },
  );
  await user.clear(screen.getByRole('textbox', { name: '분할 후 계획 건수' }));
  await user.type(screen.getByRole('textbox', { name: '분할 후 계획 건수' }), '3');
  await user.click(screen.getByRole('button', { name: '분할 조건 적용' }));
  expect(await screen.findByRole('button', { name: '계획 2 계획일' })).toHaveTextContent(
    '2026-11-16',
  );
  expect(screen.getByRole('textbox', { name: '2026-11-14 휴일 생산량' })).toHaveValue('0');
  expect(screen.getByRole('textbox', { name: '2026-11-14 휴일 생산량' })).toBeEnabled();
  expect(screen.getByRole('textbox', { name: '2026-11-15 휴일 생산량' })).toHaveValue('0');
  await user.click(screen.getByRole('button', { name: '분할 적용' }));
  expect(onApply).toHaveBeenCalledWith([
    { plannedQty: '4', planDate: '2026-11-13', planDateSourceCode: 'SYSTEM' },
    { plannedQty: '3', planDate: '2026-11-16', planDateSourceCode: 'SYSTEM' },
    { plannedQty: '3', planDate: '2026-11-17', planDateSourceCode: 'SYSTEM' },
  ]);
  await user.clear(screen.getByRole('textbox', { name: '2026-11-14 휴일 생산량' }));
  await user.type(screen.getByRole('textbox', { name: '2026-11-14 휴일 생산량' }), '1');
  expect(screen.getByRole('button', { name: '분할 적용' })).toBeDisabled();
  await user.clear(screen.getByRole('textbox', { name: '계획 1 생산량' }));
  await user.type(screen.getByRole('textbox', { name: '계획 1 생산량' }), '3');
  await user.click(screen.getByRole('button', { name: '분할 적용' }));
  expect(screen.getByRole('button', { name: '2026-11-14 휴일 계획일' })).toHaveTextContent(
    '2026-11-14',
  );
  expect(
    screen
      .getByRole('textbox', { name: '2026-11-14 휴일 생산량' })
      .closest('tr')
      ?.querySelector('td'),
  ).toHaveTextContent('2');
  expect(
    screen.getByRole('button', { name: '계획 2 계획일' }).closest('tr')?.querySelector('td'),
  ).toHaveTextContent('3');
  expect(onApply).toHaveBeenLastCalledWith([
    { plannedQty: '3', planDate: '2026-11-13', planDateSourceCode: 'SYSTEM' },
    { plannedQty: '1', planDate: '2026-11-14', planDateSourceCode: 'USER' },
    { plannedQty: '3', planDate: '2026-11-16', planDateSourceCode: 'SYSTEM' },
    { plannedQty: '3', planDate: '2026-11-17', planDateSourceCode: 'SYSTEM' },
  ]);
  await user.click(screen.getByRole('button', { name: '2026-11-14 휴일 삭제' }));
  expect(screen.queryByRole('textbox', { name: '2026-11-14 휴일 생산량' })).toBeNull();
  expect(screen.getByRole('button', { name: '분할 적용' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '계획 2 계획일' }).closest('tr')?.querySelector('td'),
  ).toHaveTextContent('2');
  expect(screen.getByRole('checkbox', { name: '휴일 포함' })).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: '휴일 포함' }));
  await user.click(screen.getByRole('button', { name: '분할 조건 적용' }));
  expect(await screen.findByRole('button', { name: '계획 2 계획일' })).toHaveTextContent(
    '2026-11-14',
  );
  await user.click(screen.getByRole('button', { name: '분할 적용' }));
  expect(onApply).toHaveBeenLastCalledWith([
    { plannedQty: '4', planDate: '2026-11-13', planDateSourceCode: 'SYSTEM' },
    { plannedQty: '3', planDate: '2026-11-14', planDateSourceCode: 'USER' },
    { plannedQty: '3', planDate: '2026-11-15', planDateSourceCode: 'USER' },
  ]);
});
it('휴일·판정 불가 정보는 경고로만 표시한다', () => {
  renderWithProviders(
    <>
      <PlanningDayNotice day={planningDayFixture('2026-11-13', 'HOLIDAY')} />
      <PlanningDayNotice day={planningDayFixture('2026-11-14')} />
    </>,
  );
  expect(screen.getByText('휴일입니다 (공휴일)')).toBeVisible();
  expect(screen.getByText('작업 캘린더 미설정')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

vi.mock('../../../patterns/plant-time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../patterns/plant-time')>()),
  plantToday: () => '2026-11-01',
}));
