import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { typePendingNote } from './code-options';
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

const t = messages.iqcSkipApproval;

interface RenderOptions {
  rows?: RequestRow[];
  isLoading?: boolean;
  meta?: { page: number; size: number; total: number };
  shown?: number;
  selectedRequestId?: number | null;
  typeNote?: string;
  loadError?: ReactNode;
}

const renderPane = ({
  rows = requestRowFixtures,
  isLoading = false,
  meta = { page: 1, size: 20, total: rows.length },
  shown = rows.length,
  selectedRequestId = null,
  typeNote = undefined,
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
      typeNote={typeNote}
      loadError={loadError}
    />,
  );

  return { ...result, onSelect, onChangePage, user: userEvent.setup() };
};

/**
 * **표에 실제로 전달된 열 폭.** 상수가 아니라 산출물을 읽는다.
 *
 * 상수는 「무엇이 폭을 가져야 하는가」의 선언일 뿐이고, 표가 받는 것은 열 정의다. 둘을 잇지
 * 않으면 열 정의에만 폭을 박거나, 한 줄을 지우거나, 두 열의 폭을 맞바꿔도 상수가 그대로라
 * 잣대가 침묵한다.
 *
 * 디자인 시스템 `Table`은 열마다 `<col>`을 그리고 **폭이 없으면 `style`을 붙이지 않는다**
 * (설치본 실측). 그래서 `<col>` 집합이 곧 「어느 열이 폭을 갖고 그 값이 무엇인가」다.
 * 이 표에는 선택 열도 순서 이동 열도 없어 `<col>` 차례가 열 차례와 같다.
 */
const renderedColumnWidths = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll<HTMLElement>('colgroup col')].map((col) =>
    col.style.width === '' ? null : col.style.width,
  );

/**
 * 열 정의가 가져야 할 폭 — **차례까지 포함해** 상수에서 만든다.
 * 가운데 `null`이 흡수 열(사유)이다 — 확정 열 차례가 사유를 넷째에 두었다.
 */
const EXPECTED_COLUMN_WIDTHS: (string | null)[] = [
  REQUEST_COLUMN_WIDTH.approvalRequestNo,
  REQUEST_COLUMN_WIDTH.approvalTypeCode,
  REQUEST_COLUMN_WIDTH.target,
  null,
  REQUEST_COLUMN_WIDTH.requester,
  REQUEST_COLUMN_WIDTH.requestedAt,
];

const pxOf = (width: string): number => Number.parseInt(width, 10);

describe('열 폭 예산 — 선언(상수)', () => {
  it('흡수 열은 사유 하나뿐이다', () => {
    /* 흡수 열이 둘이면 좁은 화면에서 둘 다 짓눌린다. */
    expect(Object.keys(REQUEST_COLUMN_WIDTH)).toEqual([
      'approvalRequestNo',
      'approvalTypeCode',
      'target',
      'requester',
      'requestedAt',
    ]);
  });

  it('지정 폭과 흡수 예산의 합이 표 최소 폭 안이다', () => {
    const specified = Object.values(REQUEST_COLUMN_WIDTH).reduce(
      (sum, width) => sum + pxOf(width),
      0,
    );

    expect(specified).toBe(728);
    expect(specified + REASON_COLUMN_BUDGET_PX).toBeLessThanOrEqual(WIDE_TABLE_MIN_WIDTH_PX);
  });

  /** 일시 칸은 `2026-08-06 14:20`이 한 줄에 들어가야 한다 — 접히면 행 높이가 무너진다. */
  it('상신 일시 칸이 열여섯 자 표기를 담을 폭을 갖는다', () => {
    expect(pxOf(REQUEST_COLUMN_WIDTH.requestedAt)).toBeGreaterThanOrEqual(148);
  });
});

/**
 * **선언이 아니라 산출물을 재는 자리.** 위 단언들은 상수가 무엇을 말하는지만 보고,
 * 그 상수가 표까지 닿았는지는 보지 않는다 — 열 정의에만 폭을 박거나, 한 줄을 지우거나,
 * 두 열의 폭을 맞바꾸면 상수는 그대로라 위 셋이 침묵한다.
 */
