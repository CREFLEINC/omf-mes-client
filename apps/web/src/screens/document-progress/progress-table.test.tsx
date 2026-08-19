import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { documentProgress, documentProgressFixtures } from './fixtures';
import {
  buildProgressColumns,
  PROGRESS_TABLE_MIN_WIDTH_PX,
  ProgressTable,
  readEmptyReason,
  type ProgressTableProps,
} from './progress-table';

const t = messages.documentProgress;

const baseProps = (overrides: Partial<ProgressTableProps> = {}): ProgressTableProps => ({
  rows: documentProgressFixtures,
  isLoading: false,
  isTypeListPending: false,
  hasDocumentType: true,
  isBeyondLast: false,
  onFirstPage: vi.fn(),
  ...overrides,
});

const renderTable = (overrides: Partial<ProgressTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<ProgressTable {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

/**
 * 열 차례(0부터). **수치 열은 글자가 겹칠 수 있어 자리로 견뎌야 한다** — 잔여 0과 후속 0이
 * 같은 글자라 글자로만 찾으면 두 열이 뒤바뀌어도 감지기가 통과한다.
 */
const PLANNED_QTY_CELL = 4;
const PROCESSED_QTY_CELL = 5;
const REMAINING_QTY_CELL = 6;
const SUCCESSOR_COUNT_CELL = 7;

const cellTextsOf = (documentNo: string): string[] =>
  [...screen.getByRole('row', { name: new RegExp(documentNo) }).querySelectorAll('td')].map(
    (cell) => cell.textContent ?? '',
  );

describe('buildProgressColumns — 열 구성과 폭 예산', () => {
  const columns = buildProgressColumns();

  /*
   * ⛔ **문서 유형 열이 없다.** 계약이 `documentTypeCode`를 필수 질의값으로 두어 한 응답의
   * 모든 행이 같은 유형이다 — 값이 하나뿐인 열은 폭만 먹고 아무것도 말하지 않는다.
   */
  it('아홉 열이고 유형 열이 없다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'documentNo',
      'documentDate',
      'documentSubTypeCode',
      'statusCode',
      'plannedQty',
      'processedQty',
      'remainingQty',
      'successorCount',
      'cancelAvailability',
    ]);
    expect(columns.map((column) => column.key)).not.toContain('documentTypeCode');
  });

  /* ⭐ 후속 건수와 취소 가능이 **열**로 있어야 목록에서 대상을 고를 수 있다(착수 이슈 §6). */
  it('후속 건수와 취소 가능이 열로 있다', () => {
    const keys = columns.map((column) => column.key);

    expect(keys).toContain('successorCount');
    expect(keys).toContain('cancelAvailability');
  });

  it('흡수 열이 정확히 하나다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
  });

  it('지정 폭 합과 흡수 예산이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(776);
    /*
     * 흡수 열의 두 조각은 일부러 위아래로 쌓이므로 예산의 기준은 **긴 조각 하나**다 —
     * 가장 긴 사유 문면(10자 75px + 셀 여백 32px = 107px)이 들어가면 된다.
     */
    expect(PROGRESS_TABLE_MIN_WIDTH_PX - fixed).toBe(152);
    expect(PROGRESS_TABLE_MIN_WIDTH_PX - fixed).toBeGreaterThanOrEqual(107);
  });

  /* 선언(상수)과 산출물(`<col>`) 두 자리를 각각 잰다 — 한 자리만 재면 둘이 어긋나도 안 잡힌다. */
  it('선언한 폭이 렌더 산출물의 열 폭과 같다', () => {
    const { container } = render(<ProgressTable {...baseProps()} />);
    const rendered = [...container.querySelectorAll('col')].map((col) => col.style.width);
    const declared = columns.map((column) => column.width ?? '');

    expect(rendered).toEqual(declared);
  });

  /* 수치 열은 오른쪽으로 정렬돼야 자릿수가 맞아 눈으로 견줄 수 있다. */
  it('수량과 후속 건수는 우측 정렬이다', () => {
    const aligned = columns.filter((column) => column.align === 'end').map((column) => column.key);

    expect(aligned).toEqual(['plannedQty', 'processedQty', 'remainingQty', 'successorCount']);
  });
});

