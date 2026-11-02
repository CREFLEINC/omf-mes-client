import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import type { SelectedLotSnapshot } from './candidate-model';
import { AffectedProductionLotsSection, MaterialDefectPane } from './material-defect-pane';

/** W-03-03 자재 불량 기록 + 영향 생산 LOT(omf-all-around#108). */

const t = messages.materialDefect;

const LOT: SelectedLotSnapshot = {
  lotId: 8101,
  lotNo: 'MLOT-8101',
  itemId: 3001,
  versionNo: 4,
  uomId: 1,
  lotStatusCode: 'NORMAL',
};

/** 쓰기 응답 — 보통 · LOT 거절 · 처음 한 번 5xx(8102 만) · 8102 는 끝내 응답 없음. */
type PostMode = 'ok' | 'reject' | 'fail-8102-once' | 'hang-8102';

const SelectionHarness = ({ initial }: { initial: SelectedLotSnapshot[] }) => {
  const [selection, setSelection] = useState(initial);
  return (
    <>
      <button type="button" onClick={() => setSelection((current) => current.slice(0, -1))}>
        마지막 선택 풀기
      </button>
      <MaterialDefectPane selection={selection} isLocked={false} />
      <AffectedProductionLotsSection selection={selection} />
    </>
  );
};

const renderPane = (
  selection: SelectedLotSnapshot[],
  detailUomId: number | null = 7,
  rejectLot = false,
  postMode: PostMode = rejectLot ? 'reject' : 'ok',
) => {
  const writes: Request[] = [];
  let failed8102 = false;
  const stubFetch: StubFetch = async (request) => {
    const path = new URL(request.url).pathname;

    if (path === '/quality/defect-codes') {
      return jsonResponse({
        items: [
          { defectCodeId: 11, defectCode: 'D-SCR', defectName: '긁힘', parentDefectCodeId: null },
        ],
        page: { page: 1, size: 200, total: 1 },
      });
    }
    if (path === '/trace/lots/8101/affected-production-lots') {
      return jsonResponse({
        basis: 'WORK_ORDER_ESTIMATE',
        workOrders: [{ workOrderId: 41, workOrderNo: 'WO-41' }],
        items: [
          {
            lotId: 90,
            lotNo: 'PLOT-90',
            itemId: 7,
            statusCode: 'INSPECTION_PENDING',
            workOrderId: 41,
            workOrderNo: 'WO-41',
          },
        ],
      });
    }
    /* 목록에 단위가 없는 LOT 은 LOT 상세의 단위를 쓴다(사용자 2026-11-02). */
    if (path === '/trace/lots/8101') {
      return jsonResponse({
        lot: {
          lotId: 8101,
          lotNo: 'MLOT-8101',
          itemId: 3001,
          lotTypeCode: 'PRODUCTION',
          statusCode: 'NORMAL',
          initialQty: 50,
          uomId: detailUomId,
          sourceTypeCode: 'WORK_ORDER',
          sourceId: 41,
        },
      });
    }
    if (path === '/mdm/code-values') {
      return jsonResponse({
        items: [
          { codeValueId: 22, code: 'INSPECTION_PENDING', codeName: '검사 대기', isActive: true },
        ],
        page: { page: 1, size: 100, total: 1 },
      });
    }
    if (request.method === 'POST' && path === '/quality/defect-records' && postMode !== 'ok') {
      const body = (await request.clone().json()) as { lotId: number };
      if (postMode === 'hang-8102' && body.lotId === 8102) {
        writes.push(request.clone());
        return new Promise<Response>(() => undefined);
      }
      if (postMode === 'fail-8102-once' && body.lotId === 8102 && !failed8102) {
        failed8102 = true;
        writes.push(request.clone());
        return jsonResponse({ message: 'synthetic' }, { status: 503 });
      }
    }
    if (request.method === 'POST' && path === '/quality/defect-records' && postMode === 'reject') {
      writes.push(request.clone());
      return jsonResponse(
        {
          errors: [
            {
              scope: 'field',
              field: 'lotId',
              code: 'INVALID',
              message: '투입 기록이 없는 LOT 입니다.',
            },
          ],
        },
        { status: 400 },
      );
    }
    if (request.method === 'POST' && path === '/quality/defect-records') {
      writes.push(request.clone());
      return jsonResponse({ defectRecordId: 1 }, { status: 201 });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  renderWithProviders(<SelectionHarness initial={selection} />, { fetch: stubFetch });

  return { writes };
};

type User = ReturnType<typeof userEvent.setup>;

/** LOT 줄을 눌러 입력 팝업을 연다(사용자 2026-11-02). */
const openLot = async (user: User, lotNo = 'MLOT-8101'): Promise<HTMLElement> => {
  const row = await screen.findByRole('button', { name: `${lotNo} 불량 내역 입력` });
  await waitFor(() => expect(row).toBeEnabled());
  await user.click(row);
  const dialog = await screen.findByRole('dialog', { name: '불량 내역 등록' });
  expect(within(dialog).getByText(lotNo)).toBeVisible();
  return dialog;
};

/** 팝업에서 유형 · 수량(· 내용)을 넣는다. */
const fillDefect = async (user: User, qty: string, description?: string): Promise<void> => {
  await user.click(await screen.findByRole('combobox', { name: '불량 유형' }));
  await user.click(await screen.findByRole('option', { name: 'D-SCR · 긁힘' }));
  await user.type(screen.getByRole('textbox', { name: t.qty.label }), qty);
  if (description !== undefined)
    await user.type(screen.getByRole('textbox', { name: t.description }), description);
};

/** 팝업의 [불량 등록] → 확인 화면의 [불량 등록]. */
const confirmDefect = async (user: User): Promise<void> => {
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '불량 등록' }));
  const confirm = await screen.findByRole('dialog', { name: '불량 내역을 등록하시겠습니까?' });
  await user.click(within(confirm).getByRole('button', { name: '불량 등록' }));
};

