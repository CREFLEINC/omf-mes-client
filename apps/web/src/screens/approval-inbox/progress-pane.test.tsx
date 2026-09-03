import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressPane } from './progress-pane';
import { REJECTION_DECISION_CODES, toRequestProgressView } from './progress';
import type { ApprovalRequest, ApprovalStep } from './types';

const t = messages.approvalInbox;

const SYNTHETIC_REJECTION_CODE = 'REJECTED';

const step = (overrides: Partial<ApprovalStep> = {}): ApprovalStep => ({
  stepNo: 1,
  approverId: 9501,
  approverName: '합성 승인자1',
  isMine: false,
  isCurrent: false,
  ...overrides,
});

const request = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  approvalRequestId: 9001,
  approvalRequestNo: 'SYNTH-REQ-001',
  approvalTypeCode: 'PURCHASE_ORDER',
  requestedBy: 9301,
  requestedByName: '합성 상신자1',
  requestedAt: '2026-08-06T14:20:00+09:00',
  statusCode: 'SAMPLE-STATUS-OPEN',
  reason: '합성 사유',
  target: {
    targetTypeCode: 'PURCHASE_ORDER',
    targetId: 9401,
    displayName: '합성 대상 문서 가',
    openable: false,
  },
  currentStepNo: 1,
  totalStepNo: 1,
  isMyTurn: false,
  ...overrides,
});

const renderPane = (
  steps: ApprovalStep[],
  overrides: Partial<ApprovalRequest> = {},
  rejectionCodes: readonly string[] = REJECTION_DECISION_CODES,
): HTMLElement => {
  render(
    <ProgressPane
      view={toRequestProgressView({ request: request(overrides), steps }, rejectionCodes)}
    />,
  );

  return screen.getByRole('group', { name: t.panes.progress });
};

/** 단계 하나가 그려진 `<li>`. 디자인 시스템이 상태를 `data-status`로 낸다(설치본 실측). */
const stepItems = (pane: HTMLElement): HTMLElement[] => [
  ...pane.querySelectorAll<HTMLElement>('li[data-status]'),
];

/**
 * 단계 노드(동그라미) 안의 글자. 디자인 시스템이 노드를 `aria-hidden` span으로 내고
 * 그 뒤에 연결선 span을 하나 더 두므로 **단계마다 첫째 것**을 본다(설치본 실측).
 */
const stepNodeTexts = (pane: HTMLElement): (string | null)[] =>
  stepItems(pane).map(
    (item) => item.querySelector('span[aria-hidden="true"]')?.textContent ?? null,
  );

/**
 * 단계 하나의 **이름 칸과 보조 라벨 칸**.
 *
 * 디자인 시스템이 `<li>` 안에 노드 → 라벨 묶음 → (연결선) 순으로 세우고, 라벨 묶음 안에
 * 이름과 보조 라벨을 그 차례로 둔다(설치본 실측). 클래스 이름이 해시라 **자리로** 짚는다.
 *
 * 이 구분이 필요한 이유: 「디자인 시스템의 상태 낱말이 스크린리더 전용이라 **보이는 글자는
 * 보조 라벨이 맡는다**」가 이 구획의 중심 주장인데, 글자가 화면 어딘가에 있다는 것만으로는
 * 그 주장이 지켜졌는지 알 수 없다 — 이름 칸으로 옮겨도 `getByText`는 똑같이 찾는다.
 */
const stepSlots = (item: HTMLElement): { label: Element | null; description: Element | null } => {
  const stack = item.children[1];

  return { label: stack?.children[0] ?? null, description: stack?.children[1] ?? null };
};

