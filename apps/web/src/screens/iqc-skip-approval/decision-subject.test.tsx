import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DecisionSubjectSummary } from './decision-subject';
import { requestFixtures } from './fixtures';
import { toDecisionSubject, type ApprovalRequest } from './types';

const t = messages.iqcSkipApproval;

const [multiline] = requestFixtures;

const renderSummary = (request: ApprovalRequest = multiline as ApprovalRequest) => {
  render(<DecisionSubjectSummary subject={toDecisionSubject(request)} />);

  return within(screen.getByRole('group', { name: t.panes.decisionSubject }));
};

/**
 * 확인 창 안의 대상 요약 — **오결재 방어의 마지막 자리**(계획 §13-2 셋째 방어 · M60).
 *
 * 두 창이 같은 요약을 보이므로 부품 하나가 소유한다. 창마다 따로 그리면 한쪽만 값이 빠져도
 * 다른 쪽 시험이 통과해 **방어가 반쪽만 남은 것을 아무도 모른다.**
 */
describe('DecisionSubjectSummary', () => {
  it('다섯 값을 라벨과 함께 다시 보인다', () => {
    const summary = renderSummary();

    for (const [label, value] of [
      [t.fields.approvalRequestNo, 'SYNTH-REQ-001'],
      [t.fields.approvalTypeCode, 'SAMPLE-TYPE-A'],
      [t.fields.target, '합성 대상 문서 가'],
      [t.fields.requestedByName, '합성 상신자1'],
      [t.fields.reason, '합성 사유 첫 줄'],
    ]) {
      expect(summary.getByText(label as string)).toBeVisible();
      expect(summary.getByText(value as string)).toBeVisible();
    }
  });

  /**
   * **값이 라벨에 실제로 매여 있다.** 다섯 값이 한 상자에 나열되기만 하면 어느 값이 무엇인지는
   * 보는 사람이 짐작해야 한다 — 유형 코드와 대상 표시명은 둘 다 낯선 문자열이라 특히 그렇다.
   */
  it('라벨과 값이 정의 목록으로 짝지어져 있다', () => {
    const summary = renderSummary();
    const terms = summary.getAllByRole('term').map((node) => node.textContent);
    const details = summary.getAllByRole('definition').map((node) => node.textContent);

    expect(terms).toEqual([
      t.fields.approvalRequestNo,
      t.fields.approvalTypeCode,
      t.fields.target,
      t.fields.requestedByName,
      t.fields.reason,
    ]);
    expect(details).toEqual([
      'SYNTH-REQ-001',
      'SAMPLE-TYPE-A',
      '합성 대상 문서 가',
      '합성 상신자1',
      '합성 사유 첫 줄',
    ]);
  });

  /** 유형 코드는 **코드 그대로**다 — 값 목록이 확정되기 전에 이름을 지어내면 그것이 매핑표다. */
  it('유형 코드를 이름으로 바꾸지 않는다', () => {
    const other = requestFixtures.find((request) => request.approvalTypeCode === 'SAMPLE-TYPE-B');
    const summary = renderSummary(other as ApprovalRequest);

    expect(summary.getByText('SAMPLE-TYPE-B')).toBeVisible();
  });

  /** 짝 방향 — 이름이 비어 와도 **번호를 대신 내지 않는다**(`omf-mes#44`). */
  it('이름이 비어 오면 대체 문구가 서고 내부 번호가 서지 않는다', () => {
    const nameless = requestFixtures.find((request) => request.requestedByName === '');
    const summary = renderSummary(nameless as ApprovalRequest);

    expect(summary.getByText(t.values.unknownRequester)).toBeVisible();
    expect(summary.getByText(t.values.unknownTarget)).toBeVisible();
    expect(screen.queryByText(String(nameless?.requestedBy))).toBeNull();
    expect(screen.queryByText(String(nameless?.target.targetId))).toBeNull();
  });
});
