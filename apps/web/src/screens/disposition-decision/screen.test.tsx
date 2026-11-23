import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { dispositionStub, requestedPaths, requestsSent } from './fixtures';
import { DispositionDecisionScreen } from './screen';

const t = messages.dispositionDecision;
const TODAY = new Date(2026, 7, 12);
const KST = 540;

const renderScreen = (
  options: Parameters<typeof dispositionStub>[0] & { route?: string } = {},
): { user: ReturnType<typeof userEvent.setup> } => {
  renderWithProviders(
    <SessionProvider>
      <DispositionDecisionScreen today={TODAY} offsetMinutes={KST} />
    </SessionProvider>,
    {
      session: SYNTHETIC_SESSION,
      fetch: dispositionStub(options),
      route: options.route ?? '/quality/dispositions',
    },
  );

  return { user: userEvent.setup() };
};

const selectRow = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(await screen.findByText('NC-TEST-0041'));
};

describe('DispositionDecisionScreen 조회', () => {
  it('기간을 반열림으로 실어 조회한다 — 조건 없는 조회를 만들지 않는다', async () => {
    renderScreen();

    expect(await screen.findByRole('region', { name: t.panes.list })).toBeInTheDocument();
    /* 목록 제목 줄 「처분 대기 목록 · N건 · 목록 접기」가 늘 선다(통일 배치 · #350). */
    expect(screen.getByRole('heading', { name: t.panes.list })).toBeInTheDocument();
    /* 고르기 전에는 상세 칸 제목 「부적합 상세 및 판정」을 두지 않는다 — 안내만(omf-all-around#228). */
    expect(screen.queryByRole('heading', { name: t.panes.detailDecision })).toBeNull();
    /* 고르기 전에는 판정 구역을 세우지 않는다(#223). */
    expect(screen.queryByRole('heading', { name: t.form.heading })).toBeNull();

    await waitFor(() => {
      const url = requestedPaths().find((path) => path.startsWith('/quality/nonconformances?'));
      expect(url).toBeDefined();
      const params = new URLSearchParams(url?.split('?')[1] ?? '');
      expect(params.get('openedFrom')).toBe('2026-07-14T00:00:00+09:00');
      expect(params.get('openedTo')).toBe('2026-08-13T00:00:00+09:00');
    });
  });

  it('행을 고르면 상세와 대상 LOT을 보인다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    /* 「부적합 상세」 제목은 두지 않는다(#275) — 상세는 바로 선다. */
    expect(screen.queryByRole('heading', { name: t.panes.detailDecision })).toBeNull();

    expect(await screen.findByText('도장 표면 박리')).toBeInTheDocument();
    expect(await screen.findByText('LOT-TEST-0088')).toBeInTheDocument();
  });

  it('항목을 골라도 목록은 그대로이고, 「목록 접기」로 접고 다시 펼친다(#350)', async () => {
    const { user } = renderScreen();
    expect(screen.queryByRole('button', { name: t.listExpand })).toBeNull();
    await selectRow(user);
    const split = document.querySelector('.disposition-split');
    expect(split).not.toHaveAttribute('data-left-collapsed');

    /* 막대 위 원과 제목 줄 「목록 접기」가 같은 이름이다. */
    await user.click(screen.getAllByRole('button', { name: t.listCollapse })[0]!);
    expect(split).toHaveAttribute('data-left-collapsed', 'true');
    /* 막대 위 원과 접힌 「목록」 탭이 같은 이름이다(#350). */
    await user.click(screen.getAllByRole('button', { name: t.listExpand })[0]!);
    expect(split).not.toHaveAttribute('data-left-collapsed');
  });

  /* 부적합에 남은 품질 상태는 등록 때 값 — 판정으로 바뀐 LOT 상태를 LOT 조회로 보인다(#223). */
  it('대상 LOT 의 품질 상태는 LOT 의 지금 상태다', async () => {
    const { user } = renderScreen({ lotStatusCode: 'SCRAPPED' });
    await selectRow(user);

    const lots = await screen.findByRole('region', { name: t.panes.lots });
    expect(
      await within(lots).findByText(t.values.qualityStatus.SCRAPPED ?? ''),
    ).toBeInTheDocument();
  });

  it('⭐ 진입 키로 들어오면 그 부적합이 자동으로 골라진다', async () => {
    renderScreen({ route: '/quality/dispositions?nonconformanceId=41' });

    expect(await screen.findByText('도장 표면 박리')).toBeInTheDocument();
  });

  it('처분 수량 오른쪽에 입력 / 미입력 수량을 보인다(#223)', async () => {
    const { user } = renderScreen({ decidedQty: 200 });
    await selectRow(user);

    /* 005 FR-038 — 「입력 / 미입력」은 수량 입력과 함께 없어졌다. 처분 수량 칸이 남은 수량 전부를 잠가 보인다. */
    await waitFor(() => expect(screen.getByLabelText(t.form.qtyLabel)).toHaveTextContent('120 EA'));
  });

  it('종결된 부적합은 처분 판정 없이 처분 이력만, 상세 상자에 선별로 새로 생긴 부적합으로 가는 단추를 보인다(#352)', async () => {
    const { user } = renderScreen({
      decidedQty: 320,
      nonconformance: { statusCode: 'DECIDED' },
      decision: {
        dispositionTypeCode: 'SORT',
        newNonconformanceId: 77,
        newNonconformanceNo: 'NC-TEST-0077',
      },
    });
    await selectRow(user);

    expect(await screen.findByRole('group', { name: t.panes.decisions })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: t.panes.decision })).toBeNull();
    const open = screen.getByRole('button', { name: t.inboundLot.openDerived('NC-TEST-0077') });
    expect(open).toHaveTextContent('신규 부적합 건 조회');
    await user.click(open);
    await waitFor(() => expect(requestedPaths()).toContain('/quality/nonconformances/77'));
  });

  /*
   * ⭐ 되살아난 원천 축이 **화면 끝에서 서버 요청까지** 닿는지 본다(#648). 필터 바만 보는
   * 시험은 「칸은 섰는데 조회 조건에는 안 실리는」 결함을 통과시킨다 — 눈으로 봐서 가장
   * 멀쩡해 보이는 실패 모양이라 여기서 한 번 끝까지 물어 둔다.
   */
  it('⭐ 원천을 고르면 목록 조회에 그 축이 실린다', async () => {
    const { user } = renderScreen();
    await screen.findByText('NC-TEST-0041');

    await user.click(screen.getByLabelText(t.fields.sourcePick));
    await user.click(screen.getByRole('option', { name: t.values.sourceCode.RETURN }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestedPaths().some((path) => path.includes('sourceCode=RETURN'))).toBe(true);
    });
  });

  /* 축이 되살아났으므로 「거를 수 없다」는 안내는 이제 거짓이다 — 남아 있으면 안 된다. */
  it('⭐ 원천을 못 거른다는 안내가 목록 머리에 남아 있지 않다', async () => {
    renderScreen();
    await screen.findByText('NC-TEST-0041');

    expect(screen.queryByText(/원천으로 거르는/)).toBeNull();
  });

  /* 판정 대기 → 부적합 선택 → 처분 판정 또는 특채 요청(#223) — 특채 요청은 팝업으로 연다. */
  it('특채를 고르면 팝업 없이 아래에 적용 기간 칸이 펼쳐지고, 다시 누르면 접힌다(#352)', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await screen.findByText('LOT-TEST-0088');

    await user.click(screen.getByRole('radio', { name: '특채' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText(t.concession.validFrom, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(t.concession.validTo)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '특채' }));
    expect(screen.queryByText(t.concession.validTo)).toBeNull();
  });

  it('⛔ 승인·반려 컨트롤이 화면에 없다', async () => {
    renderScreen();
    await screen.findByText('NC-TEST-0041');

    expect(screen.queryByRole('button', { name: '승인' })).toBeNull();
    expect(screen.queryByRole('button', { name: '반려' })).toBeNull();
  });

  it('목록 조회가 실패하면 다시 시도를 낸다', async () => {
    renderScreen({ listStatus: 500 });

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('⛔ 고르고 보기만 해서는 쓰기가 나가지 않는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await screen.findByText('LOT-TEST-0088');

    expect(requestsSent().every((request) => request.method === 'GET')).toBe(true);
  });

  it('고정 OpenAPI의 처분 유형으로 판정을 입력할 수 있다', async () => {
    const { user } = renderScreen();
    await selectRow(user);

    const save = screen.getByRole('button', { name: t.actions.save });
    // 판정 사유가 비어 있으면 저장이 잠긴다 — 넣으면 열린다(#352).
    await waitFor(() => expect(screen.getByLabelText(t.form.reasonLabel)).toBeEnabled());
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(t.form.reasonLabel), '합성 사유');
    await waitFor(() => {
      expect(save).toBeEnabled();
    });
    const group = screen.getByRole('radiogroup', { name: t.form.dispositionLabel });
    // #352 — 고를 수 있는 처분은 폐기 · 선별 · 특채뿐(정상 · 재작업은 없다). 005 FR-041 — 선별은 자재 입하 IQC 부적합(입하 LOT 있음)만이라 이 부적합(입하 LOT 없음)에서는 잠긴다.
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).queryByRole('radio', { name: '정상' })).toBeNull();
    expect(within(group).queryByRole('radio', { name: '재작업' })).toBeNull();
    expect(within(group).getByRole('radio', { name: '선별' })).toBeDisabled();
    expect(within(group).getByRole('radio', { name: '선별' })).toHaveAccessibleDescription(
      t.form.typeLock.sortNoInboundLot,
    );
    expect(within(group).getByRole('radio', { name: '폐기' })).toBeEnabled();
    expect(screen.queryByText(t.dispositionPending)).toBeNull();
  });
});

describe('DispositionDecisionScreen — OQC 탭 「판정 의뢰」(omf-all-around#354)', () => {
  it('검사 건 없는 부적합만 서버에 걸러 달라고 하고, 원천(반품 · 제품) 조건 칸은 그대로 둔다', async () => {
    renderWithProviders(
      <SessionProvider>
        <DispositionDecisionScreen requestOnly today={TODAY} offsetMinutes={KST} />
      </SessionProvider>,
      {
        session: SYNTHETIC_SESSION,
        fetch: dispositionStub(),
        route: '/shipment/oqc-inspection?kind=request',
      },
    );

    await waitFor(() => {
      const url = requestedPaths().find((path) => path.startsWith('/quality/nonconformances?'));
      const params = new URLSearchParams(url?.split('?')[1] ?? '');
      expect(params.get('withoutInspectionRequestOnly')).toBe('true');
      expect(params.get('sourceCode')).toBeNull();
    });
    expect(screen.getByLabelText(t.fields.sourcePick)).toBeInTheDocument();
  });
});
