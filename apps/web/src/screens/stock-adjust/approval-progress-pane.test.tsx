import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import {
  APPROVED_APPROVAL_STATUS_CODES,
  REJECTION_DECISION_CODES,
  isApprovalJudgePending,
  toRequestProgressView,
} from './approval-progress';
import { ApprovalProgressPane } from './approval-progress-pane';
import type { ApprovalProgressState } from './approval-progress-pane';
import { SAMPLE_APPROVED_STATUS, approvalRequestDetailBody } from './fixtures';
import { NO_BREAK_SPACE } from './reason-draft';

const t = messages.stockAdjust;

const readyView = (
  overrides: Parameters<typeof approvalRequestDetailBody>[0] = {},
  approvedCodes: readonly string[] = APPROVED_APPROVAL_STATUS_CODES,
) =>
  toRequestProgressView(
    approvalRequestDetailBody(overrides),
    REJECTION_DECISION_CODES,
    approvedCodes,
  );

const renderPane = (
  state: ApprovalProgressState,
  isJudgePending = isApprovalJudgePending(APPROVED_APPROVAL_STATUS_CODES),
) => {
  const onRetry = vi.fn();

  render(<ApprovalProgressPane state={state} isJudgePending={isJudgePending} onRetry={onRetry} />);

  return { onRetry, user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('group', { name: t.progress.label });

/**
 * 결재 진행 구획 — **어디까지 왔는가**만 말한다.
 *
 * ⛔ **승인·반려 조작이 없다**(조심 ① · D-3 · C36). 결재함(W-CO-09)이 그것을 소유한다.
 */
describe('ApprovalProgressPane — 갈래', () => {
  it('불러오는 중에는 뼈대가 선다', () => {
    renderPane({ kind: 'loading' });

    expect(screen.getByRole('status', { name: t.loading.approvalRequest })).toBeInTheDocument();
  });

  /**
   * 전표에 실려 온 값이 조회 조각으로 쓸 수 없는 갈래.
   * **없는 값을 0으로 메워 부르지 않는다** — 그러면 남의 요청을 열거나 헛도는 요청이 나간다.
   */
  it('쓸 수 없는 값이면 그 사실만 밝힌다', () => {
    renderPane({ kind: 'unusable' });

    expect(screen.getByText(t.progress.unusableTitle)).toBeInTheDocument();
    expect(screen.getByText(t.progress.unusableDescription)).toBeInTheDocument();
  });

  it('읽었으면 요청 정보와 단계가 선다', () => {
    renderPane({ kind: 'ready', view: readyView() });

    expect(within(pane()).getByText('SAMPLE-AP-0001')).toBeInTheDocument();
    expect(within(pane()).getByText('SAMPLE_AT_A')).toBeInTheDocument();
    expect(within(pane()).getByText('합성 상신자 가')).toBeInTheDocument();
    expect(within(pane()).getByText('2026-08-18 14:35')).toBeInTheDocument();
    expect(within(pane()).getByText(t.progress.position(4, 4))).toBeInTheDocument();
  });

  /** 단계가 없는 요청도 실재한다 — 빈 목록을 그리면 그 자리가 통째로 비어 보인다. */
  it('단계가 없으면 그 사실을 적는다', () => {
    renderPane({ kind: 'ready', view: { ...readyView(), steps: [] } });

    expect(within(pane()).getByText(t.progress.noSteps)).toBeInTheDocument();
  });
});

/**
 * ⛔ **결재함의 표기를 나르지 않는다**(C36).
 *
 * 픽스처의 `isMyTurn`·`isMine`이 **참**이라, 나르는 구현이면 이 시험이 문다.
 */
describe('ApprovalProgressPane — 이 화면은 결재하지 않는다', () => {
  it('승인·반려 조작이 0건이다', () => {
    renderPane({ kind: 'ready', view: readyView() });

    /* 짝 양성 — 구획은 실제로 섰다. 「아무것도 안 그린다」로 통과하지 않게 한다. */
    expect(within(pane()).getByText('SAMPLE-AP-0001')).toBeInTheDocument();
    expect(within(pane()).queryAllByRole('button')).toHaveLength(0);
    expect(within(pane()).queryByText(/승인하기|반려하기|내 차례/)).not.toBeInTheDocument();
  });

  /** 승인자 이름이 비어 오면 **번호를 대신 내지 않는다**(`omf-mes#44`). */
  it('내부 번호가 그려지지 않는다', () => {
    renderPane({ kind: 'ready', view: readyView() });

    expect(within(pane()).getByText(t.values.unknownApprover)).toBeInTheDocument();
    for (const id of ['9801', '9811', '9812', '9821', '9301']) {
      expect(within(pane()).queryByText(new RegExp(`\\b${id}\\b`))).not.toBeInTheDocument();
    }
  });
});

/**
 * 사유 **전문**. 줄바꿈이 뜻을 나른다 — 계약이 승인 요청의 업무 값을 사유 하나로 두어
 * 상신자가 여러 줄로 근거를 적는다(A-12).
 */
describe('ApprovalProgressPane — 사유 전문', () => {
  it('줄을 그대로 그린다', () => {
    renderPane({ kind: 'ready', view: readyView() });

    const reasonPane = within(pane()).getByRole('group', { name: t.progress.reasonPane });

    expect(within(reasonPane).getByText('합성 조정 사유 첫 줄')).toBeInTheDocument();
    expect(within(reasonPane).getByText('둘째 문단 — 근거를 적는 자리')).toBeInTheDocument();
  });

  /**
   * 빈 줄은 HTML에서 접힌다 — 접히면 문단 구분이 사라져 무엇이 무엇의 근거인지 읽을 수 없다.
   * **상수를 리터럴이 아니라 이름으로 문다**(사본 체크리스트 6번).
   */
  it('가운데 빈 줄이 보이는 글자로 선다', () => {
    renderPane({ kind: 'ready', view: readyView() });

    const reasonPane = within(pane()).getByRole('group', { name: t.progress.reasonPane });
    const lines = within(reasonPane)
      .getAllByRole('paragraph')
      .map((line) => line.textContent);

    expect(lines).toEqual(['합성 조정 사유 첫 줄', NO_BREAK_SPACE, '둘째 문단 — 근거를 적는 자리']);
  });
});

/**
 * 못 읽었을 때 — **세 갈래다.** 화면 배너를 세우지 않고 이 구획 안에서만 말한다:
 * 결재 진행은 판단을 돕는 자료이고, 상신은 이미 202로 받아들여졌다.
 */
describe('ApprovalProgressPane — 못 읽었을 때', () => {
  const httpError = (status: number): ApiRequestError =>
    new ApiRequestError({ kind: 'http', status, message: '합성 서버 문구' });

  it('403이면 권한 문구를 내고 다시 시도를 내지 않는다', () => {
    renderPane({ kind: 'failed', error: httpError(403) });

    expect(screen.getByText(t.progress.forbiddenTitle)).toBeInTheDocument();
    expect(screen.getByText(t.progress.forbiddenDescription)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /**
   * **404에는 다시 시도를 남긴다.** 여기 404는 「전표가 가리키는 요청이 지금 보이지 않는다」이고,
   * 방금 상신한 건이 승인 축에 아직 안 보이는 순간이 실재한다 — 권한과 달리 **다시 부르면
   * 달라질 수 있다.**
   */
  it('404면 다른 문구를 내고 다시 시도를 남긴다', async () => {
    const { onRetry, user } = renderPane({ kind: 'failed', error: httpError(404) });

    expect(screen.getByText(t.progress.notFoundTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('그 밖의 실패에는 서버 문구를 그대로 낸다', () => {
    renderPane({ kind: 'failed', error: httpError(500) });

    expect(screen.getByText(t.progress.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByText('합성 서버 문구')).toBeInTheDocument();
  });

  /** 못 읽어도 상신은 이미 접수됐다 — 이 구획이 실패해도 그 사실이 달라지지 않는다. */
  it('못 읽어도 상신은 접수됐다는 사실을 함께 적는다', () => {
    renderPane({ kind: 'failed', error: httpError(500) });

    expect(screen.getByText(t.progress.loadFailedNote)).toBeInTheDocument();
  });
});

/**
 * ⭐ **자리표시가 잠금이 아니라 안내를 정한다**(D-13 · C37).
 *
 * 비어 있으면 「판정하지 못합니다」가 서고, 채우면 승인 안내가 살아난다 — **어느 쪽에서도
 * 잠기는 컨트롤이 없다**(이 구획에는 버튼이 0건이다).
 */
describe('ApprovalProgressPane — 승인 판정 자리표시', () => {
  it('비어 있으면 판정하지 못한다고 밝힌다', () => {
    renderPane({ kind: 'ready', view: readyView() });

    expect(within(pane()).getByText(t.progress.unjudgeableNote)).toBeInTheDocument();
    expect(within(pane()).queryByText(t.progress.approvedNote)).not.toBeInTheDocument();
  });

  it('채우고 그 요청이 승인이면 승인 안내가 살아난다', () => {
    renderPane({ kind: 'ready', view: readyView({}, [SAMPLE_APPROVED_STATUS]) }, false);

    expect(within(pane()).getByText(t.progress.approvedNote)).toBeInTheDocument();
    expect(within(pane()).queryByText(t.progress.unjudgeableNote)).not.toBeInTheDocument();
  });

  /** 채웠어도 그 상태가 아니면 승인 안내가 서지 않는다 — 짝 방향이다. */
  it('채워도 승인 상태가 아니면 승인 안내가 서지 않는다', () => {
    renderPane(
      {
        kind: 'ready',
        view: readyView({ statusCode: 'SAMPLE_AP_STATUS_B' }, [SAMPLE_APPROVED_STATUS]),
      },
      false,
    );

    /* 짝 양성 — 구획은 실제로 섰다. */
    expect(within(pane()).getByText('SAMPLE-AP-0001')).toBeInTheDocument();
    expect(within(pane()).queryByText(t.progress.approvedNote)).not.toBeInTheDocument();
  });

  /** **계약이 못 박은 사실**이라 자리표시와 무관하게 늘 선다 — 승인은 재고를 움직이지 않는다. */
  it('승인이 재고를 움직이지 않는다는 사실은 늘 선다', () => {
    renderPane({ kind: 'ready', view: readyView() });

    expect(within(pane()).getByText(t.progress.postSeparateNote)).toBeInTheDocument();
  });

  /**
   * ⚠ **없는 자리를 가리키지 않는다**(T2 리뷰 R-2의 교훈).
   *
   * 이 회차에는 전기 조작이 없다 — 승인 안내가 「전기하세요」로 지시하면 사용자가 화면에 없는
   * 컨트롤을 찾는다. **전기가 붙는 회차가 이 문구를 갱신한다.**
   */
  it('승인 안내가 이 화면에 없는 조작을 지시하지 않는다', () => {
    expect(t.progress.approvedNote).not.toMatch(/전기하세요|전기를 진행/);
    expect(t.progress.approvedNote).toContain('별개 조작');
  });
});
