import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readCancelAvailability } from './cancel-availability';
import { CancelPane, type CancelPaneProps } from './cancel-pane';
import { ApiRequestError } from '../../patterns/request';

const t = messages.documentProgress;

const AVAILABLE = readCancelAvailability({ cancellable: true, cancelBlockedReasonCode: null });

const blockedBy = (code: string | null) =>
  readCancelAvailability({ cancellable: false, cancelBlockedReasonCode: code });

/** 상태 코드가 있는 실패를 만든다 — 세 갈래가 상태로 갈리므로 갈래마다 이 모양이 필요하다. */
const httpError = (status: number, message?: string): unknown =>
  new ApiRequestError({ kind: 'http', status, ...(message === undefined ? {} : { message }) });

const renderPane = (overrides: Partial<CancelPaneProps> = {}) => {
  const props: CancelPaneProps = {
    hasCancelResource: true,
    availability: AVAILABLE,
    lock: { kind: 'ready' },
    reason: '',
    isSaving: false,
    isLocked: false,
    banner: null,
    onChangeReason: vi.fn(),
    onOpenConfirm: vi.fn(),
    onRetryLock: vi.fn(),
    ...overrides,
  };

  return { ...render(<CancelPane {...props} />), props };
};

const requestButton = (): HTMLElement =>
  screen.getByRole('button', { name: t.cancelRequest.label });

describe('취소 경로가 없는 유형 — C3-1', () => {
  /**
   * ⛔ **조작을 그리지 않는다.** 잠긴 버튼도 두지 않는다 — 어떤 문서로도 풀리지 않는 잠금이라
   * 사용자가 눌러 보다 만다. 유형↔취소 리소스 표가 비어 있는 지금은 **모든 유형이 이 상태**다.
   */
  it('요청 버튼도 사유 칸도 그리지 않는다', () => {
    renderPane({ hasCancelResource: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.cancelRequest.reason)).not.toBeInTheDocument();
  });

  /** 조작이 없는 이유를 **글자로** 밝힌다 — 빈 자리는 화면이 고장 난 것으로 읽힌다. */
  it('왜 없는지와 무엇이 정해지면 서는지를 말한다', () => {
    renderPane({ hasCancelResource: false });

    expect(screen.getByText(t.cancelRequest.unsupportedTitle)).toBeInTheDocument();
    expect(screen.getByText(t.cancelRequest.unsupportedDescription)).toBeInTheDocument();
  });

  /* 짝 방향 — 경로가 있으면 조작이 선다. 아니면 위 단언이 「늘 그리지 않는다」와 같아진다. */
  it('경로가 있으면 요청 버튼이 선다', () => {
    renderPane();

    expect(requestButton()).toBeInTheDocument();
    expect(screen.getByLabelText(t.cancelRequest.reason)).toBeInTheDocument();
  });
});

describe('잠금 토큰 축 — C3-3', () => {
  /**
   * ⭐ **리소스 상세 200이 오기 전에는 버튼이 열리지 않는다.** 계약이 `If-Match`를 필수로 두어
   * 토큰 없이 열면 **눌러도 아무 일이 없는** 자리가 된다(증상이 그래서 알아채기 어렵다).
   */
  it('준비 중에는 요청 버튼이 잠긴다', () => {
    renderPane({ lock: { kind: 'preparing' } });

    expect(requestButton()).toBeDisabled();
  });

  /** 왜 잠겼는지 말한다 — 버튼이 이유 없이 잠겨 있으면 사용자가 자기 권한 문제로 읽는다. */
  it('준비 중이라는 사실이 버튼에 연결된다', () => {
    renderPane({ lock: { kind: 'preparing' } });

    const note = screen.getByText(t.cancelRequest.preparing);

    expect(requestButton()).toHaveAttribute('aria-describedby', note.id);
  });

  /* 준비 중에는 사유를 **칠 수 있다** — 곧 풀리는 상태라 그 사이에 쳐 두는 것이 이롭다. */
  it('준비 중에도 사유 칸은 잠기지 않는다', () => {
    renderPane({ lock: { kind: 'preparing' } });

    expect(screen.getByLabelText(t.cancelRequest.reason)).toBeEnabled();
  });

  it('토큰이 준비되면 요청 버튼이 열린다', () => {
    renderPane();

    expect(requestButton()).toBeEnabled();
    expect(screen.queryByText(t.cancelRequest.preparing)).not.toBeInTheDocument();
  });
});