describe('열 폭 예산 — 산출물(열 정의)', () => {
  it('표가 받은 폭이 열마다·차례대로 선언과 같다', () => {
    const { container } = renderPane();

    /* 선행 단언 — 열이 실제로 여섯이어야 폭 목록을 견주는 것이 뜻을 갖는다. */
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(renderedColumnWidths(container)).toEqual(EXPECTED_COLUMN_WIDTHS);
  });

  it('폭 없는 열이 정확히 하나다 — 그 하나가 남는 폭을 흡수한다', () => {
    const { container } = renderPane();
    const widths = renderedColumnWidths(container);

    expect(widths).toHaveLength(6);
    expect(widths.filter((width) => width === null)).toHaveLength(1);
    /* 흡수 열은 **넷째**(사유)다 — 자리가 바뀌면 확정 열 차례가 어긋난 것이다. */
    expect(widths[3]).toBeNull();
  });

  it('표가 받은 지정 폭의 합과 흡수 예산이 표 최소 폭 안이다', () => {
    const { container } = renderPane();
    const specified = renderedColumnWidths(container)
      .filter((width): width is string => width !== null)
      .reduce((sum, width) => sum + pxOf(width), 0);

    expect(specified).toBe(728);
    expect(specified + REASON_COLUMN_BUDGET_PX).toBeLessThanOrEqual(WIDE_TABLE_MIN_WIDTH_PX);
  });
});

describe('RequestListPane — 확정된 여섯 열', () => {
  /**
   * 열 구성은 계획이 확정했고 화면이 바꾸지 않는다. 이 단언이 그 목록을 **차례까지** 고정한다 —
   * 열 하나를 더하거나 다른 값으로 갈아 끼우면 여기서 멈춘다.
   */
  it('머리글이 확정 목록 그대로이고 차례도 같다', () => {
    renderPane();

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      t.fields.approvalRequestNo,
      t.fields.approvalTypeCode,
      t.fields.target,
      t.fields.reason,
      t.fields.requestedByName,
      t.fields.requestedAt,
    ]);
  });

  /**
   * **날짜만 그리면 통과하지 못한다.** 픽스처의 시각이 서로 다르고, 같은 날 올라온 요청이
   * 있어 날짜만으로는 행을 가릴 수도 없다.
   */
  it('상신 일시를 시각까지 낸다', () => {
    const { container } = renderPane();
    const text = container.textContent ?? '';

    expect(screen.getByText('2026-08-06 14:20')).toBeInTheDocument();
    /* 앞자리 0이 붙는 시각도 그대로 읽힌다. */
    expect(screen.getByText('2026-08-05 09:05')).toBeInTheDocument();
    expect(text).toContain('18:40');
  });

  /**
   * **유형이 확정되기 전 오결재를 막는 세 자리 중 하나다.** 이름으로 바꾸면 그 이름을
   * 화면이 지어낸 것이 되고, 열을 없애면 무엇을 결재하려는지 가릴 단서가 목록에서 사라진다.
   */
  it('승인 유형 열이 서고 코드를 그대로 낸다', () => {
    renderPane();

    expect(
      screen.getByRole('columnheader', { name: t.fields.approvalTypeCode }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('IQC_SKIP')).toHaveLength(4);
  });

  it('대상 열이 서고 서버가 만든 표시명을 그대로 낸다', () => {
    renderPane();

    expect(screen.getByRole('columnheader', { name: t.fields.target })).toBeInTheDocument();
    /* 같은 문서에 요청이 두 번 올라 이름이 두 자리에 선다. */
    expect(screen.getAllByText('합성 대상 문서 가').length).toBe(2);
    expect(screen.getByText('합성 대상 문서 나')).toBeInTheDocument();
  });

  it('상태 열도 진행 단계 열도 두지 않는다 — 열은 늘리는 것보다 줄이는 것이 먼저다', () => {
    const { container } = renderPane();
    const text = container.textContent ?? '';

    /* 선행 단언 — 열이 실제로 서 있어야 「그 값이 없다」가 뜻을 갖는다. */
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(text).toContain('IQC_SKIP');

    for (const request of requestFixtures) {
      expect(text).not.toContain(request.statusCode);
    }
    expect(text).not.toContain('2 / 3');
  });
});

