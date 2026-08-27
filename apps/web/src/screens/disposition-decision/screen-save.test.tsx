import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { dispositionStub, lotFixture, requestsSent } from './fixtures';
import { DispositionDecisionScreen } from './screen';

const t = messages.dispositionDecision;
const TODAY = new Date(2026, 7, 12);
const KST = 540;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODE = 'CODE-A';

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
    expect(request?.headers.get('If-Match')).toBe('W/"7"');
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

  it('⛔ 남은 수량을 넘겨도 화면이 막지 않고 서버 문구를 그대로 보인다', async () => {
    const { user } = renderScreen({
      saveResponse: () =>
        jsonResponse(
          { code: 'INVALID_STATE', message: '남은 수량은 320 EA 입니다' },
          { status: 409 },
        ),
    });
    await fillDecision(user, '9999');
    await save(user);

    expect(await screen.findByText('남은 수량은 320 EA 입니다')).toBeInTheDocument();
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
    await screen.findByText('이미 종결된 부적합입니다');
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

  it('권한이 없으면 판정 컨트롤을 잠그고 사유를 보인다(403)', async () => {
    renderScreen({ detailStatus: 403 });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.save })).toHaveAccessibleDescription(
        new RegExp(t.form.forbiddenReason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    });
  });
});
