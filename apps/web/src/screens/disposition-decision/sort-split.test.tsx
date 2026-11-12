import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { dispositionStub, lotFixture, requestedPaths, requestsSent } from './fixtures';
import { DispositionDecisionScreen } from './screen';

/* 005 T094 — W-03-10 선별 = 불량 자재 관리 LOT 를 새 입하 LOT 로 분리(US7-2 · FR-041). 값은 전부 지어낸 합성값이다. */

const t = messages.dispositionDecision;
const TODAY = new Date(2026, 10, 11);
const KST = 540;

type User = ReturnType<typeof userEvent.setup>;

const LOTS = [1, 2, 3].map((n) =>
  lotFixture({
    nonconformanceLotId: 9200 + n,
    lotId: 8200 + n,
    lotNo: `SAMPLE-ML|000${String(n)}`,
    affectedQty: 1000,
  }),
);

const SORT_RESPONSE = {
  dispositionDecisionId: 3101,
  nonconformanceId: 41,
  dispositionTypeCode: 'SORT',
  decisionQty: 2000,
  uomId: 7001,
  reason: '합성 선별 사유',
  decidedBy: 4001,
  decidedAt: '2026-11-11T14:10:00+07:00',
  newInboundLotId: 502,
  newInboundLotNo: 'SAMPLE-IL-0502',
  newNonconformanceId: 52,
  newNonconformanceNo: 'SAMPLE-NC-0052',
  newInspectionRequestNo: 'SAMPLE-IR-0716',
};

const renderSort = (options: Parameters<typeof dispositionStub>[0] = {}): { user: User } => {
  renderWithProviders(
    <SessionProvider>
      <DispositionDecisionScreen today={TODAY} offsetMinutes={KST} />
    </SessionProvider>,
    {
      session: SYNTHETIC_SESSION,
      fetch: dispositionStub({
        lots: LOTS,
        nonconformance: {
          inspectionRequestId: 701,
          inspectionRequestNo: 'SAMPLE-IR-0701',
          inboundLotNo: 'SAMPLE-IL-0501',
        },
        concessions: [],
        ...options,
      }),
      route: '/quality/dispositions?nonconformanceId=41',
    },
  );
  return { user: userEvent.setup() };
};

const sortPost = (): Request | undefined =>
  requestsSent().find((request) => request.method === 'POST');

describe('W-03-10 선별', () => {
  it('US7-2 불량 자재 관리 LOT 를 골라 저장하면 새 입하 LOT · 새 부적합 번호를 보인다', async () => {
    const { user } = renderSort({
      saveResponse: () => jsonResponse(SORT_RESPONSE, { status: 200 }),
    });
    await screen.findByText('SAMPLE-ML|0003');

    await user.click(screen.getByRole('radio', { name: '선별' }));
    await user.click(screen.getByRole('checkbox', { name: 'SAMPLE-ML|0003' }));
    // 저장하면 무엇이 일어나는지 미리 보인다 — 번호는 실행 응답으로만 안다.
    expect(screen.getByText(t.sort.previewRest('0001, 0002', '2,000 EA'))).toBeInTheDocument();
    expect(screen.getByText(t.sort.previewMoved('0003', '1,000 EA'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.sort.defectQty), '12');
    await user.type(screen.getByLabelText(t.form.reasonLabel), '합성 선별 사유');
    await user.click(screen.getByRole('button', { name: t.sort.save }));

    await waitFor(() => expect(sortPost()).toBeDefined());
    // 수량 분할 본문 없이 — 고른 LOT 과 정보 수량만.
    await expect(sortPost()?.json()).resolves.toEqual({
      dispositionTypeCode: 'SORT',
      lotIds: [8203],
      defectQty: 12,
      reason: '합성 선별 사유',
    });
    expect(await screen.findByText(t.sort.resultTitle)).toBeInTheDocument();
    expect(screen.getByText(t.sort.resultRest('0001, 0002'))).toBeInTheDocument();
    expect(
      screen.getByText(t.sort.resultMoved('0003', 'SAMPLE-IL-0502'), { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.sort.toast('0003', 'SAMPLE-IL-0502', 'SAMPLE-NC-0052')),
    ).toBeInTheDocument();
    expect(screen.getByText(t.sort.resultInfo(t.values.unknownQty, '12'))).toBeInTheDocument();

    // 새 부적합은 링크 — 누르면 그 부적합을 연다.
    await user.click(screen.getByRole('button', { name: 'SAMPLE-NC-0052' }));
    await waitFor(() => expect(requestedPaths()).toContain('/quality/nonconformances/52'));
  });

  it('US7-2 전부 고르면 막는다 — 원래 입하 LOT 에 하나 이상 남아야 한다. 하나도 안 골라도 저장할 수 없다', async () => {
    const { user } = renderSort();
    await screen.findByText('SAMPLE-ML|0003');

    await user.click(screen.getByRole('radio', { name: '선별' }));
    await user.type(screen.getByLabelText(t.form.reasonLabel), '합성 선별 사유');
    const save = screen.getByRole('button', { name: t.sort.save });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(t.sort.noneSelected);

    for (const n of [1, 2, 3]) {
      await user.click(screen.getByRole('checkbox', { name: `SAMPLE-ML|000${String(n)}` }));
    }

    expect(screen.getByText(t.sort.allSelected)).toBeInTheDocument();
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(t.sort.allSelected);
    expect(sortPost()).toBeUndefined();
  });

  it('US7-2 첫 판정이 아니면 선별이 없다 — 잠그고 이유를 단다', async () => {
    renderSort({ decidedQty: 100 });
    await screen.findByText('SAMPLE-ML|0003');

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '선별' })).toHaveAccessibleDescription(
        t.form.typeLock.sortNotFirst,
      ),
    );
    expect(screen.getByRole('radio', { name: '선별' })).toBeDisabled();
  });

  it('US7-2 자재 관리 LOT 가 하나면 선별할 수 없다', async () => {
    renderSort({ lots: [LOTS[0]] });
    await screen.findByText('SAMPLE-ML|0001');

    expect(screen.getByRole('radio', { name: '선별' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '선별' })).toHaveAccessibleDescription(
      t.form.typeLock.sortSingleLot,
    );
  });

  it('US7-2 선별로 생긴 부적합은 정상 처분이 없다', async () => {
    renderSort({
      nonconformance: {
        inboundLotNo: 'SAMPLE-IL-0502',
        sortedFromNonconformanceId: 40,
        sortedFromNonconformanceNo: 'SAMPLE-NC-0040',
      },
    });
    await screen.findByText('SAMPLE-ML|0003');

    expect(screen.getByRole('radio', { name: '정상' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '정상' })).toHaveAccessibleDescription(
      t.form.typeLock.normalSorted,
    );
    expect(screen.getByRole('button', { name: 'SAMPLE-NC-0040' })).toBeInTheDocument();
  });
});
