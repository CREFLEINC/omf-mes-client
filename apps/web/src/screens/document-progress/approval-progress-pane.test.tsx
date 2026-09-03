import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { toRequestProgressView } from './approval-progress';
import {
  ApprovalProgressPane,
  NO_BREAK_SPACE,
  toVisibleLine,
  type ApprovalProgressPaneProps,
  type ApprovalProgressState,
} from './approval-progress-pane';
import { approvalRequestDetail } from './fixtures';
import { ApiRequestError } from '../../patterns/request';

const t = messages.documentProgress;

const readyState = (
  overrides: Partial<Parameters<typeof approvalRequestDetail>[0]> = {},
  approvedCodes: readonly string[] = [],
): ApprovalProgressState => ({
  kind: 'ready',
  view: toRequestProgressView(approvalRequestDetail(overrides), [], approvedCodes),
});

/** 상태 코드가 있는 실패를 만든다 — 세 갈래가 상태로 갈리므로 갈래마다 이 모양이 필요하다. */
const httpError = (status: number, message?: string): unknown =>
  new ApiRequestError({ kind: 'http', status, ...(message === undefined ? {} : { message }) });

const renderPane = (overrides: Partial<ApprovalProgressPaneProps> = {}) => {
  const props: ApprovalProgressPaneProps = {
    state: readyState(),
    isJudgePending: true,
    onRetry: vi.fn(),
    ...overrides,
  };

  return { ...render(<ApprovalProgressPane {...props} />), props };
};

describe('NO_BREAK_SPACE — 사본 체크리스트 6번', () => {
  /**
   * ⭐ **코드포인트로 단언한다.** 원시 글자로 두면 저장소의 「비가시 공백 정리」 한 번이 제품과
   * 시험을 함께 지나 `toVisibleLine`을 무동작으로 만드는데, 기대값이 같은 글자를 다시 쓰고
   * 있으면(자기참조) 감지기가 아무 말도 하지 않는다.
   */
  it('U+00A0이다', () => {
    expect(NO_BREAK_SPACE.codePointAt(0)).toBe(0x00a0);
    expect(NO_BREAK_SPACE).toHaveLength(1);
  });

  it('보통 공백이 아니다', () => {
    expect(NO_BREAK_SPACE).not.toBe(' ');
  });
});

describe('toVisibleLine', () => {
  /** 빈 줄은 HTML에서 접힌다 — 글자를 세워 상자가 높이를 갖게 한다. */
  it('빈 줄에 보이지 않는 글자를 세운다', () => {
    expect(toVisibleLine('')).toBe(NO_BREAK_SPACE);
  });

  it('들여쓴 만큼 앞머리를 바꾼다', () => {
    expect(toVisibleLine('  들여쓴 줄')).toBe(`${NO_BREAK_SPACE.repeat(2)}들여쓴 줄`);
  });

  /** 줄 가운데·끝 공백은 바꾸지 않는다 — 전부 바꾸면 복사해 간 사유에 보통 공백이 없다. */
  it('줄 가운데 공백은 그대로 둔다', () => {
    expect(toVisibleLine('앞 뒤')).toBe('앞 뒤');
  });
});

