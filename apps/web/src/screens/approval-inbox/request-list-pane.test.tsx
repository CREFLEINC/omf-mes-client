import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  FIRST_LINE_OF_MULTILINE_REASON,
  SECOND_LINE_OF_MULTILINE_REASON,
  requestFixtures,
  requestRowFixtures,
} from './fixtures';
import { toPageView } from './pagination';
import {
  REASON_COLUMN_BUDGET_PX,
  REQUEST_COLUMN_WIDTH,
  RequestListPane,
  WIDE_TABLE_MIN_WIDTH_PX,
} from './request-list-pane';
import type { RequestRow } from './types';

const t = messages.approvalInbox;

interface RenderOptions {
  rows?: RequestRow[];
  isLoading?: boolean;
  meta?: { page: number; size: number; total: number };
  shown?: number;
  selectedRequestId?: number | null;
  loadError?: ReactNode;
}

const renderPane = ({
  rows = requestRowFixtures,
  isLoading = false,
  meta = { page: 1, size: 20, total: rows.length },
  shown = rows.length,
  selectedRequestId = null,
  loadError = null,
}: RenderOptions = {}) => {
  const onSelect = vi.fn();
  const onChangePage = vi.fn();

  const result = render(
    <RequestListPane
      rows={rows}
      isLoading={isLoading}
      pageView={toPageView(meta, shown)}
      onChangePage={onChangePage}
      selectedRequestId={selectedRequestId}
      onSelect={onSelect}
      loadError={loadError}
    />,
  );

  return { ...result, onSelect, onChangePage, user: userEvent.setup() };
};

describe('열 폭 예산', () => {
  it('흡수 열은 사유 하나뿐이다', () => {
    /* 흡수 열이 둘이면 좁은 화면에서 둘 다 짓눌린다. */
    expect(Object.keys(REQUEST_COLUMN_WIDTH)).toEqual([
      'approvalRequestNo',
      'target',
      'requester',
      'requestedDate',
      'status',
      'progress',
    ]);
  });

  it('지정 폭과 흡수 예산의 합이 표 최소 폭 안이다', () => {
    const specified = Object.values(REQUEST_COLUMN_WIDTH).reduce(
      (sum, width) => sum + Number.parseInt(width, 10),
      0,
    );

    expect(specified).toBe(732);
    expect(specified + REASON_COLUMN_BUDGET_PX).toBeLessThanOrEqual(WIDE_TABLE_MIN_WIDTH_PX);
  });
});

describe('RequestListPane — 보이는 값', () => {
  it('요청번호와 이름을 낸다', () => {
    renderPane();

    expect(screen.getByText('SYNTH-REQ-001')).toBeInTheDocument();
    /* 같은 상신자·같은 대상이 여러 행에 선다 — 그것이 이 픽스처가 담은 사실이다. */
    expect(screen.getAllByText('합성 상신자1').length).toBe(2);
    expect(screen.getAllByText('합성 대상 문서 가').length).toBe(2);
  });

  it('내부 번호를 어느 칸에도 내지 않는다', () => {
    const { container } = renderPane();
    const text = container.textContent ?? '';

    /* 선행 단언 — 이름이 보여야 「번호가 없다」가 뜻을 갖는다. */
    expect(text).toContain('합성 상신자1');
    expect(text).toContain('SYNTH-REQ-001');

    for (const request of requestFixtures) {
      expect(text).not.toContain(String(request.approvalRequestId));
      expect(text).not.toContain(String(request.requestedBy));
      expect(text).not.toContain(String(request.target.targetId));
    }
  });

  it('사유는 첫 줄만 낸다 — 요약 열을 두지 않는다', () => {
    renderPane();

    expect(screen.getByText(FIRST_LINE_OF_MULTILINE_REASON)).toBeInTheDocument();
    expect(screen.queryByText(SECOND_LINE_OF_MULTILINE_REASON)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: new RegExp('요약') }),
    ).not.toBeInTheDocument();
  });

  it('이름이 오지 않은 자리에 번호를 대신 내지 않는다', () => {
    renderPane();

    expect(screen.getByText(t.values.unknownRequester)).toBeInTheDocument();
    expect(screen.getByText(t.values.unknownTarget)).toBeInTheDocument();
  });

  it('진행은 서버가 준 두 값 그대로다', () => {
    renderPane();

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    /* 현재 단계가 전체보다 큰 응답도 고쳐 쓰지 않는다. */
    expect(screen.getByText('2 / 1')).toBeInTheDocument();
    /* 끝난 요청은 「종료」다 — 0으로 메우지 않는다. */
    expect(screen.getByText(t.values.finished)).toBeInTheDocument();
  });

  it('승인 유형 열을 두지 않는다 — 무엇에 대한 결재인지는 대상이 말한다', () => {
    renderPane();

    /* 선행 단언 — 열이 실제로 서 있어야 「그 열이 없다」가 뜻을 갖는다. */
    expect(screen.getByRole('columnheader', { name: t.fields.target })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(
      screen.queryByRole('columnheader', { name: t.fields.approvalTypeCode }),
    ).not.toBeInTheDocument();
  });
});

describe('RequestListPane — 고르기', () => {
  it('요청번호를 누르면 그 요청을 고른다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    expect(onSelect).toHaveBeenCalledWith(9001);
  });

  it('고르기 버튼의 이름이 대상까지 담는다 — 같은 대상에 요청이 여러 번 오를 수 있다', () => {
    renderPane();

    expect(
      screen.getByRole('button', {
        name: t.actions.selectRow('SYNTH-REQ-001', '합성 대상 문서 가'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: t.actions.selectRow('SYNTH-REQ-004', '합성 대상 문서 가'),
      }),
    ).toBeInTheDocument();
  });

  it('고른 행을 표시한다', () => {
    renderPane({ selectedRequestId: 9001 });

    expect(screen.getByRole('button', { name: /SYNTH-REQ-001/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: /SYNTH-REQ-002/ })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('RequestListPane — 빈 상태', () => {
  it('0건이어도 표를 그리고 그 안의 빈 자리가 맡는다', () => {
    renderPane({ rows: [], meta: { page: 1, size: 20, total: 0 }, shown: 0 });

    /* 바깥에서 0건을 가르면 표의 빈 자리가 닿을 수 없는 가지가 된다. */
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  it('쪽 밖은 결과 없음과 다른 안내다', async () => {
    const { onChangePage, user } = renderPane({
      rows: [],
      meta: { page: 9, size: 20, total: 45 },
      shown: 0,
    });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));
    expect(onChangePage).toHaveBeenCalledWith(1);
  });
});

describe('RequestListPane — 조회 실패와 로딩', () => {
  it('실패하면 표도 빈 상태 문구도 내지 않는다', () => {
    renderPane({ rows: [], loadError: <p>조회에 실패했습니다</p> });

    expect(screen.getByText('조회에 실패했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('불러오는 중에는 그 사실을 알린다', () => {
    renderPane({ rows: [], isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.list })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });
});