describe('ProgressPane — 배치', () => {
  it('세로로 그린다 — 단계마다 보조 라벨이 다행으로 붙는다', () => {
    const pane = renderPane([step()]);

    expect(pane.querySelector('ol')).toHaveAttribute('data-orientation', 'vertical');
  });

  it('서버가 준 진행 위치를 그대로 낸다', () => {
    const pane = renderPane([step()], { currentStepNo: 2, totalStepNo: 3 });

    expect(within(pane).getByText(t.progress.position(2, 3))).toBeVisible();
  });

  it('끝난 요청은 종료라고 적는다', () => {
    const pane = renderPane([step({ decisionCode: 'APPROVED' })], {
      currentStepNo: null,
      totalStepNo: 2,
    });

    expect(within(pane).getByText(t.progress.finished(2))).toBeVisible();
  });

  it('내 차례인지를 글자로 밝힌다', () => {
    const pane = renderPane([step()], { isMyTurn: true });

    expect(within(pane).getByText(t.progress.myTurn)).toBeVisible();
  });

  it('내 차례가 아니어도 그 사실을 밝힌다 — 왜 아닌지는 지어내지 않는다', () => {
    const pane = renderPane([step()], { isMyTurn: false });

    expect(within(pane).getByText(t.progress.notMyTurn)).toBeVisible();
    expect(within(pane).queryByText(t.progress.myTurn)).not.toBeInTheDocument();
  });

  it('단계가 오지 않으면 그 사실을 적고 표를 지어내지 않는다', () => {
    const pane = renderPane([]);

    expect(within(pane).getByText(t.progress.noSteps)).toBeVisible();
    expect(pane.querySelector('ol')).toBeNull();
    /* 위치와 차례는 그대로 선다 — 진행을 모르는 것과 요청이 없는 것은 다르다. */
    expect(within(pane).getByText(t.progress.position(1, 1))).toBeVisible();
  });

  it('오류 배너를 세우지 않는다 — 승인자가 없어 멈춘 요청은 오류가 아니라 안내다', () => {
    const pane = renderPane([step({ isCurrent: true }), step({ stepNo: 2 })], {
      currentStepNo: 1,
      totalStepNo: 2,
      isMyTurn: false,
    });

    expect(within(pane).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(pane).getByText(t.progress.waitingCurrent)).toBeVisible();
  });
});

