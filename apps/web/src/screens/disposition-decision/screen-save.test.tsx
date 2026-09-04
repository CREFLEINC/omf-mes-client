import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  conflictResponseFixture,
  dispositionStub,
  lotFixture,
  requestedPaths,
  requestsSent,
} from './fixtures';
import { DispositionDecisionScreen } from './screen';

const t = messages.dispositionDecision;
const TODAY = new Date(2026, 7, 12);
const KST = 540;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODE = 'REWORK';

type User = ReturnType<typeof userEvent.setup>;

const renderScreen = (options: Parameters<typeof dispositionStub>[0] = {}): { user: User } => {
  renderWithProviders(
    <DispositionDecisionScreen today={TODAY} offsetMinutes={KST} dispositionTypeCodes={[CODE]} />,
    { fetch: dispositionStub(options), route: '/quality/dispositions?nonconformanceId=41' },
  );

  return { user: userEvent.setup() };
};

const fillDecision = async (user: User, qty: string, reason = '표면만 손상됐다'): Promise<void> => {
  await screen.findByText('LOT-TEST-0088');
  await user.click(screen.getByRole('radio', { name: CODE }));
  await user.type(screen.getByLabelText(`${t.form.qtyLabel} (EA)`), qty);
  await user.type(screen.getByLabelText(t.form.reasonLabel), reason);
};

const save = async (user: User): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.save }));
};

const posted = (): Request | undefined =>
  requestsSent().find((request) => request.method === 'POST');

const allPosted = (): Request[] => requestsSent().filter((request) => request.method === 'POST');