describe('ProgressTable — 행 그리기', () => {
  it('응답의 값을 그대로 낸다', () => {
    renderTable({ rows: [documentProgress()] });

    const row = screen.getByRole('row', { name: /SYN-GR-2026-0001/ });

    expect(within(row).getByText('2026-08-06')).toBeInTheDocument();
    expect(within(row).getByText('SYN_SUB_A')).toBeInTheDocument();
    expect(within(row).getByText('SYN_STATUS_A')).toBeInTheDocument();
  });

  /*
   * 서버가 센 값을 그대로 낸다 — 0도 그대로 낸다. 0건은 정상이고 좋은 소식이다.
   *
   * **칸 자리로 견준다.** 글자로만 찾으면 잔여 수량 0과 후속 0이 같은 값이라 어느 칸을 잡았는지
   * 알 수 없고, 두 열이 뒤바뀌어도 감지기가 통과한다.
   */
  it('후속 건수를 응답 값 그대로 낸다', () => {
    renderTable({
      rows: [
        documentProgress({ successorCount: 0 }),
        documentProgress({
          documentId: 9002,
          documentNo: 'SYN-GR-2026-0002',
          successorCount: 2,
        }),
      ],
    });

    expect(cellTextsOf('SYN-GR-2026-0001')[SUCCESSOR_COUNT_CELL]).toBe('0');
    expect(cellTextsOf('SYN-GR-2026-0002')[SUCCESSOR_COUNT_CELL]).toBe('2');
  });

  it('수량 셋을 각각 낸다', () => {
    renderTable({
      rows: [documentProgress({ plannedQty: 1200, processedQty: 800, remainingQty: 400 })],
    });

    const cells = cellTextsOf('SYN-GR-2026-0001');

    expect(cells[PLANNED_QTY_CELL]).toBe('1200');
    expect(cells[PROCESSED_QTY_CELL]).toBe('800');
    expect(cells[REMAINING_QTY_CELL]).toBe('400');
  });

  /* 계약이 선택으로 둔 자리 — 빈 칸으로 두면 값이 없는 것인지 못 그린 것인지 구분되지 않는다. */
  it('세부구분이 없으면 값 없음 표식을 낸다', () => {
    renderTable({ rows: [documentProgress({ documentSubTypeCode: null })] });

    expect(
      within(screen.getByRole('row', { name: /SYN-GR-2026-0001/ })).getByText(t.values.empty),
    ).toBeInTheDocument();
  });
});

describe('ProgressTable — 취소 가능 열', () => {
  it('취소할 수 있으면 그렇게 적는다', () => {
    renderTable({ rows: [documentProgress({ cancellable: true })] });

    expect(screen.getByText(t.cancel.available)).toBeInTheDocument();
    expect(screen.queryByText(t.cancel.blocked)).not.toBeInTheDocument();
  });

  /* 「취소 불가」만 있으면 왜 안 되는지 알려고 결국 상세를 열어야 한다. */
  it('막혔으면 아는 코드의 사유 문면을 함께 낸다', () => {
    renderTable({
      rows: [documentProgress({ cancellable: false, cancelBlockedReasonCode: 'SUCCESSOR_EXISTS' })],
    });

    expect(screen.getByText(t.cancel.blocked)).toBeInTheDocument();
    expect(screen.getByText(t.blockReasons.SUCCESSOR_EXISTS)).toBeInTheDocument();
  });

  /* ⭐ 모르는 코드는 코드 문자열을 그대로 낸다 — 화면이 뜻을 지어내지 않는다. */
  it('계약에 없는 코드가 오면 그 코드 문자열이 그대로 보인다', () => {
    renderTable({
      rows: [
        documentProgress({
          cancellable: false,
          cancelBlockedReasonCode: 'SYN_UNKNOWN_BLOCK_REASON',
        }),
      ],
    });

    expect(screen.getByText('SYN_UNKNOWN_BLOCK_REASON')).toBeInTheDocument();
  });

  it('사유 코드가 없으면 받지 못했다고 적는다', () => {
    renderTable({
      rows: [documentProgress({ cancellable: false, cancelBlockedReasonCode: null })],
    });

    expect(screen.getByText(t.values.noBlockReason)).toBeInTheDocument();
  });
});

describe('readEmptyReason — 빈 표의 사유', () => {
  /*
   * 값 목록 미도착이 가장 앞이다. 그 상태에서 「조건에 맞는 문서가 없습니다」를 내면 사용자가
   * 조건을 넓히며 헤매는데, 실제로는 조회 자체가 시작되지 않은 것이다.
   */
  it('값 목록이 오지 않은 것을 가장 먼저 판정한다', () => {
    expect(
      readEmptyReason({ isTypeListPending: true, hasDocumentType: false, isBeyondLast: true }),
    ).toBe('typesPending');
  });

  it('유형을 고르지 않았으면 그 사실을 낸다', () => {
    expect(
      readEmptyReason({ isTypeListPending: false, hasDocumentType: false, isBeyondLast: false }),
    ).toBe('noDocumentType');
  });

  it('쪽 밖과 결과 없음을 가른다', () => {
    expect(
      readEmptyReason({ isTypeListPending: false, hasDocumentType: true, isBeyondLast: true }),
    ).toBe('beyondLast');
    expect(
      readEmptyReason({ isTypeListPending: false, hasDocumentType: true, isBeyondLast: false }),
    ).toBe('noResult');
  });
});

