import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { PopMaterialDefectScreen } from './screen';

/** P-02-14 자재 불량 등록(omf-all-around#108) — LOT 조회 → 불량 기록 → 고르면 보류. */

const t = messages.materialDefect;

const LOT = {
  lotId: 8101,
  lotNo: 'MLOT-8101',
  itemId: 3001,
  uomId: 1,
  statusCode: 'NORMAL',
};

const CODES = [
  {
    defectCodeId: 11,
    defectCode: 'D-SCR',
    defectName: '긁힘',
    parentDefectCodeId: null,
    isActive: true,
  },
];

const REASONS = [
  { codeValueId: 1, code: 'APPEARANCE_ABNORMAL', codeName: '외관 이상', isActive: true },
];

const renderScreen = (workerNo: string | null) => {
  const writes: Request[] = [];

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/trace/lots') {
      return jsonResponse({ items: [LOT], page: { page: 1, size: 5, total: 1 } });
    }
    if (path === '/trace/lots/8101') {
      return jsonResponse({ lot: LOT, externalReferences: [] }, { headers: { ETag: '"7"' } });
    }
    if (path === '/quality/defect-codes') {
      return jsonResponse({ items: CODES, page: { page: 1, size: 200, total: 1 } });
    }
    if (path === '/mdm/code-values') {
      return jsonResponse({ items: REASONS, page: { page: 1, size: 100, total: 1 } });
    }
    if (request.method === 'POST' && path === '/quality/defect-records') {
      writes.push(request.clone());
      return jsonResponse({ defectRecordId: 1 }, { status: 201 });
    }
    if (request.method === 'POST' && path === '/quality/lot-holds') {
      writes.push(request.clone());
      return jsonResponse([], { status: 201 });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  renderWithProviders(
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, workerNo }}>
      <PopMaterialDefectScreen />
    </PopIdentityProvider>,
    { route: '/pop/material-defect', fetch: stubFetch },
  );

  return { writes };
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

const findAndFill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole('textbox', { name: t.lot.label }), LOT.lotNo);
  await user.click(screen.getByRole('button', { name: t.lot.find }));
  expect(await screen.findByText(LOT.lotNo, { selector: 'dd' })).toBeInTheDocument();

  await user.click(screen.getByRole('combobox', { name: t.code.major }));
  await user.click(await screen.findByRole('option', { name: 'D-SCR · 긁힘' }));
  await user.type(screen.getByRole('textbox', { name: t.qty.label }), '3');
};

describe('PopMaterialDefectScreen (P-02-14)', () => {
  it('자재 불량을 사번과 함께 기록한다 — 원천은 자재 불량이다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen('900028');

    await findAndFill(user);
    await user.click(screen.getByRole('button', { name: t.submit }));

    expect(await screen.findByText(t.recorded)).toBeInTheDocument();
    const [record] = writes;
    expect(pathOf(record as Request)).toBe('/quality/defect-records');
    expect(record?.headers.get('X-Worker-No')).toBe('900028');
    expect(await record?.json()).toMatchObject({
      sourceCode: 'MATERIAL',
      lotId: LOT.lotId,
      defectCodeId: 11,
      defectQty: 3,
      uomId: 1,
    });
    expect(writes).toHaveLength(1);
  });

  it('보류를 고르면 기록 뒤 그 LOT 을 상세의 잠금 값으로 보류한다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen('900028');

    await findAndFill(user);
    await user.click(screen.getByRole('checkbox', { name: t.hold.label }));
    await user.click(screen.getByRole('combobox', { name: t.hold.reason }));
    await user.click(await screen.findByRole('option', { name: '외관 이상' }));
    await user.click(screen.getByRole('button', { name: t.submit }));

    await waitFor(() => expect(writes).toHaveLength(2));
    const hold = writes[1] as Request;
    expect(pathOf(hold)).toBe('/quality/lot-holds');
    expect(hold.headers.get('X-Worker-No')).toBe('900028');
    expect(await hold.json()).toMatchObject({
      lots: [{ lotId: LOT.lotId, versionNo: 7 }],
      reasonCode: 'APPEARANCE_ABNORMAL',
      targetLotStatusCode: 'INSPECTION_PENDING',
    });
    expect(await screen.findByText(`${t.recorded} ${t.held}`)).toBeInTheDocument();
  });

  it('사번이 없으면 기록할 수 없다', async () => {
    renderScreen(null);

    expect(await screen.findByText(messages.popChrome.workerMissing)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
  });
});