describe('ApprovalProgressPane — 다섯 갈래 · C4-3 · C4-4', () => {
  it('요청이 없으면 그 사실을 말한다', () => {
    renderPane({ state: { kind: 'notSubmitted' } });

    expect(screen.getByText(t.approval.notSubmittedTitle)).toBeInTheDocument();
    expect(screen.getByText(t.approval.notSubmittedDescription)).toBeInTheDocument();
  });

  /** 값은 왔는데 조회할 수 없다 — 「요청이 없다」와 다른 사실이라 문면을 가른다. */
  it('조회할 수 없는 값이면 요청 없음과 다른 문면이 선다', () => {
    renderPane({ state: { kind: 'unusable' } });

    expect(screen.getByText(t.approval.unusableTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.approval.notSubmittedTitle)).not.toBeInTheDocument();
  });

  it('부르는 동안 뼈대가 선다', () => {
    renderPane({ state: { kind: 'loading' } });

    expect(screen.getByRole('status', { name: t.loading.approval })).toBeInTheDocument();
  });

  /**
   * ⭐ **403에는 「다시 시도」가 없다**(C4-3). 같은 권한으로 다시 불러도 같은 답이 온다 —
   * 누를 수 있는 조치를 주면 사용자를 헛돌게 하고 해야 할 일(담당자 문의)을 가린다.
   */
  it('403이면 권한 문면이 서고 다시 시도가 없다', () => {
    renderPane({ state: { kind: 'failed', error: httpError(403) } });

    expect(screen.getByText(t.approval.forbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /** **404에는 남긴다** — 방금 올린 요청이 승인 축에 아직 안 보이는 순간이 실재한다. */
  it('404면 없음 문면이 서고 다시 시도가 있다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane({ state: { kind: 'failed', error: httpError(404) } });

    expect(screen.getByText(t.approval.notFoundTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  /** 그 밖은 서버 문구를 그대로 낸다 — 원인을 화면이 지어내지 않는다. */
  it('그 밖의 실패는 서버 문구를 그대로 낸다', () => {
    renderPane({ state: { kind: 'failed', error: httpError(500, '서버가 응답하지 않았습니다') } });

    expect(screen.getByText(t.approval.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByText('서버가 응답하지 않았습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  /**
   * ⭐ **못 읽어도 실행을 막지 않는다**(C4-8). 잠금의 정본은 서버이고 계약이 「승인 전이면 400」
   * 이라 적었다 — 화면이 모르는 것을 「승인되지 않았다」로 접으면 승인된 건까지 실행할 수 없어진다.
   */
  it('실패해도 실행이 그대로임을 밝힌다', () => {
    renderPane({ state: { kind: 'failed', error: httpError(500) } });

    expect(screen.getByText(t.approval.loadFailedNote)).toBeInTheDocument();
  });
});

describe('ApprovalProgressPane — 단계 그림 · C4-5', () => {
  /**
   * ⭐ **서버가 매긴 단계 번호로 노드를 덮는다.** 디자인 시스템의 기본 노드는 **배열 인덱스+1**이라
   * 그것을 두면 화면이 단계 번호를 다시 매기는 것이 된다 — 픽스처의 번호가 11·12·13이라
   * 인덱스+1(1·2·3)을 쓰는 구현이 여기서 갈린다.
   */
  it('노드가 응답의 단계 번호다', () => {
    renderPane();

    /* 노드 글자가 **정확히** 그 번호다 — 「어딘가에 들어 있다」로 재면 인덱스+1도 통과한다. */
    for (const stepNo of ['11', '12', '13']) {
      expect(screen.getByText(stepNo)).toBeInTheDocument();
    }
  });

  /** 짝 방향 — 인덱스+1로 매긴 번호는 화면에 없다. 이것이 이 갈래의 실제 결함 형태다. */
  it('배열 인덱스로 다시 매긴 번호가 없다', () => {
    renderPane();

    for (const wrong of ['1', '2', '3']) {
      expect(screen.queryByText(wrong)).not.toBeInTheDocument();
    }
  });

  /** 결재 결과는 **코드 그대로** 낸다 — 화면이 「승인」·「반려」로 옮기면 뜻을 지어낸 것이 된다. */
  it('결재 결과 코드가 그대로 보인다', () => {
    renderPane();

    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  /**
   * 결재 전 단계의 **보이는 글자**. 디자인 시스템의 상태 낱말은 스크린리더 전용이라, 이 글자가
   * 없으면 색을 구분하지 못하는 사용자에게 구획이 아무 말도 하지 않는다.
   */
  it('결재 전 단계가 무엇을 기다리는지 글자로 말한다', () => {
    renderPane();

    expect(screen.getByText(t.approval.waitingCurrent)).toBeInTheDocument();
    expect(screen.getByText(t.approval.waitingPending)).toBeInTheDocument();
  });

  /** 승인자 이름이 비어 오면 그 사실을 적고 **내부 번호를 대신 내지 않는다**(omf-mes#44). */
  it('승인자 이름이 비면 번호가 아니라 사실을 낸다', () => {
    const { container } = renderPane();

    expect(screen.getByText(t.values.unknownApprover)).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9603');
  });

  it('단계가 없으면 그 사실을 말한다', () => {
    renderPane({
      state: { kind: 'ready', view: toRequestProgressView(approvalRequestDetail({}, []), []) },
    });

    expect(screen.getByText(t.approval.noSteps)).toBeInTheDocument();
  });
});

describe('ApprovalProgressPane — 요청 정보와 사유 전문', () => {
  it('업무 번호를 그대로 내고 내부 번호를 내지 않는다', () => {
    const { container } = renderPane();

    expect(screen.getByText('SYN-AP-2026-0001')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9501');
  });

  /**
   * ⭐ **사유 전문이 곧 취소 이력이다** — 문서에 취소 사유를 담을 컬럼이 없어(omf-mes#87)
   * 여기 말고는 남는 자리가 없다. 줄바꿈이 뜻을 나르므로 줄째 선다.
   */
  it('사유가 줄째 보인다', () => {
    renderPane();

    const pane = screen.getByRole('group', { name: t.approval.reasonPane });

    expect(pane.textContent).toContain('수량 오기입으로 취소합니다');
    expect(pane.textContent).toContain('실사 차이표 대조 완료');
  });

  it('위치가 서버가 준 두 수로 보인다', () => {
    renderPane();

    expect(screen.getByText(t.approval.position(2, 3))).toBeInTheDocument();
  });
});

describe('ApprovalProgressPane — 자리표시가 안내를 가른다 · C4-6', () => {
  /**
   * ⭐ **자리표시가 빈 동안 판정하지 않고 그 사실을 말한다.** 짐작해 「승인되었습니다」를 내면
   * 그 짐작이 사용자에게는 사실로 보이고, 이 화면에서 그 어긋남은 **되돌릴 수 없는 실행**을
   * 권하는 것이 된다.
   */
  it('빈 자리표시에서는 판정하지 못한다고 말한다', () => {
    renderPane({ state: readyState({ statusCode: 'SYN_APPROVED' }, []), isJudgePending: true });

    expect(screen.getByText(t.approval.unjudgeableNote)).toBeInTheDocument();
    expect(screen.queryByText(t.approval.approvedNote)).not.toBeInTheDocument();
  });

  /** 짝 — 자리표시를 채우면 그 요청이 승인일 때 안내가 바뀐다. **채우면 살아나는 자리다.** */
  it('자리표시를 채우면 승인 문면이 선다', () => {
    renderPane({
      state: readyState({ statusCode: 'SYN_APPROVED' }, ['SYN_APPROVED']),
      isJudgePending: false,
    });

    expect(screen.getByText(t.approval.approvedNote)).toBeInTheDocument();
    expect(screen.queryByText(t.approval.unjudgeableNote)).not.toBeInTheDocument();
  });

  /** 채워졌어도 그 요청이 승인이 아니면 승인 문면이 서지 않는다 — 셋째 갈래다. */
  it('자리표시가 찼어도 승인이 아니면 승인 문면이 서지 않는다', () => {
    renderPane({
      state: readyState({ statusCode: 'SYN_APPROVAL_IN_PROGRESS' }, ['SYN_APPROVED']),
      isJudgePending: false,
    });

    expect(screen.queryByText(t.approval.approvedNote)).not.toBeInTheDocument();
    expect(screen.queryByText(t.approval.unjudgeableNote)).not.toBeInTheDocument();
  });

  /**
   * **계약이 못 박은 사실**이라 늘 선다 — 승인이 끝나도 문서는 저절로 취소되지 않는다.
   * 이 줄이 없으면 사용자는 승인만 받아 놓고 실행을 잊는다.
   */
  it('승인이 끝나도 사람이 다시 눌러야 한다는 사실이 늘 선다', () => {
    renderPane();

    expect(screen.getByText(t.approval.manualExecuteNote)).toBeInTheDocument();
  });
});
