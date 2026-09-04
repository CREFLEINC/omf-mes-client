import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { toRequestProgressView, type RequestProgressView } from './approval-progress';
import {
  ApprovalProgressPane,
  NO_BREAK_SPACE,
  toVisibleLine,
  type ApprovalProgressPaneProps,
} from './approval-progress-pane';
import { approvalRequestDetailFixture, INTERNAL_IDS, SAMPLE_APPROVED_STATUS } from './fixtures';
import { ApiRequestError } from '../../patterns/request';

const t = messages.disposalIssue;

const view = (approvedCodes: readonly string[] = []): RequestProgressView =>
  toRequestProgressView(approvalRequestDetailFixture, [], approvedCodes);

const baseProps = (
  overrides: Partial<ApprovalProgressPaneProps> = {},
): ApprovalProgressPaneProps => ({
  state: { kind: 'ready', view: view() },
  isJudgePending: true,
  hasPosted: false,
  onRetry: vi.fn(),
  ...overrides,
});

const renderPane = (overrides: Partial<ApprovalProgressPaneProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<ApprovalProgressPane {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const httpError = (status: number): ApiRequestError =>
  new ApiRequestError({ kind: 'http', status, message: '' });

describe('ApprovalProgressPane — 다섯 갈래', () => {
  it('구획이 늘 이름을 갖는다', () => {
    renderPane();

    expect(screen.getByRole('group', { name: t.progress.label })).toBeInTheDocument();
  });

  /**
   * A0 — **`approvalRequestId`가 없으면 아직 상신되지 않은 것이다**(계획 결정 7).
   * 등록에는 성공하고 상신에는 이르지 못한 전표가 실제로 남으므로, 이 탭이 그것을 보이는 자리다.
   */
  it('미상신이면 그 사실을 밝힌다', () => {
    renderPane({ state: { kind: 'notSubmitted' } });

    expect(screen.getByText(t.progress.notSubmittedTitle)).toBeInTheDocument();
    /* 단계도 요청 정보도 그리지 않는다 — 없는 것을 그릴 수 없다. */
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('쓸 수 없는 값이면 미상신과 다른 안내를 낸다', () => {
    renderPane({ state: { kind: 'unusable' } });

    expect(screen.getByText(t.progress.unusableTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.progress.notSubmittedTitle)).not.toBeInTheDocument();
    expect(t.progress.unusableTitle).not.toBe(t.progress.notSubmittedTitle);
  });

  it('부르는 중에는 뼈대가 선다', () => {
    renderPane({ state: { kind: 'loading' } });

    expect(screen.getByRole('status', { name: t.loading.approvalRequest })).toBeInTheDocument();
  });

  it('읽었으면 요청 정보와 단계를 낸다', () => {
    renderPane();

    expect(screen.getByText('AP-2026-800001')).toBeInTheDocument();
    expect(screen.getByText('GOODS_ISSUE_DISPOSAL')).toBeInTheDocument();
    expect(screen.getByText('합성 상신자 가')).toBeInTheDocument();
    expect(screen.getByText('2026-08-08 14:35')).toBeInTheDocument();
    expect(screen.getByText(t.progress.position(4, 4))).toBeInTheDocument();
  });
});

describe('ApprovalProgressPane — 못 읽었을 때', () => {
  /**
   * **화면 배너를 세우지 않는다.** 결재 진행은 판단을 돕는 자료이지 처리의 전제가 아니라,
   * 못 읽었다고 화면 전체가 실패로 보이면 사용자는 품의 정보와 라인까지 못 믿게 된다.
   */
  it('구획 안에서만 말하고 못 읽어도 달라지는 것이 없음을 밝힌다', () => {
    renderPane({ state: { kind: 'failed', error: httpError(500) } });

    const pane = screen.getByRole('group', { name: t.progress.label });

    expect(within(pane).getByText(t.progress.loadFailedTitle)).toBeInTheDocument();
    expect(within(pane).getByText(t.progress.loadFailedNote)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /** 계약이 「승인자도 상신자도 아니면 403」이라 적었다 — 다시 불러도 같은 답이 온다. */
  it('403에는 다시 시도가 없다', () => {
    renderPane({ state: { kind: 'failed', error: httpError(403) } });

    expect(screen.getByText(t.progress.forbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /** 짝 방향 — 403이 아니면 다시 시도가 있고, 누르면 실제로 다시 부른다. */
  it('403이 아니면 다시 시도가 있고 눌리면 다시 부른다', async () => {
    const { onRetry, user } = renderPane({ state: { kind: 'failed', error: httpError(404) } });

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /**
   * **404를 그 밖의 실패와 가른다**(리뷰 t3 Minor ④). 계약이 이 조회에 404를 두었고(생성물 실측),
   * 「전표가 가리키는 요청이 지금 보이지 않는다」와 「불러오지 못했다」는 사용자가 읽는 사정이
   * 다르다 — 문구만 두고 갈래를 만들지 않으면 그 문구가 닿을 수 없는 가지가 된다.
   */
  it('404는 그 밖의 실패와 다른 안내를 낸다', () => {
    renderPane({ state: { kind: 'failed', error: httpError(404) } });

    expect(screen.getByText(t.progress.notFoundTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.progress.loadFailedTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.progress.forbiddenTitle)).not.toBeInTheDocument();
  });

  /**
   * **404에는 「다시 시도」를 남긴다.** 권한과 달리 다시 부르면 달라질 수 있다 —
   * 방금 상신한 건이 승인 축에 아직 안 보이는 순간이 실재한다.
   */
  it('404에는 다시 시도가 있다', async () => {
    const { onRetry, user } = renderPane({ state: { kind: 'failed', error: httpError(404) } });

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('그 밖의 실패는 일반 안내를 낸다', () => {
    renderPane({ state: { kind: 'failed', error: httpError(500) } });

    expect(screen.getByText(t.progress.loadFailedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.progress.notFoundTitle)).not.toBeInTheDocument();
  });

  it('세 갈래의 안내가 서로 다르다', () => {
    expect(
      new Set([t.progress.forbiddenTitle, t.progress.notFoundTitle, t.progress.loadFailedTitle])
        .size,
    ).toBe(3);
  });
});

describe('ApprovalProgressPane — 단계 표기', () => {
  /**
   * **노드를 서버가 매긴 단계 번호로 덮는다.** 기본 노드는 배열 인덱스+1이라 두면 화면이
   * 번호를 다시 매기는 것이 되고, 결재된 단계의 체크 글리프는 「승인됨」을 함의한다.
   */
  it('노드에 서버가 준 단계 번호가 선다', () => {
    renderPane();

    const list = screen.getByRole('list');

    expect(within(list).getByText('1')).toBeInTheDocument();
    expect(within(list).getByText('4')).toBeInTheDocument();
  });

  /**
   * **색·아이콘에만 기대지 않는다.** 디자인 시스템의 상태 낱말은 스크린리더 전용이라
   * 보이는 글자는 결과 코드와 대기 문구가 맡는다.
   */
  it('결재 결과와 대기 상태가 보이는 글자로 선다', () => {
    renderPane();

    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('2026-08-08 15:02')).toBeInTheDocument();
    expect(screen.getByText('합성 결재 의견')).toBeInTheDocument();
    expect(screen.getByText(t.progress.waitingCurrent)).toBeInTheDocument();
  });

  it('승인자 이름이 없으면 그 사실을 적고 번호를 내지 않는다', () => {
    const { container } = renderPane();

    expect(screen.getByText(t.values.unknownApprover)).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /** **이 화면은 결재하지 않는다** — 결재함의 「내 차례」 표기를 옮기지 않는다. */
  it('내 차례·내 단계 표기를 내지 않는다', () => {
    const { container } = renderPane();

    expect(container.textContent ?? '').not.toContain('내 차례');
    expect(container.textContent ?? '').not.toContain('내 단계');
  });

  it('단계가 없으면 그 사실을 적는다', () => {
    renderPane({
      state: {
        kind: 'ready',
        view: { ...view(), steps: [] },
      },
    });

    expect(screen.getByText(t.progress.noSteps)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('ApprovalProgressPane — 사유 전문', () => {
  /** 줄바꿈이 뜻을 나른다 — 한 줄로 이어 붙이면 무엇이 무엇의 근거인지 읽을 수 없다. */
  it('사유를 줄 단위로 낸다', () => {
    renderPane();

    const reason = screen.getByRole('group', { name: t.progress.reasonPane });

    expect(reason.querySelectorAll('p')).toHaveLength(3);
    expect(within(reason).getByText('합성 폐기 사유 첫 줄')).toBeInTheDocument();
    expect(within(reason).getByText('둘째 문단 — 근거를 적는 자리')).toBeInTheDocument();
  });

  /**
   * **기대값이 같은 글자를 다시 쓰면 자기참조가 된다.** 제품의 U+00A0을 보통 공백으로 바꿔도
   * 시험이 원시 글자를 적고 있으면 「비가시 공백 정리」 한 번이 둘을 함께 지나 감지기가 죽지
   * 않는다 — 리뷰 t3이 실측한 자리다. 그 고리를 코드 포인트로 끊는다(전례 `iqc-skip-approval`).
   */
  it('줄바꿈 없는 공백이 정말 U+00A0이다 — 보통 공백이 아니다', () => {
    expect(NO_BREAK_SPACE).toBe('\u00a0');
    expect(NO_BREAK_SPACE).not.toBe(' ');
    expect(NO_BREAK_SPACE.codePointAt(0)).toBe(0x00a0);
  });

  /** 빈 줄과 들여쓴 줄은 HTML에서 접힌다 — 글자를 세워 상자가 높이를 갖게 한다. */
  it('빈 줄과 들여쓰기가 보이는 글자로 남는다', () => {
    expect(toVisibleLine('')).toBe(NO_BREAK_SPACE);
    expect(toVisibleLine('  들여쓴 줄')).toBe(`${NO_BREAK_SPACE.repeat(2)}들여쓴 줄`);
    expect(toVisibleLine('보통 줄')).toBe('보통 줄');
  });

  /** 줄 가운데·끝 공백은 바꾸지 않는다 — 전부 바꾸면 복사해 간 사유에 보통 공백이 없어진다. */
  it('줄 가운데 공백은 그대로 둔다', () => {
    expect(toVisibleLine('앞  뒤')).toBe('앞  뒤');
  });
});

describe('ApprovalProgressPane — 승인 뒤에 남은 일', () => {
  /**
   * **계약이 못 박은 사실이라 늘 선다.** 승인은 상태만 바꾸고 재고는 전기가 움직인다 —
   * 승인만 받아 놓고 잊는 일을 막는 자리다.
   */
  it('승인이 재고를 차감하지 않는다는 사실은 늘 보인다', () => {
    renderPane();

    expect(screen.getByText(t.progress.postSeparateNote)).toBeInTheDocument();
  });

  /** 자리표시가 비어 있는 동안 화면이 못 하는 판정을 밝힌다. */
  it('자리표시가 비어 있으면 판정하지 못한다고 말한다', () => {
    renderPane({ isJudgePending: true });

    expect(screen.getByText(t.progress.unjudgeableNote)).toBeInTheDocument();
    expect(screen.queryByText(t.progress.approvedNotPostedNote)).not.toBeInTheDocument();
  });

  /**
   * **전환 감지기** — 자리표시가 채워지고 그 요청이 승인이며 아직 전기 전이면 안내가 선다.
   * 채워졌을 때 살아나는 것을 재지 않으면 그 자리표시는 죽은 가지다.
   */
  it('자리표시를 채우면 승인 뒤 안내가 서고 판정 불가 안내가 사라진다', () => {
    renderPane({
      state: { kind: 'ready', view: view([SAMPLE_APPROVED_STATUS]) },
      isJudgePending: false,
    });

    expect(screen.getByText(t.progress.approvedNotPostedNote)).toBeInTheDocument();
    expect(screen.queryByText(t.progress.unjudgeableNote)).not.toBeInTheDocument();
  });

  /**
   * **이미 전기된 전표에 「재고는 아직 차감되지 않았습니다」는 거짓이다.** 셋 중 하나라도
   * 어긋나면 화면이 확인하지 않은 것을 말하게 된다.
   */
  it('이미 전기됐으면 승인 뒤 안내를 내지 않는다', () => {
    renderPane({
      state: { kind: 'ready', view: view([SAMPLE_APPROVED_STATUS]) },
      isJudgePending: false,
      hasPosted: true,
    });

    expect(screen.queryByText(t.progress.approvedNotPostedNote)).not.toBeInTheDocument();
    /* 짝 방향 — 늘 서는 문장은 그대로 있다(아무것도 안 그려서 통과한 것이 아니다). */
    expect(screen.getByText(t.progress.postSeparateNote)).toBeInTheDocument();
  });

  it('승인 상태가 아니면 안내를 내지 않는다', () => {
    renderPane({
      state: { kind: 'ready', view: view(['SAMPLE_AP_STATUS_OTHER']) },
      isJudgePending: false,
    });

    expect(screen.queryByText(t.progress.approvedNotPostedNote)).not.toBeInTheDocument();
  });

  /* 상신되지 않은 품의에는 승인도 전기도 말할 것이 없다. */
  it('미상신에는 승인 뒤 안내가 서지 않는다', () => {
    renderPane({ state: { kind: 'notSubmitted' }, isJudgePending: false });

    expect(screen.queryByText(t.progress.approvedNotPostedNote)).not.toBeInTheDocument();
    expect(screen.queryByText(t.progress.postSeparateNote)).not.toBeInTheDocument();
  });
});
