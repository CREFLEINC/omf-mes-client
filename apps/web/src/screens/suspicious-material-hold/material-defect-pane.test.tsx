import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const renderPane = (selection: SelectedLotSnapshot[], detailUomId: number | null = 7) => {
  const writes: Request[] = [];
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
    if (request.method === 'POST' && path === '/quality/defect-records') {
      writes.push(request.clone());
      return jsonResponse({ defectRecordId: 1 }, { status: 201 });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  renderWithProviders(
    <>
      <MaterialDefectPane selection={selection} isLocked={false} />
      <AffectedProductionLotsSection selection={selection} />
    </>,
    {
      fetch: stubFetch,
    },
  );

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
  const confirm = await screen.findByRole('dialog', { name: '불량을 등록할까요?' });
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

    const confirm = await screen.findByRole('dialog', { name: '불량을 등록할까요?' });
    expect(within(confirm).getByText('MLOT-8101')).toBeVisible();
    expect(within(confirm).getByText('D-SCR · 긁힘')).toBeVisible();
    await user.click(within(confirm).getByRole('button', { name: '이전' }));
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
    expect(screen.getByText('등록 1건')).toBeVisible();
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
    expect(writes).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '불량 등록' }));
    const confirm = await screen.findByRole('dialog', { name: '2개 LOT 의 불량을 등록할까요?' });
    await user.click(within(confirm).getByRole('button', { name: '불량 등록' }));

    await waitFor(() => expect(writes).toHaveLength(2));
    const bodies = await Promise.all(writes.map((request) => request.json()));
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lotId: 8101, defectQty: 2 }),
        expect.objectContaining({ lotId: 8102, defectQty: 3 }),
      ]),
    );
    await waitFor(() => expect(screen.getAllByText('등록 1건')).toHaveLength(2));
    expect(screen.getByRole('button', { name: '불량 등록' })).toBeDisabled();
  });
});