describe('DispositionDecisionScreen 판정 저장', () => {
  it('⭐ 멱등 키와 낙관적 잠금 토큰을 실어 보낸다', async () => {
    const { user } = renderScreen();
    await fillDecision(user, '120');
    await save(user);

    await waitFor(() => {
      expect(posted()).toBeDefined();
    });

    const request = posted();
    expect(request?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    /* ⭐ 토큰은 저장 경로가 아니라 부적합 «상세»가 내린 것이다. */
    expect(request?.headers.get('If-Match')).toBe('W/"41"');
    await expect(request?.json()).resolves.toEqual({
      dispositionTypeCode: CODE,
      decisionQty: 120,
      uomId: 7001,
      reason: '표면만 손상됐다',
    });
  });

  it('저장에 성공하면 폼을 비우고 알린다 — 부분 판정을 이어서 할 수 있다', async () => {
    const { user } = renderScreen();
    await fillDecision(user, '120');
    await save(user);

    expect(await screen.findByText(t.form.success)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(`${t.form.qtyLabel} (EA)`)).toHaveValue('');
    });
    expect(screen.getByLabelText(t.form.reasonLabel)).toHaveValue('');
  });

  it('⛔ 처분 결정 수량 합이 서버 판정 남은 수량을 넘으면 구조화된 문구를 보인다 — message 원문을 파싱하지 않는다', async () => {
    const { user } = renderScreen({
      saveResponse: () =>
        jsonResponse(
          conflictResponseFixture({
            code: 'DISPOSITION_QTY_EXCEEDED',
            message: '서버가 준 임의의 원문 — 화면이 이 글자를 그대로 옮기지 않는다',
            remainingQty: 45,
            remainingQtyUomId: 7001,
          }),
          { status: 409 },
        ),
    });
    await fillDecision(user, '9999');
    await save(user);

    expect(await screen.findByText(t.form.qtyExceededByServer('45'))).toBeInTheDocument();
    expect(
      screen.queryByText('서버가 준 임의의 원문 — 화면이 이 글자를 그대로 옮기지 않는다'),
    ).toBeNull();
  });

  it('⛔ 이미 종결된 부적합에 저장하면 고정 문구를 보인다 — message 원문을 표시하지 않는다', async () => {
    const { user } = renderScreen({
      saveResponse: () =>
        jsonResponse(
          conflictResponseFixture({ code: 'INVALID_STATE', message: '서버가 준 다른 임의의 원문' }),
          { status: 409 },
        ),
    });
    await fillDecision(user, '120');
    await save(user);

    expect(await screen.findByText(t.form.alreadyClosed)).toBeInTheDocument();
    expect(screen.queryByText('서버가 준 다른 임의의 원문')).toBeNull();
  });

  it('낙관적 잠금 충돌은 최신 불러오기를 낸다 — 재조회로 풀린다', async () => {
    const { user } = renderScreen({
      saveResponse: () =>
        jsonResponse(
          { code: 'VERSION_CONFLICT', message: '충돌', conflictCause: 'user' },
          { status: 409 },
        ),
    });
    await fillDecision(user, '120');
    await save(user);

    expect(await screen.findByText(messages.conflict.user)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.conflict.reloadAction }),
    ).toBeInTheDocument();
  });

  it('사유가 비면 서버로 보내지 않는다', async () => {
    const { user } = renderScreen();
    await screen.findByText('LOT-TEST-0088');
    await user.click(screen.getByRole('radio', { name: CODE }));
    await user.type(screen.getByLabelText(`${t.form.qtyLabel} (EA)`), '120');
    await save(user);

    expect(await screen.findByText(t.form.reasonRequired)).toBeInTheDocument();
    expect(posted()).toBeUndefined();
  });

  it('⛔ 단위가 섞인 부적합은 저장하지 않는다 — 잘못된 단위로 기록되지 않게 한다', async () => {
    renderScreen({
      lots: [
        lotFixture(),
        lotFixture({ nonconformanceLotId: 9002, lotNo: 'LOT-TEST-0089', uomId: 7002 }),
      ],
    });
    await screen.findByText('LOT-TEST-0089');

    /* ⭐ 조용히 아무 일도 안 하지 않는다 — 왜 못 하는지를 말하며 잠근다. */
    const button = screen.getByRole('button', { name: t.actions.save });
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(button).toHaveAccessibleDescription(
      new RegExp(t.form.unitUnknownReason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    expect(posted()).toBeUndefined();
  });

  it('⭐ 거부된 뒤 같은 본문을 다시 보내면 «같은» 멱등 키를 쓴다 — 이중 실행을 막는다', async () => {
    let attempts = 0;
    const { user } = renderScreen({
      saveResponse: () => {
        attempts += 1;
        return attempts === 1
          ? jsonResponse(
              { code: 'INVALID_STATE', message: '이미 종결된 부적합입니다' },
              { status: 409 },
            )
          : jsonResponse({}, { status: 201 });
      },
    });
    await fillDecision(user, '120');
    await save(user);
    await screen.findByText(t.form.alreadyClosed);
    await save(user);

    await waitFor(() => {
      expect(allPosted()).toHaveLength(2);
    });

    const keys = allPosted().map((request) => request.headers.get('Idempotency-Key'));
    expect(keys[0]).toBe(keys[1]);
  });

  it('⭐ 적용 여부를 모르는 저장은 확인을 누르면 풀린다 — 새로고침이 유일한 탈출이 되지 않게 한다', async () => {
    const { user } = renderScreen({ saveThrows: true });
    await fillDecision(user, '120');
    await save(user);

    const check = await screen.findByRole('button', { name: t.form.checkOutcome });
    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();

    await user.click(check);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.save })).toBeEnabled();
    });
    expect(screen.queryByRole('button', { name: t.form.checkOutcome })).toBeNull();
  });

  it('⭐ 참조 이름 조회는 판정 저장으로 다시 나가지 않는다 — 판정으로 바뀌지 않는 값이다', async () => {
    const lookupCount = (): number =>
      requestedPaths().filter((path) => path.startsWith('/mdm/')).length;

    const { user } = renderScreen();
    await fillDecision(user, '120');
    const before = lookupCount();
    await save(user);

    await waitFor(() => {
      expect(posted()).toBeDefined();
    });
    await screen.findByText(t.form.success);

    expect(lookupCount()).toBe(before);
  });

  it('⭐ 확인은 겨눈 부적합의 판정 이력을 다시 읽는다 — 적용됐는지 «보게» 한다', async () => {
    const historyCount = (): number =>
      requestedPaths().filter((path) => path.includes('/41/disposition-decisions')).length;

    const { user } = renderScreen({ saveThrows: true });
    await fillDecision(user, '120');
    await save(user);

    const before = historyCount();
    await user.click(await screen.findByRole('button', { name: t.form.checkOutcome }));

    await waitFor(() => {
      expect(historyCount()).toBeGreaterThan(before);
    });
  });

  it('⭐ 결과를 모르는 판정은 «겨눈 부적합의 번호»를 대며 다른 부적합에서도 잠근다', async () => {
    const { user } = renderScreen({ saveThrows: true, secondNonconformance: true });
    await fillDecision(user, '120');
    await save(user);
    await screen.findByRole('button', { name: t.form.checkOutcome });

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('NC-TEST-0042') }));

    expect(
      await screen.findByText(t.form.uncertainOtherTarget('NC-TEST-0041')),
    ).toBeInTheDocument();
  });

  it('⭐ 다른 부적합에서 확인을 누르면 겨눈 부적합으로 데려간다 — 거짓 확인이 되지 않게 한다', async () => {
    const { user } = renderScreen({ saveThrows: true, secondNonconformance: true });
    await fillDecision(user, '120');
    await save(user);
    await screen.findByRole('button', { name: t.form.checkOutcome });
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('NC-TEST-0042') }));
    await screen.findByText(t.form.uncertainOtherTarget('NC-TEST-0041'));

    const before = requestedPaths().filter((path) => path.includes('/41/')).length;
    await user.click(screen.getByRole('button', { name: t.form.checkOutcome }));

    await waitFor(() => {
      expect(requestedPaths().filter((path) => path.includes('/41/')).length).toBeGreaterThan(
        before,
      );
    });
  });

  it('⭐ 다른 부적합에는 «다른» 멱등 키가 나간다 — 판정이 조용히 유실되지 않게 한다', async () => {
    const { user } = renderScreen({
      secondNonconformance: true,
      saveResponse: () => jsonResponse({ code: 'INVALID_STATE', message: '거절' }, { status: 409 }),
    });
    await fillDecision(user, '120');
    await save(user);
    await screen.findByText(t.form.alreadyClosed);

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('NC-TEST-0042') }));
    await screen.findByText('LOT-TEST-0088');
    await user.click(screen.getByRole('radio', { name: CODE }));
    await user.type(screen.getByLabelText(`${t.form.qtyLabel} (EA)`), '120');
    await user.type(screen.getByLabelText(t.form.reasonLabel), '표면만 손상됐다');
    await save(user);

    await waitFor(() => {
      expect(allPosted()).toHaveLength(2);
    });

    const keys = allPosted().map((request) => request.headers.get('Idempotency-Key'));
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('취소는 서버가 되돌린 오류도 지운다 — 지운 값에 대한 판정을 남기지 않는다', async () => {
    const { user } = renderScreen({
      saveResponse: () =>
        jsonResponse(
          {
            errors: [
              { scope: 'field', field: 'reason', code: 'TOO_SHORT', message: '사유가 짧습니다' },
            ],
          },
          { status: 400 },
        ),
    });
    await fillDecision(user, '120');
    await save(user);
    await screen.findByText('사유가 짧습니다');

    await user.click(screen.getByRole('button', { name: t.actions.cancel }));

    await waitFor(() => {
      expect(screen.queryByText('사유가 짧습니다')).toBeNull();
    });
  });

  it('권한이 없으면 판정 컨트롤을 잠그고 사유를 보인다(403)', async () => {
    renderScreen({ detailStatus: 403 });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.save })).toHaveAccessibleDescription(
        new RegExp(t.form.forbiddenReason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    });
  });
});
