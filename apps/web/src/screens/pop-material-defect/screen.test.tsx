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

const LOT_STATUSES = [
  { codeValueId: 21, code: 'NORMAL', codeName: '정상', isActive: true },
  { codeValueId: 22, code: 'INSPECTION_PENDING', codeName: '검사 대기', isActive: true },
];

const ITEM = { itemId: 3001, itemCode: 'RM-3001', itemName: '볼트', isActive: true };

/** 보류 응답을 시험이 갈아 끼운다 — 차례대로 쓰고, 다 쓰면 성공이다. */
const renderScreen = (workerNo: string | null, holdResponses: Response[] = []) => {
  const writes: Request[] = [];
  let lotDetailCalls = 0;

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/trace/lots') {
      return jsonResponse({ items: [LOT], page: { page: 1, size: 5, total: 1 } });
    }
    if (path === '/trace/lots/8101') {
      lotDetailCalls += 1;
      /* 다시 조회하면 잠금 값이 올라 있다 — 다른 곳에서 LOT 이 바뀐 뒤다. */
      const etag = lotDetailCalls === 1 ? '"7"' : '"8"';
      return jsonResponse({ lot: LOT, externalReferences: [] }, { headers: { ETag: etag } });
    }
    if (path === '/mdm/items/3001') {
      return jsonResponse({ item: ITEM });
    }
    if (path === '/quality/defect-codes') {
      return jsonResponse({ items: CODES, page: { page: 1, size: 200, total: 1 } });
    }
    if (path === '/mdm/code-values') {
      const items = url.searchParams.get('codeGroupCode') === 'LOT_STATUS' ? LOT_STATUSES : REASONS;
      return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
    }
    if (request.method === 'POST' && path === '/quality/defect-records') {
      writes.push(request.clone());
      return jsonResponse({ defectRecordId: 1 }, { status: 201 });
    }
    if (request.method === 'POST' && path === '/quality/lot-holds') {
      writes.push(request.clone());
      return holdResponses.shift() ?? jsonResponse([], { status: 201 });
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

  /* 담당자 결정(#108) — 성공하면 불량 입력을 비워, 같은 불량이 거듭 기록되지 않게 한다. */
  it('기록이 성공하면 불량 입력을 비우고, 다시 기록하려면 새로 입력해야 한다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen('900028');

    await findAndFill(user);
    await user.type(screen.getByRole('textbox', { name: t.description }), '찍힘');
    await user.click(screen.getByRole('button', { name: t.submit }));

    expect(await screen.findByText(t.recorded)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: t.qty.label })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: t.description })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: t.code.major })).not.toHaveTextContent('D-SCR');
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
    expect(screen.getByText(t.blocked.code)).toBeInTheDocument();
    /* LOT 은 그대로다. */
    expect(screen.getByText(LOT.lotNo, { selector: 'dd' })).toBeInTheDocument();
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
      // 검사 대기 보류는 해제 조건이 필수다 — 기본값이 채워져 그대로 간다.
      releaseCondition: t.hold.releaseConditionDefault,
    });
    expect(await screen.findByText(`${t.recorded} ${t.held}`)).toBeInTheDocument();
  });

  /* 담당자 검증 #108 ② — 품목은 코드·이름, 상태는 공통코드 이름으로 보인다. */
  it('조회한 LOT 의 품목은 코드·이름으로, 상태는 이름으로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen('900028');

    await user.type(screen.getByRole('textbox', { name: t.lot.label }), LOT.lotNo);
    await user.click(screen.getByRole('button', { name: t.lot.find }));

    expect(await screen.findByText('RM-3001 · 볼트', { selector: 'dd' })).toBeInTheDocument();
    expect(await screen.findByText('정상', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText(t.lot.item, { selector: 'dt' })).toBeInTheDocument();
    expect(screen.queryByText('NORMAL')).not.toBeInTheDocument();
  });

  const chooseHold = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('checkbox', { name: t.hold.label }));
    await user.click(screen.getByRole('combobox', { name: t.hold.reason }));
    await user.click(await screen.findByRole('option', { name: '외관 이상' }));
  };

  /* 담당자 검증 #108 ② — 기록 뒤 보류만 실패했으면 다시 눌러도 기록이 또 나가지 않는다. */
  it('보류가 버전 충돌로 실패하면 이유를 보이고, 다시 시도는 LOT 을 다시 조회해 보류만 한다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen('900028', [
      jsonResponse(
        {
          conflictCause: 'user',
          code: 'VERSION_CONFLICT',
          message: '버전이 다릅니다.',
          currentVersion: '8',
        },
        { status: 409 },
      ),
    ]);

    await findAndFill(user);
    await user.type(screen.getByRole('textbox', { name: t.description }), '찍힘');
    await chooseHold(user);
    await user.click(screen.getByRole('button', { name: t.submit }));

    expect(
      await screen.findByText(`${t.holdFailed} ${t.holdFailure.versionConflict}`),
    ).toBeInTheDocument();
    /* 기록은 끝났으므로 불량 입력은 비었다 — 보류 재시도는 기록할 때의 내용을 비고로 그대로 싣는다. */
    expect(screen.getByRole('textbox', { name: t.description })).toHaveValue('');
    expect(screen.queryByRole('button', { name: t.submit })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.retryHold }));

    expect(await screen.findByText(`${t.recorded} ${t.held}`)).toBeInTheDocument();
    expect(writes.map(pathOf)).toEqual([
      '/quality/defect-records',
      '/quality/lot-holds',
      '/quality/lot-holds',
    ]);
    expect(await (writes[2] as Request).json()).toMatchObject({
      lots: [{ lotId: LOT.lotId, versionNo: 8 }],
      remarks: '찍힘',
    });
  });

  it('이미 전량 보류된 LOT 이면 다시 보류하지 않아도 된다고 알린다', async () => {
    const user = userEvent.setup();
    renderScreen('900028', [
      jsonResponse(
        {
          conflictCause: 'user',
          code: 'DUPLICATE_HOLD',
          message: '이미 열려 있는 전량 보류가 있습니다.',
        },
        { status: 409 },
      ),
    ]);

    await findAndFill(user);
    await chooseHold(user);
    await user.click(screen.getByRole('button', { name: t.submit }));

    expect(
      await screen.findByText(`${t.holdFailed} ${t.holdFailure.alreadyHeld}`),
    ).toBeInTheDocument();
  });

  it('해제 조건은 고쳐서 보낼 수 있고, 비우면 기록을 막는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen('900028');

    await findAndFill(user);
    await user.click(screen.getByRole('checkbox', { name: t.hold.label }));
    await user.click(screen.getByRole('combobox', { name: t.hold.reason }));
    await user.click(await screen.findByRole('option', { name: '외관 이상' }));
    const condition = screen.getByRole('textbox', { name: t.hold.releaseCondition });
    expect(condition).toHaveValue(t.hold.releaseConditionDefault);

    await user.clear(condition);
    expect(screen.getByText(t.blocked.releaseCondition)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();

    await user.type(condition, '재검 합격 후 해제');
    await user.click(screen.getByRole('button', { name: t.submit }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(await (writes[1] as Request).json()).toMatchObject({
      releaseCondition: '재검 합격 후 해제',
    });
  });

  it('사번이 없으면 기록할 수 없다', async () => {
    renderScreen(null);

    expect(await screen.findByText(messages.popChrome.workerMissing)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
  });
});