describe('ProgressTable — 빈 상태와 로딩', () => {
  it('불러오는 동안 표 대신 뼈대를 낸다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.list })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /* ⭐ 값 목록이 없어 조회가 시작되지 않은 상태를 「결과 없음」으로 보이면 안 된다. */
  it('값 목록이 오지 않았으면 준비 중 안내를 낸다', () => {
    renderTable({ rows: [], isTypeListPending: true, hasDocumentType: false });

    expect(screen.getByText(t.empty.typesPendingTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('유형을 고르기 전에는 고르라고 안내한다', () => {
    renderTable({ rows: [], hasDocumentType: false });

    expect(screen.getByText(t.empty.noDocumentTypeTitle)).toBeInTheDocument();
  });

  it('0건이면 빈 상태 문구를 내고 자료 행이 없다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
    /*
     * **자료 행이 없다는 것을 문서번호로 잰다.** 행 수만 세면 빈 상태를 담는 행이 함께 잡혀
     * 「행이 남았다」와 「자료가 남았다」를 가를 수 없다.
     */
    expect(screen.queryByText(/SYN-GR-2026-/)).not.toBeInTheDocument();
  });

  it('쪽 밖이면 첫 쪽으로 갈 수단을 함께 낸다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));
    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });
});

describe('ProgressTable — 행 식별자', () => {
  /*
   * **문서 번호 하나로는 행을 가릴 수 없다** — 같은 번호라도 유형이 다르면 다른 문서이고,
   * 계약의 상세 경로도 유형과 번호 둘을 열쇠로 쓴다.
   *
   * 미지정이면 인덱스가 React key가 되어 앞 줄이 사라질 때 뒤 줄의 DOM 노드가 대신 지워진다.
   * 그것을 재기 위해 **앞 줄을 지우고 뒤 줄의 노드가 같은 것인지** 본다.
   */
  it('앞 줄이 사라져도 뒤 줄의 노드가 그대로 남는다', () => {
    const first = documentProgress({ documentId: 9001, documentNo: 'SYN-GR-2026-0001' });
    const second = documentProgress({ documentId: 9002, documentNo: 'SYN-GR-2026-0002' });

    const { rerender } = render(<ProgressTable {...baseProps({ rows: [first, second] })} />);

    const before = screen.getByRole('row', { name: /SYN-GR-2026-0002/ });

    rerender(<ProgressTable {...baseProps({ rows: [second] })} />);

    expect(screen.getByRole('row', { name: /SYN-GR-2026-0002/ })).toBe(before);
  });

  /**
   * **번호만으로 키를 만들면 유형을 바꿀 때 남의 행을 재활용한다.**
   *
   * 목록은 유형 하나로 좁혀 오므로 한 응답 안에서는 번호가 겹치지 않는다 — 그래서 번호만
   * 써도 당장은 표가 멀쩡해 보인다. 그러나 **유형을 바꾸면** 다른 유형의 문서가 같은 번호를
   * 들고 올 수 있고, 그때 React는 두 문서를 같은 행으로 보아 앞 문서의 DOM 노드를 그대로
   * 쓴다(포커스·스크롤·읽어 주던 자리가 남의 행에 붙는다).
   *
   * 계약의 상세 경로도 유형과 번호 **둘**을 열쇠로 쓴다 — 키의 열쇠도 같아야 한다.
   */
  it('번호가 같아도 유형이 다르면 다른 행으로 본다', () => {
    const typeA = documentProgress({
      documentTypeCode: 'SYN_DOC_TYPE_A',
      documentId: 9001,
      documentNo: 'SYN-GR-2026-0001',
    });
    const typeB = documentProgress({
      documentTypeCode: 'SYN_DOC_TYPE_B',
      documentId: 9001,
      documentNo: 'SYN-IR-2026-0001',
    });

    const { rerender } = render(<ProgressTable {...baseProps({ rows: [typeA] })} />);

    const before = screen.getByRole('row', { name: /SYN-GR-2026-0001/ });

    rerender(<ProgressTable {...baseProps({ rows: [typeB] })} />);

    expect(screen.getByRole('row', { name: /SYN-IR-2026-0001/ })).not.toBe(before);
  });
});
