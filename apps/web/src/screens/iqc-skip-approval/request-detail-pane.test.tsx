import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { requestFixtures } from './fixtures';
import { NO_BREAK_SPACE, RequestDetailPane, toVisibleLine } from './request-detail-pane';
import { toRequestDetailView, type ApprovalRequest } from './types';

const t = messages.iqcSkipApproval;

const [multiline] = requestFixtures;

const renderPane = (request: ApprovalRequest): HTMLElement => {
  render(<RequestDetailPane view={toRequestDetailView(request)} />);

  return screen.getByRole('group', { name: t.panes.request });
};

describe('toVisibleLine', () => {
  /**
   * **상수가 정말 U+00A0인지부터 잰다.**
   *
   * 보통 공백과 눈으로 구분되지 않아, 옮겨 쓰는 사이 U+0020으로 바뀌어도 화면은 겉보기에
   * 멀쩡하고 아래 시험들도 전부 통과한다 — **기대값이 그 상수를 다시 쓰기 때문**이다.
   * 그 자기참조를 끊는 자리가 여기다. 코드 포인트로 못 박고 보통 공백이 아님을 짝으로 둔다.
   */
  it('줄바꿈 없는 공백이 정말 U+00A0이다 — 보통 공백이 아니다', () => {
    expect(NO_BREAK_SPACE).toBe('\u00a0');
    expect(NO_BREAK_SPACE).not.toBe(' ');
    expect(NO_BREAK_SPACE.codePointAt(0)).toBe(0x00a0);
  });

  /**
   * **자료 층이 지킨 것을 표기 층이 도로 삼키지 않게 한다.** 블록 상자 첫머리의 보통 공백은
   * HTML이 축약하고, 빈 상자는 높이가 0이라 문단 구분이 남지 않는다.
   */
  it('빈 줄을 글자로 세운다 — 상자가 높이를 갖는다', () => {
    expect(toVisibleLine('')).toBe(NO_BREAK_SPACE);
  });

  it('줄 앞 들여쓰기를 줄바꿈 없는 공백으로 바꾼다 — 그 자리가 축약되지 않는다', () => {
    expect(toVisibleLine('  - 항목')).toBe(`${NO_BREAK_SPACE.repeat(2)}- 항목`);
    /* 축약되는 공백이 하나도 남지 않았다 — 위 단언만으로는 상수가 무엇이든 통과한다. */
    expect(toVisibleLine('  - 항목').startsWith(' ')).toBe(false);
  });

  it('들여쓰기가 없으면 그대로 둔다', () => {
    expect(toVisibleLine('머리말')).toBe('머리말');
  });

  /** 줄 가운데·끝 공백은 바꾸지 않는다 — 전부 바꾸면 복사해 간 사유에 보통 공백이 없어진다. */
  it('줄 가운데 공백은 건드리지 않는다', () => {
    expect(toVisibleLine('앞 뒤 사이')).toBe('앞 뒤 사이');
    expect(toVisibleLine('끝에 공백 ')).toBe('끝에 공백 ');
  });
});

describe('RequestDetailPane — 값 표기', () => {
  it('요청 정보 다섯이 응답 값 그대로 선다', () => {
    const pane = renderPane(multiline as ApprovalRequest);

    expect(within(pane).getByText('SYNTH-REQ-001')).toBeVisible();
    expect(within(pane).getByText('IQC_SKIP')).toBeVisible();
    expect(within(pane).getByText('합성 상신자1')).toBeVisible();
    expect(within(pane).getByText('2026-08-06 14:20')).toBeVisible();
    expect(within(pane).getByText('SAMPLE-STATUS-OPEN')).toBeVisible();
  });

  it('다섯 칸에 라벨이 붙는다 — 값만 늘어놓지 않는다', () => {
    const pane = renderPane(multiline as ApprovalRequest);

    for (const label of [
      t.fields.approvalRequestNo,
      t.fields.approvalTypeCode,
      t.fields.requestedByName,
      t.fields.requestedAt,
      t.fields.status,
    ]) {
      expect(within(pane).getByText(label)).toBeVisible();
    }
  });

  /** 코드 문자열 그대로다 — 값 목록이 확정되기 전에 화면이 이름을 지어내지 않는다. */
  it('승인 유형을 코드 그대로 낸다', () => {
    const pane = renderPane(multiline as ApprovalRequest);

    expect(within(pane).getByText('IQC_SKIP')).toBeVisible();
  });

  it('내부 번호가 어느 칸에도 없다 — 이름은 보인다(짝 단언)', () => {
    const pane = renderPane(multiline as ApprovalRequest);

    expect(within(pane).getByText('합성 상신자1')).toBeVisible();
    expect(pane.textContent).not.toContain(String(multiline?.approvalRequestId));
    expect(pane.textContent).not.toContain(String(multiline?.requestedBy));
    expect(pane.textContent).not.toContain(String(multiline?.target.targetId));
  });

  it('상신자 이름이 비어 오면 그 사실을 적고 번호를 내지 않는다', () => {
    const nameless = requestFixtures.find((request) => request.requestedByName === '');
    const pane = renderPane(nameless as ApprovalRequest);

    expect(within(pane).getByText(t.values.unknownRequester)).toBeVisible();
    expect(pane.textContent).not.toContain(String(nameless?.requestedBy));
  });

  /** 대상·결재 진행은 각자 자기 구획이 있다 — 이 구획이 그것을 그리면 자리가 둘이 된다. */
  it('대상 이름을 그리지 않는다', () => {
    const pane = renderPane(multiline as ApprovalRequest);

    expect(pane.textContent).not.toContain(multiline?.target.displayName ?? '');
    expect(pane.textContent).not.toContain(multiline?.target.targetTypeCode ?? '');
  });
});

