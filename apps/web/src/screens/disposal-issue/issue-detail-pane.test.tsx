import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { goodsIssueFixtures, INTERNAL_IDS } from './fixtures';
import { IssueDetailPane } from './issue-detail-pane';
import type { IssueView } from './types';

const t = messages.disposalIssue;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 폐기창고 가';

const issue = (overrides: Partial<IssueView> = {}): IssueView =>
  ({
    ...goodsIssueFixtures[0],
    ...overrides,
  }) as IssueView;

const renderPane = (overrides: Partial<IssueView> = {}) =>
  render(<IssueDetailPane issue={issue(overrides)} warehouseName={WAREHOUSE_LABEL} />);

describe('IssueDetailPane — 값 표기', () => {
  it('일곱 값을 낸다', () => {
    renderPane();

    const pane = screen.getByRole('group', { name: t.issueSummary.label });

    for (const label of [
      t.issueSummary.goodsIssueNo,
      t.issueSummary.issueType,
      t.issueSummary.reason,
      t.issueSummary.issuedAt,
      t.issueSummary.status,
      t.issueSummary.warehouse,
      t.issueSummary.erp,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(pane.querySelectorAll('dd')).toHaveLength(7);
  });

  it('출고번호·일시·창고 이름을 읽을 수 있게 낸다', () => {
    renderPane();

    expect(screen.getByText('GI-2026-950001')).toBeInTheDocument();
    expect(screen.getByText('2026-08-08 14:20')).toBeInTheDocument();
    expect(screen.getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
  });

  /** 값 집합이 확정되지 않아 뜻을 붙이면 값이 정해질 때 조용히 틀린다 — 코드 그대로 낸다. */
  it('코드를 해석하지 않고 그대로 낸다', () => {
    renderPane();

    expect(screen.getByText('SAMPLE_GI_TYPE_A')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_GI_STATUS_A')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_GI_REASON_A')).toBeInTheDocument();
  });

  it('사유 코드가 없으면 그 사실을 적는다', () => {
    renderPane({ reasonCode: null });

    expect(screen.getByText(t.values.noReasonCode)).toBeInTheDocument();
  });

  /** 짝 방향 단언 — 값이 실제로 보이고, 그 어느 자리에도 번호가 없다(`omf-mes#44`). */
  it('내부 번호를 어느 칸에도 내지 않는다', () => {
    const { container } = renderPane();

    expect(screen.getByText('GI-2026-950001')).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /**
   * **상신 여부를 여기서 말하지 않는다** — 결재 진행 구획이 말한다. 같은 사실을 두 구획이
   * 각자 말하면 한쪽만 고쳐질 때 화면이 자기 모순에 빠진다.
   */
  it('상신 여부를 말하지 않는다', () => {
    const { container } = renderPane({ approvalRequestId: null });

    expect(container.textContent ?? '').not.toContain(t.values.notSubmitted);
  });
});

describe('IssueDetailPane — ERP 적재 세 갈래', () => {
  /** 계약이 「적재이지 전송이 아니다」라고 못 박았다 — 화면도 「전송됨」이라 적지 않는다. */
  it('적재됨을 「전송됨」이라 적지 않는다', () => {
    renderPane({ erpMessageQueued: true });

    expect(screen.getByText(t.values.erpQueued)).toBeInTheDocument();
    expect(t.values.erpQueued).not.toContain('전송');
  });

  it('적재되지 않음을 그대로 낸다', () => {
    renderPane({ erpMessageQueued: false });

    expect(screen.getByText(t.values.erpNotQueued)).toBeInTheDocument();
  });

  /**
   * **값이 오지 않은 것과 거짓을 가른다.** 계약이 이 필드를 선택으로 두어 오지 않는 응답이
   * 실재하고, 그때 「적재되지 않음」으로 적으면 확인하지 않은 것을 말하는 것이 된다.
   */
  it('값이 오지 않으면 그 사실을 따로 적는다', () => {
    renderPane({ erpMessageQueued: null });

    expect(screen.getByText(t.values.erpUnknown)).toBeInTheDocument();
    expect(screen.queryByText(t.values.erpNotQueued)).not.toBeInTheDocument();
  });

  it('세 문구가 서로 다르다', () => {
    expect(new Set([t.values.erpQueued, t.values.erpNotQueued, t.values.erpUnknown]).size).toBe(3);
  });
});