describe('ProgressPane — 단계', () => {
  it('승인자 이름이 단계 이름이다', () => {
    const pane = renderPane([step({ approverName: '합성 승인자2' })]);

    expect(within(pane).getByText('합성 승인자2')).toBeVisible();
  });

  it('승인자 이름이 없으면 번호를 대신 내지 않는다', () => {
    const pane = renderPane([step({ approverName: '', approverId: 9501 })]);

    expect(within(pane).getByText(t.values.unknownApprover)).toBeVisible();
    expect(pane.textContent).not.toContain('9501');
  });

  it('결재 결과 코드를 그대로 낸다 — 화면 낱말로 바꾸지 않는다', () => {
    const pane = renderPane([
      step({
        decisionCode: 'APPROVED',
        decisionAt: '2026-08-06T15:02:00+09:00',
        decisionComment: '합성 결재 의견',
      }),
    ]);

    expect(within(pane).getByText('APPROVED')).toBeVisible();
    expect(within(pane).getByText('2026-08-06 15:02')).toBeVisible();
    expect(within(pane).getByText('합성 결재 의견')).toBeVisible();
  });

  it('결재 전 단계는 상태를 글자로 말한다 — 색·아이콘에만 기대지 않는다', () => {
    const pane = renderPane([step({ isCurrent: true }), step({ stepNo: 2 })]);

    expect(within(pane).getByText(t.progress.waitingCurrent)).toBeVisible();
    expect(within(pane).getByText(t.progress.waitingPending)).toBeVisible();
  });

  it('보이는 글자가 이름 칸이 아니라 보조 라벨 칸에 선다', () => {
    const pane = renderPane([
      step({
        decisionCode: 'APPROVED',
        decisionAt: '2026-08-06T15:02:00+09:00',
        decisionComment: '합성 결재 의견',
        isMine: true,
      }),
    ]);

    const { label, description } = stepSlots(stepItems(pane)[0] ?? pane);

    /* 이름 칸은 승인자 이름만 맡는다 — 결과가 여기로 흘러들면 단계 이름이 문장이 된다. */
    expect(label?.textContent).toContain('합성 승인자1');
    for (const shown of ['APPROVED', '2026-08-06 15:02', '합성 결재 의견', t.progress.mine]) {
      expect(description?.textContent).toContain(shown);
      expect(label?.textContent).not.toContain(shown);
    }
  });

  it('결재 전 단계의 대기 글자도 보조 라벨 칸에 선다', () => {
    const pane = renderPane([step({ isCurrent: true })]);

    const { label, description } = stepSlots(stepItems(pane)[0] ?? pane);

    expect(description?.textContent).toContain(t.progress.waitingCurrent);
    expect(label?.textContent).not.toContain(t.progress.waitingCurrent);
  });

  it('내 단계에 표식을 붙이고 남의 단계에는 붙이지 않는다', () => {
    const pane = renderPane([step({ isMine: true }), step({ stepNo: 2, isMine: false })]);

    const items = stepItems(pane);

    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain(t.progress.mine);
    expect(items[1]?.textContent).not.toContain(t.progress.mine);
  });

  it('노드가 서버가 매긴 단계 번호를 낸다 — 배열 차례로 다시 매기지 않는다', () => {
    /* 디자인 시스템의 기본 노드는 배열 인덱스+1이다. 그것이 곧 재계산이다. */
    const pane = renderPane([step({ stepNo: 3 }), step({ stepNo: 7 })]);

    expect(stepNodeTexts(pane)).toEqual(['3', '7']);
  });

  it('결재된 단계의 노드도 번호다 — 체크 글리프가 승인됨을 함의하지 않는다', () => {
    const pane = renderPane([step({ stepNo: 1, decisionCode: 'APPROVED' })]);

    /*
     * 기본 글리프가 섰다면 노드 글자가 아이콘 리거처 이름(`check`)이 된다 — 디자인 시스템이
     * 아이콘을 `<svg>`가 아니라 리거처 `<span>`으로 그린다(설치본 실측). 그래서 「번호다」를
     * 재는 것이 곧 「글리프가 아니다」를 재는 것이고, 따로 `svg`를 찾는 단언은 공허하다.
     */
    expect(stepNodeTexts(pane)).toEqual(['1']);
  });

  it('진행 중인 단계에만 현재 표식이 붙는다', () => {
    const pane = renderPane([
      step({ decisionCode: 'APPROVED' }),
      step({ stepNo: 2, isCurrent: true }),
      step({ stepNo: 3 }),
    ]);

    const items = stepItems(pane);

    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null]);
  });
});

describe('ProgressPane — 반려 자리표시', () => {
  it('자리표시가 빈 동안에는 어떤 단계도 반려로 그려지지 않는다', () => {
    const pane = renderPane([
      step({ decisionCode: SYNTHETIC_REJECTION_CODE }),
      step({ stepNo: 2, decisionCode: 'APPROVED' }),
    ]);

    const items = stepItems(pane);

    /* 선행 단언 — 두 단계가 실제로 그려졌다. */
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.getAttribute('data-status'))).toEqual(['complete', 'complete']);
  });

  it('자리표시를 채우면 그 코드의 단계가 반려로 그려진다', () => {
    /* 전환 감지기(계획 M22) — 부품 수준. */
    const pane = renderPane(
      [
        step({ decisionCode: SYNTHETIC_REJECTION_CODE }),
        step({ stepNo: 2, decisionCode: 'APPROVED' }),
      ],
      {},
      [SYNTHETIC_REJECTION_CODE],
    );

    const items = stepItems(pane);

    expect(items.map((item) => item.getAttribute('data-status'))).toEqual(['rejected', 'complete']);
    /* 결과는 여전히 글자가 말한다 — 상태가 색에만 실리지 않는다. */
    expect(within(pane).getByText(SYNTHETIC_REJECTION_CODE)).toBeVisible();
  });
});