describe('RequestDetailPane — 사유 전문', () => {
  it('여러 줄 사유의 모든 줄이 보인다 — 목록의 첫 줄 규칙이 걸리지 않는다', () => {
    const pane = renderPane(multiline as ApprovalRequest);

    expect(within(pane).getByText('합성 사유 첫 줄')).toBeVisible();
    expect(
      within(pane).getByText(
        '둘째 줄은 훨씬 길게 이어지는 설명이고 목록의 요약 자리에는 오지 않아야 한다',
      ),
    ).toBeVisible();
  });

  it('줄마다 한 칸이라 줄바꿈이 유지된다', () => {
    renderPane(multiline as ApprovalRequest);

    const reason = screen.getByRole('group', { name: t.panes.reason });

    expect(reason.querySelectorAll('p')).toHaveLength(2);
  });

  it('가운데 빈 줄이 칸으로 남는다 — 문단 구분이 사라지지 않는다', () => {
    const paragraphs: ApprovalRequest = {
      ...(multiline as ApprovalRequest),
      reason: '첫 문단\n\n둘째 문단',
    };

    renderPane(paragraphs);

    const lines = [...screen.getByRole('group', { name: t.panes.reason }).querySelectorAll('p')];

    expect(lines).toHaveLength(3);
    expect(lines[1]?.textContent).toBe(NO_BREAK_SPACE);
  });

  it('들여쓴 줄의 앞 공백이 보이는 글자로 남는다', () => {
    const indented: ApprovalRequest = {
      ...(multiline as ApprovalRequest),
      reason: '머리말\n  - 들여쓴 항목',
    };

    renderPane(indented);

    const lines = [...screen.getByRole('group', { name: t.panes.reason }).querySelectorAll('p')];

    expect(lines[1]?.textContent).toBe(`${NO_BREAK_SPACE.repeat(2)}- 들여쓴 항목`);
    /*
     * **상수를 다시 쓰지 않고 잰다.** 위 단언은 상수가 보통 공백이어도 통과한다 — 그때
     * 브라우저는 그 두 칸을 축약해 들여쓰기가 사라진다. 그리는 자리에서도 자기참조를 끊는다.
     */
    expect(/^\u00a0\u00a0-/.test(lines[1]?.textContent ?? '')).toBe(true);
  });

  it('한 줄뿐인 사유도 그대로 선다', () => {
    const single = requestFixtures.find((request) => request.approvalRequestNo === 'SYNTH-REQ-002');

    renderPane(single as ApprovalRequest);

    const lines = [...screen.getByRole('group', { name: t.panes.reason }).querySelectorAll('p')];

    expect(lines).toHaveLength(1);
    expect(lines[0]?.textContent).toBe('합성 사유 한 줄짜리');
  });

  it('사유가 비어 오면 빈 칸 대신 그 사실이 선다', () => {
    const empty: ApprovalRequest = { ...(multiline as ApprovalRequest), reason: '\n  \n' };
    const pane = renderPane(empty);

    expect(within(pane).getByText(t.values.emptyReason)).toBeVisible();
  });

  it('사유 칸에 라벨이 붙는다', () => {
    const pane = renderPane(multiline as ApprovalRequest);

    expect(within(pane).getByText(t.fields.reason)).toBeVisible();
  });
});
