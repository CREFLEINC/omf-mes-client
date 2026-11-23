import { messages } from '@omf-mes/i18n';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import {
  dispositionStub,
  lotFixture,
  requestedPaths,
  requestsSent,
  saveAndConfirm,
} from './fixtures';
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
      saveResponse: () =>
        jsonResponse({ outcome: 'APPLIED', decision: SORT_RESPONSE }, { status: 200 }),
    });
    await screen.findByText('SAMPLE-ML|0003');

    await user.click(screen.getByRole('radio', { name: '선별' }));
    await user.click(screen.getByRole('checkbox', { name: 'SAMPLE-ML|0003' }));
    // 선별 규칙 · 정보 수량의 뜻은 늘 펼쳐 두지 않고 ⓘ 로 둔다(관리웹 정리 시안 A).
    expect(screen.getByRole('button', { name: t.sort.help })).toBeInTheDocument();
    expect(screen.queryByText(t.sort.help)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: t.sort.qtyNote })).toHaveLength(2);
    // 저장 후 처리 — 처리 이름과 대상 LOT · 수량, 아래 짧은 안내(#352).
    const preview = screen.getByRole('group', { name: t.sort.previewTitle });
    expect(
      within(preview).getByText(t.sort.previewTarget('0001, 0002', '2,000 EA')),
    ).toBeInTheDocument();
    expect(within(preview).getByText(t.sort.previewTarget('0003', '1,000 EA'))).toBeInTheDocument();
    expect(within(preview).getByText(t.sort.previewNotes[0] ?? '')).toBeInTheDocument();
    // 고른 대로 양품 · 불량 수량이 «값으로» 채워지고, 사용자가 고쳐 쓸 수 있다(#352).
    expect(screen.getByLabelText(t.sort.goodQty)).toHaveValue('2000');
    expect(screen.getByLabelText(t.sort.defectQty)).toHaveValue('1000');
    await user.clear(screen.getByLabelText(t.sort.defectQty));
    await user.type(screen.getByLabelText(t.sort.defectQty), '1050');
    await user.type(screen.getByLabelText(t.form.reasonLabel), '합성 선별 사유');
    await saveAndConfirm(user);

    await waitFor(() => expect(sortPost()).toBeDefined());
    // 수량 분할 본문 없이 — 고른 LOT 과 정보 수량만.
    await expect(sortPost()?.json()).resolves.toEqual({
      dispositionTypeCode: 'SORT',
      lotIds: [8203],
      goodQty: 2000,
      defectQty: 1050,
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
    // 정보 수량은 천 단위 쉼표(G2 L6).
    expect(screen.getByText(t.sort.resultInfo('2,000', '1,050'))).toBeInTheDocument();

    // 새 부적합은 링크 — 누르면 그 부적합을 연다.
    await user.click(screen.getByRole('button', { name: 'SAMPLE-NC-0052' }));
    await waitFor(() => expect(requestedPaths()).toContain('/quality/nonconformances/52'));
  });

  it('US7-2 전부 고르면 막는다 — 원래 입하 LOT 에 하나 이상 남아야 한다. 하나도 안 골라도 저장할 수 없다', async () => {
    const { user } = renderSort();
    await screen.findByText('SAMPLE-ML|0003');

    await user.click(screen.getByRole('radio', { name: '선별' }));
    // 고르기 전에는 목록 위 안내만, 저장 후 처리 요약은 없다(#352).
    expect(screen.getByText(t.sort.selectNote)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: t.sort.previewTitle })).toBeNull();
    await user.type(screen.getByLabelText(t.form.reasonLabel), '합성 선별 사유');
    const save = screen.getByRole('button', { name: t.actions.save });
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

  it('US7-2 선별로 생긴 부적합에도 정상 처분은 없다 — 폐기를 고를 수 있다', async () => {
    renderSort({
      nonconformance: {
        inboundLotNo: 'SAMPLE-IL-0502',
        sortedFromNonconformanceId: 40,
        sortedFromNonconformanceNo: 'SAMPLE-NC-0040',
      },
    });
    await screen.findByText('SAMPLE-ML|0003');

    /* #352 — 정상 · 재작업은 어느 부적합에서도 고르지 않는다. */
    expect(screen.queryByRole('radio', { name: '정상' })).toBeNull();
    expect(screen.queryByRole('radio', { name: '재작업' })).toBeNull();
    expect(screen.getByRole('radio', { name: '폐기' })).toBeEnabled();
    /* 심각도 오른쪽 「기존 부적합 건」 칸 — [기존 부적합 건 조회] 단추(#352). */
    expect(
      screen.getByRole('button', { name: t.inboundLot.openSortedFrom('SAMPLE-NC-0040') }),
    ).toHaveTextContent('기존 부적합 건 조회');
  });
});