describe('MaterialDefectPane (W-03-03)', () => {
  it('고른 LOT 마다 한 줄씩 서고, 여러 LOT 도 각각 입력 팝업을 연다', async () => {
    const user = userEvent.setup();
    renderPane([LOT, { ...LOT, lotId: 8102, lotNo: 'MLOT-8102' }]);

    expect(await screen.findByRole('button', { name: 'MLOT-8101 불량 내역 입력' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'MLOT-8102 불량 내역 입력' })).toBeVisible();
    const dialog = await openLot(user, 'MLOT-8102');
    expect(within(dialog).getByRole('combobox', { name: '불량 유형' })).toBeVisible();
  });

  it('영향 생산 LOT 을 작업지시 기준 추정이라고 밝히며 보인다', async () => {
    renderPane([LOT]);

    expect(await screen.findByText('PLOT-90')).toBeInTheDocument();
    expect(screen.getByText('WO-41')).toBeInTheDocument();
    expect(
      screen.getByText('작업지시 기준으로 조회한 LOT이며, 실제 자재 투입 내역과 다를 수 있습니다.'),
    ).toBeInTheDocument();
  });

  /* 담당자 검증 #108 ② — 상태는 코드값이 아니라 이름이다. */
  it('영향 생산 LOT 의 상태를 공통코드 이름으로 보인다', async () => {
    renderPane([LOT]);

    expect(await screen.findByText('검사 대기')).toBeInTheDocument();
    expect(screen.queryByText('INSPECTION_PENDING')).not.toBeInTheDocument();
  });

  it('불량 유형을 고르면(상세가 없으면) 바로 불량 수량 칸으로 옮겨 간다', async () => {
    const user = userEvent.setup();
    renderPane([LOT]);
    await openLot(user);

    await user.click(await screen.findByRole('combobox', { name: '불량 유형' }));
    await user.click(await screen.findByRole('option', { name: 'D-SCR · 긁힘' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: t.qty.label })).toHaveFocus());
  });

  it('[불량 등록]은 확인 화면을 거치고 [이전] · [취소]로는 등록하지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane([LOT]);
    await openLot(user);
    await fillDefect(user, '2');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '불량 등록' }));

    const confirm = await screen.findByRole('dialog', { name: '불량 내역을 등록하시겠습니까?' });
    expect(within(confirm).getByText('MLOT-8101')).toBeVisible();
    expect(within(confirm).getByText('D-SCR · 긁힘')).toBeVisible();
    await user.click(within(confirm).getByRole('button', { name: '수정' }));
    const form = await screen.findByRole('dialog', { name: '불량 내역 등록' });
    await user.click(within(form).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toHaveLength(0);
  });

  it('목록에 단위가 없으면 LOT 상세의 단위로 불량을 기록한다', async () => {
    const user = userEvent.setup();
    const { uomId: _omit, ...withoutUom } = LOT;
    const { writes } = renderPane([withoutUom]);
    await openLot(user);
    await fillDefect(user, '2');
    await waitFor(() =>
      expect(
        within(screen.getByRole('dialog')).getByRole('button', { name: '불량 등록' }),
      ).toBeEnabled(),
    );
    await confirmDefect(user);

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await writes[0]?.json()).toMatchObject({ lotId: 8101, uomId: 7, defectQty: 2 });
  });

  it('LOT 상세에도 단위가 없으면 팝업에 막힌 까닭을 보이고 등록하지 않는다', async () => {
    const user = userEvent.setup();
    const { uomId: _omit, ...withoutUom } = LOT;
    renderPane([withoutUom], null);
    const dialog = await openLot(user);

    expect(
      await within(dialog).findByText('LOT 단위를 확인할 수 없어 불량을 등록할 수 없습니다.'),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: '불량 등록' })).toBeDisabled();
  });

  it('자재 불량을 계정 세션으로 기록한다 — 사번 헤더를 싣지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane([LOT]);
    await openLot(user);
    await fillDefect(user, '2');
    await confirmDefect(user);

    await waitFor(() => expect(writes).toHaveLength(1));
    const [record] = writes;
    expect(record?.headers.get('X-Worker-No')).toBeNull();
    expect(await record?.json()).toMatchObject({
      sourceCode: 'MATERIAL',
      lotId: LOT.lotId,
      defectCodeId: 11,
      defectQty: 2,
      uomId: 1,
    });
  });

  /* 담당자 결정(#108) — 같은 불량이 거듭 기록되지 않게 성공하면 팝업을 닫고 LOT 줄에 등록 건수를 남긴다. */
  it('기록이 성공하면 팝업을 닫고 LOT 줄에 「등록 1건」을 보인다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane([LOT]);
    await openLot(user);
    await fillDefect(user, '5', '찍힘');
    await confirmDefect(user);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('등록 완료 · 1건')).toBeVisible();
    expect(await screen.findByText('등록되었습니다.')).toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });

  it('여러 LOT — 팝업은 입력만 받고, 바깥 [불량 등록] 한 번으로 모두 등록한 뒤 다시 누를 수 없다', async () => {
    const user = userEvent.setup();
    const second = { ...LOT, lotId: 8102, lotNo: 'MLOT-8102' };
    const { writes } = renderPane([LOT, second]);
    const outer = await screen.findByRole('button', { name: '불량 등록' });
    expect(outer).toBeDisabled();

    for (const [lotNo, qty] of [
      ['MLOT-8101', '2'],
      ['MLOT-8102', '3'],
    ] as const) {
      const dialog = await openLot(user, lotNo);
      await fillDefect(user, qty);
      await user.click(within(dialog).getByRole('button', { name: /^등록$/ }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    /* 아직 보내지 않은 입력은 「입력 완료 · 1건」, 바깥 [불량 등록]만 켜진다. */
    expect(screen.getAllByText('입력 완료 · 1건')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '불량 등록' })).toBeEnabled();
    expect(writes).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '불량 등록' }));
    const confirm = await screen.findByRole('dialog', {
      name: '불량 내역 2건을 등록하시겠습니까?',
    });
    await user.click(within(confirm).getByRole('button', { name: '불량 등록' }));

    await waitFor(() => expect(writes).toHaveLength(2));
    const bodies = await Promise.all(writes.map((request) => request.json()));
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lotId: 8101, defectQty: 2 }),
        expect.objectContaining({ lotId: 8102, defectQty: 3 }),
      ]),
    );
    await waitFor(() => expect(screen.getAllByText('등록 완료 · 1건')).toHaveLength(2));
    expect(screen.queryByText('입력 완료 · 1건')).toBeNull();
    /* 묶음이 끝나면 오른쪽 아래 알림 한 번(사용자 2026-11-02). */
    expect(await screen.findAllByText('등록되었습니다.')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '불량 등록' })).toBeDisabled();
  });

  it('서버가 LOT 을 짚어 거절하면 확인 화면에 그 까닭을 보이고 등록 완료로 바꾸지 않는다', async () => {
    const user = userEvent.setup();
    renderPane([LOT], 7, true);
    await openLot(user);
    await fillDefect(user, '1');
    await confirmDefect(user);

    expect(
      await within(screen.getByRole('dialog')).findByText('투입 기록이 없는 LOT 입니다.'),
    ).toBeVisible();
    expect(screen.queryByText('등록 완료 · 1건')).toBeNull();
    expect(screen.queryByText('등록되었습니다.')).toBeNull();
  });

  const draftBoth = async (user: User): Promise<void> => {
    for (const [lotNo, qty] of [
      ['MLOT-8101', '2'],
      ['MLOT-8102', '3'],
    ] as const) {
      const dialog = await openLot(user, lotNo);
      await fillDefect(user, qty);
      await user.click(within(dialog).getByRole('button', { name: /^등록$/ }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    await user.click(screen.getByRole('button', { name: '불량 등록' }));
    const confirm = await screen.findByRole('dialog', {
      name: '불량 내역 2건을 등록하시겠습니까?',
    });
    await user.click(within(confirm).getByRole('button', { name: '불량 등록' }));
  };

  it('여러 LOT 중 실패한 LOT 만 남고, 다시 누르면 그 LOT 만 같은 내용 · 같은 멱등 키로 보낸다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane(
      [LOT, { ...LOT, lotId: 8102, lotNo: 'MLOT-8102' }],
      7,
      false,
      'fail-8102-once',
    );
    await draftBoth(user);

    await waitFor(() => expect(screen.getByText('등록 완료 · 1건')).toBeVisible());
    expect(screen.getByText('입력 완료 · 1건')).toBeVisible();
    const retry = screen.getByRole('button', { name: '불량 등록' });
    await waitFor(() => expect(retry).toBeEnabled());
    await user.click(retry);
    const confirm = await screen.findByRole('dialog', {
      name: '불량 내역 1건을 등록하시겠습니까?',
    });
    await user.click(within(confirm).getByRole('button', { name: '불량 등록' }));

    await waitFor(() => expect(screen.getAllByText('등록 완료 · 1건')).toHaveLength(2));
    const tries = writes.filter((request) => request.url.includes('defect-records'));
    const bodies = await Promise.all(tries.map((request) => request.clone().json()));
    const for8102 = tries.filter((_, index) => (bodies[index] as { lotId: number }).lotId === 8102);
    expect(for8102).toHaveLength(2);
    expect(for8102[0]?.headers.get('Idempotency-Key')).toBe(
      for8102[1]?.headers.get('Idempotency-Key'),
    );
    const sent8102 = bodies.filter((body) => (body as { lotId: number }).lotId === 8102);
    expect(sent8102[0]).toEqual(sent8102[1]);
  });

  it('보내는 도중 그 LOT 선택을 풀어도 불량 구획이 잠긴 채로 남지 않는다', async () => {
    const user = userEvent.setup();
    renderPane([LOT, { ...LOT, lotId: 8102, lotNo: 'MLOT-8102' }], 7, false, 'hang-8102');
    await draftBoth(user);
    await waitFor(() => expect(screen.getByText('등록 완료 · 1건')).toBeVisible());

    await user.click(screen.getByRole('button', { name: '마지막 선택 풀기' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'MLOT-8101 불량 내역 입력' })).toBeEnabled(),
    );
  });
});
