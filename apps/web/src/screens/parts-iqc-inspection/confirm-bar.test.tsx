import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { InboundDetail } from './inbound-detail';
import type { InboundInspection } from './inbound-queries';

/**
 * 005 T075 · T083 — W-01-01 판정 확정 · 확정 취소(권한 W-01-15 · screens/W-01-01.md). 지어낸 값만 쓴다.
 */

const t = messages.iqcInboundLot;

const session = (permissions: string[]): Session => ({
  userId: 8101,
  loginId: 'TST-LOGIN-01',
  userName: '합성 사용자',
  scopes: [{ businessUnitId: 8301 }],
  mustChangePassword: false,
  roles: [],
  permissions,
});

const lot = (lotId: number) => ({
  lotId,
  lotNo: `TST-ITEM|1000|991111|TS01|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: null,
  statusCode: 'INSPECTION_PENDING',
  goodsReceived: false,
});

const result = (seqNo: number, judgment: string | null) => ({
  inspectionResultId: 700 + seqNo,
  inspectionResultNo: `TST-IR-${String(seqNo)}`,
  seqNo,
  overallJudgmentCode: judgment,
  inspectedQty: 200,
  rejectedQty: 0,
  defectNames: [],
  matchedLotIds: [],
  inspectorName: '합성 검사자',
  inspectedAt: '2099-11-11T01:00:00Z',
  statusCode: 'DRAFT',
  versionNo: 2,
});

const base = (over: Partial<InboundInspection> = {}): InboundInspection =>
  ({
    inspectionRequestId: 501,
    inspectionRequestNo: 'TST-REQ-0501',
    inspectionTypeCode: 'IQC',
    targetTypeCode: 'INBOUND_LOT',
    targetId: 77,
    itemId: 31,
    targetQty: 2000,
    uomId: 1,
    statusCode: 'IN_PROGRESS',
    requestedAt: '2099-11-11T01:00:00Z',
    versionNo: 5,
    inboundLotId: 77,
    inboundLotNo: 'IL-20991111-0003',
    inboundLotVersionNo: 4,
    confirmedAt: null,
    overallJudgmentCode: null,
    previewJudgmentCode: 'ACCEPTED',
    lots: [lot(1), lot(2)],
    results: [result(1, 'ACCEPTED'), result(2, 'ACCEPTED')],
    ...over,
  }) as InboundInspection;

const confirmedOf = (over: Partial<InboundInspection> = {}): InboundInspection =>
  base({
    statusCode: 'COMPLETED',
    confirmedAt: '2099-11-11T03:00:00Z',
    confirmedByName: '합성 확정자',
    overallJudgmentCode: 'ACCEPTED',
    ...over,
  });

interface Options {
  permissions?: string[];
  confirm?: { status: number; body: unknown };
  cancel?: { status: number; body: unknown };
}

const mount = (initial: InboundInspection, options: Options = {}) => {
  let current = initial;
  const sent: { path: string; body: unknown }[] = [];
  const path = (request: Request) => new URL(request.url).pathname;
  const fetch = createStubFetch([
    {
      match: (request) =>
        request.method === 'GET' && path(request) === '/quality/inspection-requests/501',
      respond: () => jsonResponse(current),
    },
    {
      match: (request) => path(request).endsWith(':confirm'),
      respond: async (request) => {
        sent.push({ path: path(request), body: await request.clone().json() });
        if (options.confirm !== undefined) {
          return jsonResponse(options.confirm.body, { status: options.confirm.status });
        }
        current = confirmedOf({
          overallJudgmentCode: current.previewJudgmentCode ?? null,
          nonconformanceNo: current.previewJudgmentCode === 'REJECTED' ? 'TST-NC-0009' : null,
        });
        return jsonResponse(current);
      },
    },
    {
      match: (request) => path(request).endsWith(':cancel-confirm'),
      respond: async (request) => {
        sent.push({ path: path(request), body: await request.clone().json() });
        if (options.cancel !== undefined) {
          return jsonResponse(options.cancel.body, { status: options.cancel.status });
        }
        current = base();
        return jsonResponse(current);
      },
    },
  ]);

  renderWithProviders(
    <SessionProvider>
      <InboundDetail
        inspectionRequestId={501}
        itemParts={{ code: 'TST-ITEM', name: '합성 자재' }}
        planText="AQL 1.0"
        uomCode="EA"
        renderForm={() => null}
      />
    </SessionProvider>,
    { fetch, session: session(options.permissions ?? ['W-01-01', 'W-01-15']) },
  );

  return { sent };
};

describe('W-01-01 판정 확정', () => {
  it('US4-6 결과가 없으면 [판정 확정]이 「결과가 1건 이상이어야 합니다」와 함께 잠긴다', async () => {
    mount(base({ results: [], previewJudgmentCode: null }));

    const button = await screen.findByRole('button', { name: t.confirm.open });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.confirm.lockedNoResults);
  });

  it('US4-6 판정이 빈 결과가 있으면 「판정이 없는 결과가 있습니다」로 잠근다', async () => {
    mount(base({ results: [result(1, 'ACCEPTED'), result(2, null)] }));

    expect(await screen.findByRole('button', { name: t.confirm.open })).toHaveAccessibleDescription(
      t.confirm.lockedNoJudgment,
    );
  });

  it('G2 L2 재작업으로 다시 연 뒤 새 결과(DRAFT)가 없으면 [판정 확정]을 까닭과 함께 잠근다', async () => {
    mount(
      base({
        results: [
          { ...result(1, 'REJECTED'), statusCode: 'CONFIRMED' },
          { ...result(2, 'REJECTED'), statusCode: 'CONFIRMED' },
        ],
      }),
    );

    const button = await screen.findByRole('button', { name: t.confirm.open });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.confirm.lockedNoNewResult);
  });

  it('G2 L2 확정 400 은 일반 실패 문구에 서버 문구를 덧붙인다', async () => {
    const user = userEvent.setup();
    mount(base(), {
      confirm: {
        status: 400,
        body: { errors: [{ scope: 'screen', code: 'NO_NEW_RESULT', message: '합성 서버 문구' }] },
      },
    });

    await user.click(await screen.findByRole('button', { name: t.confirm.open }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: t.confirm.proceed('합격'),
      }),
    );

    expect(
      await screen.findByRole('dialog', { name: `${t.confirm.failed} 합성 서버 문구` }),
    ).toBeInTheDocument();
  });

  it('US4-5 확정 창(종합 판정 · 건수 · 적용) → `:confirm` 에 판 번호, 확정 뒤 결과는 「확정됨」으로 잠긴다', async () => {
    const user = userEvent.setup();
    const { sent } = mount(base());

    await user.click(await screen.findByRole('button', { name: t.confirm.open }));
    const dialog = await screen.findByRole('dialog', {
      name: t.confirm.title('IL-20991111-0003'),
    });
    expect(dialog).toHaveTextContent(t.confirm.counts(2, 2, 0, 0));
    expect(dialog).toHaveTextContent(t.confirm.apply.ACCEPTED(2));
    expect(dialog).toHaveTextContent(t.confirm.note);
    await user.click(within(dialog).getByRole('button', { name: t.confirm.proceed('합격') }));

    expect(await screen.findByText(t.confirm.done('합격'))).toBeInTheDocument();
    expect(sent[0]).toEqual({
      path: '/quality/inspection-requests/501:confirm',
      body: { versionNo: 5 },
    });
    expect(await screen.findByText(t.results.lockedHead)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.results.add })).toBeNull();
    expect(screen.getByRole('button', { name: t.cancel.open })).toBeInTheDocument();
  });

  it('불합격으로 확정하면 부적합 번호를 알린다 — 확인 단추는 「불합격으로 판정 확정」', async () => {
    const user = userEvent.setup();
    mount(base({ previewJudgmentCode: 'REJECTED', results: [result(1, 'REJECTED')] }));

    await user.click(await screen.findByRole('button', { name: t.confirm.open }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(t.confirm.apply.REJECTED(2));
    await user.click(within(dialog).getByRole('button', { name: '불합격으로 판정 확정' }));

    expect(await screen.findByText(t.confirm.doneRejected('TST-NC-0009'))).toBeInTheDocument();
  });

  it('보류는 「보류로 판정 확정」(조사)', async () => {
    const user = userEvent.setup();
    mount(base({ previewJudgmentCode: 'HELD', results: [result(1, 'HELD')] }));

    await user.click(await screen.findByRole('button', { name: t.confirm.open }));
    expect(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '보류로 판정 확정' }),
    ).toBeInTheDocument();
  });

  it('동시 확정 409 VERSION_CONFLICT — 「이미 바뀌었습니다」와 [다시 불러오기]', async () => {
    const user = userEvent.setup();
    mount(base(), {
      confirm: {
        status: 409,
        body: { errors: [{ scope: 'screen', code: 'VERSION_CONFLICT', message: '판이 다릅니다' }] },
      },
    });

    await user.click(await screen.findByRole('button', { name: t.confirm.open }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: t.confirm.proceed('합격'),
      }),
    );

    const failed = await screen.findByRole('dialog', { name: t.confirm.conflict });
    expect(within(failed).getByRole('button', { name: t.confirm.reload })).toBeInTheDocument();
  });

  it('US4-7 W-01-15 가 없으면 결과만 기록한다 — 확정 · 취소 단추를 그리지 않고 권한 안내를 보인다', async () => {
    mount(base(), { permissions: ['W-01-01'] });

    expect(await screen.findByText(t.confirm.noPermission)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.confirm.open })).toBeNull();
    expect(screen.getByRole('button', { name: t.results.add })).toBeInTheDocument();
  });

  it('SC-005 확정된 의뢰도 W-01-15 가 없으면 [확정 취소]가 없다', async () => {
    mount(confirmedOf(), { permissions: ['W-01-01'] });

    expect(await screen.findByText(t.results.lockedHead)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.cancel.open })).toBeNull();
  });
});

describe('W-01-01 확정 취소', () => {
  it('US5-1 합격 확정 취소 — 확인 창 · 사유(선택) → `:cancel-confirm`, 뒤에는 결과를 다시 고칠 수 있다(SC-005)', async () => {
    const user = userEvent.setup();
    const { sent } = mount(confirmedOf());

    await user.click(await screen.findByRole('button', { name: t.cancel.open }));
    const dialog = await screen.findByRole('dialog', {
      name: t.cancel.title('IL-20991111-0003'),
    });
    expect(dialog).toHaveTextContent(t.cancel.lots(2));
    expect(dialog).toHaveTextContent(t.cancel.alerts);
    await user.type(within(dialog).getByLabelText(t.cancel.reason), '합성 사유');
    await user.click(within(dialog).getByRole('button', { name: t.cancel.proceed }));

    expect(await screen.findByText(t.cancel.done)).toBeInTheDocument();
    expect(sent[0]).toEqual({
      path: '/quality/inspection-requests/501:cancel-confirm',
      body: { versionNo: 5, reason: '합성 사유' },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.results.add })).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: `${t.results.seq(1)} ${t.results.edit}` }),
    ).toBeInTheDocument();
  });

  it('US5-3 자재 관리 LOT 하나가 입고됐으면 막힘 창에 「입고된 자재 관리 LOT 가 있습니다」와 LOT 번호', async () => {
    const user = userEvent.setup();
    mount(confirmedOf(), {
      cancel: {
        status: 409,
        body: {
          errors: [
            {
              scope: 'screen',
              code: 'GOODS_RECEIVED',
              message: 'TST-ITEM|1000|991111|TS01|0002',
            },
          ],
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: t.cancel.open }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: t.cancel.proceed }),
    );

    const blocked = await screen.findByRole('dialog', { name: t.cancel.blockedTitle });
    expect(blocked).toHaveTextContent(t.cancel.blockers.GOODS_RECEIVED ?? '');
    expect(blocked).toHaveTextContent('TST-ITEM|1000|991111|TS01|0002');
    expect(blocked).toHaveTextContent(t.cancel.blockedTail);
  });

  it('G2 L12 막힘 창은 서버 문장 대신 code · lotNos 로 만든다 — 한국어 문장이 베트남어 화면에 붙지 않는다', async () => {
    const user = userEvent.setup();
    mount(confirmedOf(), {
      cancel: {
        status: 409,
        body: {
          errors: [
            {
              scope: 'screen',
              code: 'GOODS_RECEIVED',
              message: '입고된 자재 관리 LOT 가 있어 확정을 취소할 수 없습니다.',
              lotNos: ['TST-ITEM|1000|991111|TS01|0001', 'TST-ITEM|1000|991111|TS01|0002'],
            },
            { scope: 'screen', code: 'DISPOSITION_STARTED', message: '처분이 시작되었습니다.' },
          ],
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: t.cancel.open }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: t.cancel.proceed }),
    );

    const blocked = await screen.findByRole('dialog', { name: t.cancel.blockedTitle });
    expect(blocked).toHaveTextContent(
      'TST-ITEM|1000|991111|TS01|0001, TST-ITEM|1000|991111|TS01|0002',
    );
    expect(blocked).not.toHaveTextContent('취소할 수 없습니다.');
    expect(blocked).not.toHaveTextContent('처분이 시작되었습니다.');
    expect(blocked).toHaveTextContent(t.cancel.blockers.DISPOSITION_STARTED ?? '');
  });

  it('최종 마감된 입하 LOT 은 「최종 마감된 입하 LOT 입니다(W-01-16)」로 막는다', async () => {
    const user = userEvent.setup();
    mount(confirmedOf(), {
      cancel: {
        status: 409,
        body: {
          errors: [{ scope: 'screen', code: 'INBOUND_LOT_FINALIZED', message: '' }],
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: t.cancel.open }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: t.cancel.proceed }),
    );

    expect(
      await screen.findByText(t.cancel.blockers.INBOUND_LOT_FINALIZED ?? ''),
    ).toBeInTheDocument();
  });
});

describe('W-01-01 상세 머리', () => {
  it('L14-2 머리 단추(변경 이력 · 분리 · 판정 확정)는 한 묶음이다 — 좁으면 묶음째 다음 줄로 내려간다', async () => {
    mount(base());

    const confirm = await screen.findByRole('button', { name: t.confirm.open });
    const group = confirm.closest('.iqc-inbound-head-actions');

    expect(group).not.toBeNull();
    expect(group?.parentElement).toHaveClass('parts-iqc-detail-head');
    expect(
      within(group as HTMLElement).getByRole('button', { name: t.history.open }),
    ).toBeInTheDocument();
    expect(
      within(group as HTMLElement).getByRole('button', { name: t.split.open }),
    ).toBeInTheDocument();
    /* 제목은 묶음 밖 — 단추가 내려가도 제목 줄은 그대로다. */
    expect(within(group as HTMLElement).queryByText('IL-20991111-0003')).toBeNull();
  });
});
