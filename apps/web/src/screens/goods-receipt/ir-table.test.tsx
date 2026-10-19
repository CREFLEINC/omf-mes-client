import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inboundReceipt, inboundReceiptFixtures } from './fixtures';
import { buildIrColumns, IrTable, type IrTableProps } from './ir-table';
import type { ReferenceSource } from './lookups';
import type { IrView } from './types';

const t = messages.goodsReceipt;

/** 이 표의 최소 폭(공용 `.wide-table` 58rem). */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 200;

/** px 로 지정한 폭만 센다 — 비율(공급사 35%)은 표 폭에 따라 달라 합에 넣지 않는다. */
const toPx = (width: string | undefined): number =>
  width === undefined || !width.endsWith('px') ? 0 : Number.parseInt(width, 10);

const specifiedWidthOf = (columns: Column<IrView>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9101', label: 'SAMPLE-SUP-01 · 합성 공급사 가', isActive: true }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const columnsWith = (supplierLookup: ReferenceSource = source()): Column<IrView>[] =>
  buildIrColumns({ supplierLookup });

const renderTable = (overrides: Partial<IrTableProps> = {}) => {
  const onFirstPage = vi.fn<() => void>();
  const onOpen = vi.fn<(row: IrView) => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <IrTable
      rows={inboundReceiptFixtures}
      isLoading={false}
      isBeyondLast={false}
      supplierLookup={source()}
      onFirstPage={onFirstPage}
      onOpen={onOpen}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onFirstPage, onOpen, onRetryReferences, user: userEvent.setup() };
};

describe('buildIrColumns — 열 구성과 폭', () => {
  /* T-W-C 작업함 — 식별 번호, 상대, 일시, 문서 번호, 상태 칩, 이동 표시(›). [선택] 열이 없다(C-1). */
  it('열이 여섯이고 마지막이 이동 표시다', () => {
    expect(columnsWith().map((column) => column.key)).toEqual([
      'inboundReceiptNo',
      'supplier',
      'receiptDatetime',
      'deliveryNoteNo',
      'statusCode',
      'go',
    ]);
  });

  /*
   * 공급사만 비율 폭이다 — 폭을 비우면 넓은 화면에서 남는 폭이 전부 공급사로 몰려 큰 빈 칸이
   * 생기고, 비율 열이 둘이 되면 「코드 · 이름」이 받을 폭이 줄어든다. 나머지는 px 폭이다.
   */
  it('공급사만 비율 폭이고 나머지 열은 px 폭이다', () => {
    const columns = columnsWith();

    expect(columns.find((column) => column.key === 'supplier')?.width).toBe('35%');
    expect(
      columns
        .filter((column) => column.key !== 'supplier')
        .every((column) => column.width?.endsWith('px')),
    ).toBe(true);
  });

  /*
   * **흡수 열의 예산까지 세어야 뜻이 있다.** 지정 폭 합만 재면 그 합이 표 폭에 가까울 때
   * 흡수 열이 몇십 px밖에 못 받는 상태를 통과시킨다.
   */
  it('지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', () => {
    const specified = specifiedWidthOf(columnsWith());

    expect(specified).toBe(728);
    expect(specified + CODE_NAME_COLUMN_PX).toBeLessThanOrEqual(WIDE_TABLE_MIN_PX);
    expect(WIDE_TABLE_MIN_PX - specified).toBeGreaterThanOrEqual(CODE_NAME_COLUMN_PX);
  });
});

describe('IrTable — 대상 입하 전표 목록 표', () => {
  it('행마다 입하번호와 공급사 이름이 보인다', () => {
    renderTable();

    expect(screen.getByText('IR-2026-900001')).toBeInTheDocument();
    expect(screen.getAllByText('SAMPLE-SUP-01 · 합성 공급사 가').length).toBeGreaterThan(0);
  });

  /*
   * 입하일시는 **공장 시각(UTC+7)**으로 분까지 보인다(omf-all-around#20) — `+09:00` 09:12는
   * 공장 시각 07:12다. 보는 사람의 실행 환경 시간대와는 상관없다.
   */
  it('입하일시를 공장 시각으로 분까지 보인다', () => {
    renderTable({ rows: [inboundReceipt()] });

    expect(screen.getByText('2026-08-06 07:12')).toBeInTheDocument();
    /* 초·offset을 그대로 늘어놓지 않는다 — 폭 예산이 `YYYY-MM-DD HH:mm`에 맞춰져 있다. */
    expect(screen.queryByText('2026-08-06T09:12:00+09:00')).not.toBeInTheDocument();
  });

  it('거래명세서번호가 없으면 빈 값 표기를 낸다', () => {
    renderTable({ rows: [inboundReceipt({ deliveryNoteNo: null })] });

    expect(screen.getByText(t.values.empty)).toBeInTheDocument();
  });

  /*
   * **#44** — 이름을 못 풀어도 번호를 내지 않는다. 짝 방향으로 「이름 자리에 사유가 있다」를
   * 함께 단언해 아무것도 안 그려도 통과하지 않게 한다.
   */
  it('이름을 못 풀어도 내부 번호를 내지 않는다', () => {
    renderTable({
      rows: [inboundReceipt({ supplierId: 9199 })],
      supplierLookup: source({ entries: [] }),
    });

    expect(screen.getByText(t.values.unknown)).toBeInTheDocument();
    expect(screen.getByRole('table').textContent ?? '').not.toContain('9199');
  });

  /* **#47** — 아직 오지 않은 참조를 「알 수 없음」으로 내면 정상 값이 잘못된 값으로 읽힌다. */
  it('참조가 아직 오지 않았으면 알 수 없음으로 내지 않는다', () => {
    renderTable({ supplierLookup: source({ entries: [], isLoading: true }) });

    expect(screen.getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  /* C-1 — 행 전체를 누르면 그 전표를 연다. 행 안에 [선택] 버튼이 없다. */
  it('행을 누르면 그 전표를 열라고 알린다', async () => {
    const { onOpen, user } = renderTable();

    expect(within(screen.getByRole('table')).queryAllByRole('button')).toHaveLength(0);

    await user.click(screen.getByText('IR-2026-900001'));

    expect(onOpen).toHaveBeenCalledWith(inboundReceiptFixtures[0]);
  });

  /* C-1 이탈 조건 — 작업함은 선택 상태가 의미 없어 선택 표시 없이 이동만 한다. */
  it('행에 선택 표시를 달지 않고 접근 이름에 입하번호를 싣는다', () => {
    renderTable();

    const row = screen.getByRole('row', { name: t.actions.openRow('IR-2026-900001') });

    expect(row).not.toHaveAttribute('aria-selected');
  });

  /* 「결과가 없다」와 「이 쪽에는 없다」는 사용자가 할 조치가 다르다. */
  it('빈 상태가 두 갈래다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });

  it('결과가 없으면 결과 없음 안내를 낸다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('불러오는 중에는 골격을 낸다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.inboundReceipts })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /* 참조 실패에는 복구 경로를 그 이름이 보이는 구획에 함께 낸다. */
  it('공급사 참조가 실패하면 안내와 다시 시도를 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      supplierLookup: source({ entries: [], isError: true }),
    });

    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('참조가 정상이면 다시 시도를 내지 않는다', () => {
    renderTable();

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('상태 코드를 번역하지 않고 그대로 낸다', () => {
    renderTable({ rows: [inboundReceipt()] });

    expect(within(screen.getByRole('table')).getByText('SAMPLE_IR_STATUS_A')).toBeInTheDocument();
  });
});
