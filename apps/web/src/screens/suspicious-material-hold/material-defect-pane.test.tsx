import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import type { SelectedLotSnapshot } from './candidate-model';
import { MaterialDefectPane } from './material-defect-pane';

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

const renderPane = (selection: SelectedLotSnapshot[]) => {
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

  renderWithProviders(<MaterialDefectPane selection={selection} isLocked={false} />, {
    fetch: stubFetch,
  });

  return { writes };
};

describe('MaterialDefectPane (W-03-03)', () => {
  it('LOT 하나를 고르기 전에는 안내만 선다', () => {
    renderPane([]);

    expect(screen.getByText(t.pane.singleOnly)).toBeInTheDocument();
  });

  it('영향 생산 LOT 을 작업지시 기준 추정이라고 밝히며 보인다', async () => {
    renderPane([LOT]);

    expect(await screen.findByText('PLOT-90')).toBeInTheDocument();
    expect(screen.getByText('WO-41')).toBeInTheDocument();
    expect(screen.getByText(t.affected.estimate)).toBeInTheDocument();
  });

  /* 담당자 검증 #108 ② — 상태는 코드값이 아니라 이름이다. */
  it('영향 생산 LOT 의 상태를 공통코드 이름으로 보인다', async () => {
    renderPane([LOT]);

    expect(await screen.findByText('검사 대기')).toBeInTheDocument();
    expect(screen.queryByText('INSPECTION_PENDING')).not.toBeInTheDocument();
  });

  it('자재 불량을 계정 세션으로 기록한다 — 사번 헤더를 싣지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane([LOT]);

    await user.click(await screen.findByRole('combobox', { name: t.code.major }));
    await user.click(await screen.findByRole('option', { name: 'D-SCR · 긁힘' }));
    await user.type(screen.getByRole('textbox', { name: t.qty.label }), '2');
    await user.click(screen.getByRole('button', { name: t.submit }));

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
    expect(await screen.findByText(t.recorded)).toBeInTheDocument();
  });

  /* 담당자 결정(#108) — 같은 불량이 2초 간격으로 세 번 기록됐다. 성공하면 입력을 비워 다시 누르려면 새 입력이 필요하다. */
  it('기록이 성공하면 입력을 비우고 안내는 남긴다 — 그대로 다시 누를 수 없다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane([LOT]);

    await user.click(await screen.findByRole('combobox', { name: t.code.major }));
    await user.click(await screen.findByRole('option', { name: 'D-SCR · 긁힘' }));
    await user.type(screen.getByRole('textbox', { name: t.qty.label }), '5');
    await user.type(screen.getByRole('textbox', { name: t.description }), '찍힘');
    await user.click(screen.getByRole('button', { name: t.submit }));

    expect(await screen.findByText(t.recorded)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: t.qty.label })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: t.description })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: t.code.major })).not.toHaveTextContent('D-SCR');
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
    expect(writes).toHaveLength(1);
  });
});