describe('잠금 토큰 실패 — C3-4의 세 갈래', () => {
  /**
   * ⭐ **화면 배너를 세우지 않는다.** 실패한 것은 취소 축 하나뿐이고 진행현황은 계속 읽을 수
   * 있어야 한다 — 이 구획 안에서만 말하는 것이 그 규칙을 코드로 지키는 형태다.
   */
  it('403은 권한을 말하고 「다시 시도」를 내지 않는다', () => {
    renderPane({ lock: { kind: 'failed', error: httpError(403) } });

    expect(screen.getByText(t.cancelRequest.lockForbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /**
   * **404에는 「다시 시도」를 남긴다.** 권한과 달리 **다시 부르면 달라질 수 있다** — 방금 만들어진
   * 문서가 아직 보이지 않는 순간이 있고, 유형↔리소스 표를 고친 뒤 같은 자리에서 다시 시도한다.
   */
  it('404는 문서를 찾지 못했다고 말하고 「다시 시도」를 낸다', () => {
    renderPane({ lock: { kind: 'failed', error: httpError(404) } });

    expect(screen.getByText(t.cancelRequest.lockNotFoundTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  /** 그 밖은 **서버 문구를 그대로** 덧붙인다 — 화면이 원인을 지어내지 않는다. */
  it('그 밖의 실패는 서버 문구를 그대로 낸다', () => {
    renderPane({ lock: { kind: 'failed', error: httpError(500, '합성 서버 오류') } });

    expect(screen.getByText(t.cancelRequest.lockFailedTitle)).toBeInTheDocument();
    expect(screen.getByText('합성 서버 오류')).toBeInTheDocument();
  });

  it('다시 시도를 누르면 화면에 알린다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane({ lock: { kind: 'failed', error: httpError(404) } });

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(props.onRetryLock).toHaveBeenCalledTimes(1);
  });

  it('실패하면 요청 버튼이 잠긴다', () => {
    renderPane({ lock: { kind: 'failed', error: httpError(500) } });

    expect(requestButton()).toBeDisabled();
  });

  /** 못 읽어도 이 문서로 할 수 있는 다른 일은 달라지지 않는다 — 그 사실을 함께 적는다. */
  it('진행현황은 그대로 볼 수 있다는 사실을 함께 적는다', () => {
    renderPane({ lock: { kind: 'failed', error: httpError(500) } });

    expect(screen.getByText(t.cancelRequest.lockFailedNote)).toBeInTheDocument();
  });
});

describe('서버가 막은 상태 — C3-2', () => {
  /**
   * ⭐ **판정을 화면이 다시 하지 않는다.** 「지금 취소 요청을 낼 수 있는가」는 서버가 후속·전기·
   * 진행 중 요청을 함께 보고 내린 값이고, 문면을 고르는 자리는 목록 열과 **같은 하나**다.
   */
  it('잠기고 계약이 열거한 사유가 우리말로 보인다', () => {
    renderPane({ availability: blockedBy('SUCCESSOR_EXISTS') });

    expect(requestButton()).toBeDisabled();
    expect(
      screen.getByText(t.cancelRequest.blocked(t.blockReasons.SUCCESSOR_EXISTS)),
    ).toBeInTheDocument();
  });

  /** 모르는 코드는 **코드 문자열 그대로** 낸다 — 뜻을 지어내면 그것도 화면이 만든 것이 된다. */
  it('모르는 코드는 코드 그대로 보인다', () => {
    renderPane({ availability: blockedBy('SYN_UNKNOWN_BLOCK_REASON') });

    expect(
      screen.getByText(t.cancelRequest.blocked('SYN_UNKNOWN_BLOCK_REASON')),
    ).toBeInTheDocument();
  });

  /** 사유가 오지 않는 갈래가 실재한다(계약이 선택으로 두었다) — 빈 칸으로 두지 않는다. */
  it('사유 코드가 없으면 그 사실을 적는다', () => {
    renderPane({ availability: blockedBy(null) });

    expect(screen.getByText(t.cancelRequest.blocked(t.values.noBlockReason))).toBeInTheDocument();
  });

  /**
   * **막힌 상태에서는 사유 칸도 잠근다** — 칠 수 있는데 보낼 수 없는 칸은 사용자가 쓴 글을
   * 버리게 만든다(전례 `disposal-issue/resubmit-pane`의 같은 규율).
   */
  it('막혔으면 사유 칸도 잠긴다', () => {
    renderPane({ availability: blockedBy('ALREADY_CANCELLED') });

    expect(screen.getByLabelText(t.cancelRequest.reason)).toBeDisabled();
  });

  /**
   * ⭐ **서버 판정과 「준비 중」이 **동시에 참인 갈래가 실재한다**.** 잠금 토큰 조회를
   * `cancellable`로 막지 않기로 했으므로(계획 §5-2 · 단위 ④의 실행이 그 토큰을 쓴다) **막힌
   * 문서도 `preparing`을 지난다.**
   *
   * 그때 「준비하는 중」을 내면 **기다리면 풀린다**고 말하는 것이 되는데, 서버가 막은 것은
   * 기다려서 풀리지 않는다 — 그래서 서버 판정이 먼저다.
   *
   * ⚠ **갈래를 하나씩 세우는 감지기로는 이 차례를 잴 수 없다**(둘 중 하나만 참이면 어느 차례든
   * 같은 답이 나온다). **겹친 갈래**를 세워야 차례가 재어진다.
   */
  it('막혔고 아직 준비 중이면 서버 사유가 먼저다', () => {
    renderPane({
      availability: blockedBy('CANCEL_IN_PROGRESS'),
      lock: { kind: 'preparing' },
    });

    expect(
      screen.getByText(t.cancelRequest.blocked(t.blockReasons.CANCEL_IN_PROGRESS)),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.cancelRequest.preparing)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **두 축이 서로 다른 자리에서 말한다.** 서버 판정은 버튼 옆 한 줄이, 토큰 실패는 자기
   * 구획이 말한다 — 뭉개면 「다시 시도」가 풀 수 있는 것과 풀 수 없는 것이 한 문장이 된다.
   */
  it('서버 판정과 토큰 실패가 함께 참이면 둘 다 보인다', () => {
    renderPane({
      availability: blockedBy('SUCCESSOR_EXISTS'),
      lock: { kind: 'failed', error: httpError(500) },
    });

    expect(
      screen.getByText(t.cancelRequest.blocked(t.blockReasons.SUCCESSOR_EXISTS)),
    ).toBeInTheDocument();
    expect(screen.getByText(t.cancelRequest.lockFailedTitle)).toBeInTheDocument();
  });
});

describe('사유와 요청', () => {
  it('친 글자를 화면에 알린다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane();

    await user.type(screen.getByLabelText(t.cancelRequest.reason), '가');

    expect(props.onChangeReason).toHaveBeenCalledWith('가');
  });

  /** 화면이 잡은 오류와 서버가 준 오류가 **같은 칸에** 붙는다. */
  it('사유 오류가 칸 옆에 붙는다', () => {
    renderPane({ reasonError: t.cancelRequest.reasonRequired });

    expect(screen.getByText(t.cancelRequest.reasonRequired)).toBeInTheDocument();
  });

  it('요청 버튼을 누르면 확인 창을 열라고 알린다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane();

    await user.click(requestButton());

    expect(props.onOpenConfirm).toHaveBeenCalledTimes(1);
  });

  /**
   * ⭐ **나가는 중에는 버튼과 사유 칸이 잠긴다.** 연타로 두 번 나가면 쓰기 훅이 호출마다 새
   * 멱등 키를 만들어 **승인 요청이 두 벌** 생긴다.
   */
  it('나가는 중에는 버튼과 사유 칸이 잠긴다', () => {
    renderPane({ isSaving: true, isLocked: true });

    expect(requestButton()).toBeDisabled();
    expect(screen.getByLabelText(t.cancelRequest.reason)).toBeDisabled();
  });

  /**
   * ⭐ **두 축을 각각 잰다 — ① 잠금은 전역이다.** 다른 대상에 보낸 요청이 나가는 중이어도
   * (바깥 주소 이동으로 대상이 바뀐 뒤) 이 구획의 조작이 잠긴다 — 잠기지 않으면 앞 요청이
   * 끝나기 전에 둘째 요청이 나간다.
   */
  it('다른 대상의 요청이 나가는 중이어도 조작이 잠긴다', () => {
    renderPane({ isSaving: false, isLocked: true });

    expect(requestButton()).toBeDisabled();
    expect(screen.getByLabelText(t.cancelRequest.reason)).toBeDisabled();
  });

  /**
   * ⭐ **두 축을 각각 잰다 — ② 진행 표시는 대상에만 그려진다.** 잠금으로 진행 표시를 재면
   * **손대지도 않은 문서가 「요청 중」이라고 말한다.** 디자인 시스템 버튼이 `loading`에서
   * `aria-busy`를 세우므로(설치본 실측) 그 표식으로 두 축이 갈렸는지 본다.
   */
  it('내 대상이 아니면 진행 표시가 돌지 않는다', () => {
    renderPane({ isSaving: false, isLocked: true });

    expect(requestButton()).not.toHaveAttribute('aria-busy', 'true');
  });

  /* 짝 방향 — 내 대상이면 진행 표시가 돈다. 아니면 위 단언이 「늘 돌지 않는다」와 같아진다. */
  it('내 대상이면 진행 표시가 돈다', () => {
    renderPane({ isSaving: true, isLocked: true });

    expect(requestButton()).toHaveAttribute('aria-busy', 'true');
  });

  /** 실패 배너가 설 자리 — 창이 닫혀 있으면 이 구획이 갖는다(자리 배타는 화면이 정한다). */
  it('배너 슬롯을 구획 안에 낸다', () => {
    renderPane({ banner: <p>합성 취소 요청 실패</p> });

    expect(screen.getByText('합성 취소 요청 실패')).toBeInTheDocument();
  });

  /** 이 구획이 무엇을 하는 자리인지 첫 문장이 말한다 — 승인을 탄다는 사실이 먼저다. */
  it('승인을 탄다는 사실을 구획이 먼저 말한다', () => {
    renderPane();

    expect(screen.getByText(t.cancelRequest.lead)).toBeInTheDocument();
  });
});
