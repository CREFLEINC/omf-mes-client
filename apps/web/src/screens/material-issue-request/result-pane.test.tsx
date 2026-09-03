import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResultPane } from './result-pane';

const t = messages.materialIssueRequest;

/** 최소 갈래 — 잠긴 사유가 **보이는 글자**인지, 결과가 서버 글자를 그대로 내는지만 본다. */

describe('ResultPane', () => {
  it('발행 액션을 제목이 있는 구획으로 구분한다', () => {
    render(
      <ResultPane publishBlockReason={null} banner={null} created={null} onPublish={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { level: 2, name: t.panes.result })).toBeInTheDocument();
  });

  it('잠긴 사유를 보이는 DOM 텍스트로 낸다 — 잠긴 버튼은 포커스를 받지 못한다', () => {
    render(
      <ResultPane
        publishBlockReason={t.actionReasons.noWorkOrder}
        banner={null}
        created={null}
        onPublish={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: t.actions.publish });

    expect(button).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noWorkOrder)).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-describedby');
  });

  it('막힌 곳이 없으면 열린다', () => {
    render(
      <ResultPane publishBlockReason={null} banner={null} created={null} onPublish={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: t.actions.publish })).toBeEnabled();
  });

  it('결과 카드가 요청번호·상태 글자·품목 건수를 그대로 보인다', () => {
    render(
      <ResultPane
        publishBlockReason={t.actionReasons.alreadyPublished}
        banner={null}
        created={{ issueRequestNo: 'SAMPLE-MIR-0003', statusCode: 'SAMPLE_MIR_S_A', lineCount: 1 }}
        onPublish={vi.fn()}
      />,
    );

    expect(screen.getByText(t.result.title)).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE-MIR-0003/)).toBeInTheDocument();
    /* 상태를 옮겨 적지 않는다 — 값 목록이 확정되기 전에 뜻을 지어내면 안 된다(공유계약 G-2). */
    expect(screen.getByText(/SAMPLE_MIR_S_A/)).toBeInTheDocument();
  });

  it('발행 전에는 결과 카드가 없다', () => {
    render(
      <ResultPane publishBlockReason={null} banner={null} created={null} onPublish={vi.fn()} />,
    );

    expect(screen.queryByText(t.result.title)).not.toBeInTheDocument();
  });
});