describe('RequestListPane — 보이는 값', () => {
  it('요청번호와 상신자 이름을 낸다', () => {
    renderPane();

    expect(screen.getByText('SYNTH-REQ-001')).toBeInTheDocument();
    /* 같은 상신자가 여러 행에 선다 — 그것이 이 픽스처가 담은 사실이다. */
    expect(screen.getAllByText('합성 상신자1').length).toBe(2);
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

  /** 대상 유형은 **읽고 판단하는 값이 아니다** — 어느 칸에도 서지 않아야 샐 경로가 없다. */
  it('대상 유형 코드를 어느 칸에도 내지 않는다', () => {
    const { container } = renderPane();
    const text = container.textContent ?? '';

    expect(text).toContain('합성 대상 문서 가');
    for (const request of requestFixtures) {
      expect(text).not.toContain(request.target.targetTypeCode);
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

  it('빈 줄로 시작하는 사유는 내용이 있는 첫 줄을 낸다', () => {
    renderPane();

    expect(screen.getByText('내용이 있는 첫 줄은 여기다')).toBeInTheDocument();
  });

  it('이름이 오지 않은 자리에 번호를 대신 내지 않는다', () => {
    renderPane();

    expect(screen.getByText(t.values.unknownRequester)).toBeInTheDocument();
    expect(screen.getByText(t.values.unknownTarget)).toBeInTheDocument();
  });
});

/**
 * **전환 감지기**(M07의 부품 몫) — 안내를 늘 감추거나 늘 보이면 두 단언 중 하나가 깨진다.
 */
describe('RequestListPane — 유형 미확정 안내', () => {
  it('안내가 오면 목록 위에 한 번만 선다', () => {
    renderPane({ typeNote: typePendingNote(null) });

    expect(screen.getAllByText(t.typePendingNote)).toHaveLength(1);
    /* 안내가 표를 밀어내지 않는다 — 둘 다 선다. */
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('안내가 없으면 그 자리도 없다', () => {
    renderPane({ typeNote: typePendingNote('PURCHASE_ORDER') });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText(t.typePendingNote)).not.toBeInTheDocument();
  });

  /** 상시 안내다 — 표가 없는 상태에서도 「무엇이 보이는 목록인지」를 말할 자리가 남는다. */
  it('불러오는 중에도 실패했을 때도 남는다', () => {
    const { rerender } = renderPane({ typeNote: typePendingNote(null), isLoading: true, rows: [] });

    expect(screen.getByText(t.typePendingNote)).toBeInTheDocument();

    rerender(
      <RequestListPane
        rows={[]}
        isLoading={false}
        pageView={toPageView({ page: 1, size: 20, total: 0 }, 0)}
        onChangePage={vi.fn()}
        selectedRequestId={null}
        onSelect={vi.fn()}
        typeNote={typePendingNote(null)}
        loadError={<p>조회에 실패했습니다</p>}
      />,
    );

    expect(screen.getByText(t.typePendingNote)).toBeInTheDocument();
    expect(screen.getByText('조회에 실패했습니다')).toBeInTheDocument();
  });
});

describe('RequestListPane — 고르기', () => {
  it('요청번호를 누르면 그 요청을 고른다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    expect(onSelect).toHaveBeenCalledWith(9001);
  });

  it('고르기 버튼의 이름이 행마다 갈린다 — 계약이 요청번호를 UNIQUE로 두었다', () => {
    renderPane();

    const names = requestRowFixtures.map((row) => t.actions.selectRow(row.approvalRequestNo));

    expect(new Set(names).size).toBe(requestRowFixtures.length);
    for (const name of names) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
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
