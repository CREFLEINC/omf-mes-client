import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AsnLineTable, type AsnLineTableProps } from './asn-line-table';
import { asn, asnLine, asnLineFixtures } from './fixtures';
import type { ReferenceSource } from './lookups';

const t = messages.inboundSchedule;

const TODAY = new Date(2026, 7, 10);

const itemSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '8301', label: '합성 품목 가', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

const uomSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '8501', label: '합성 단위 개', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

const renderTable = (overrides: Partial<AsnLineTableProps> = {}) => {
  const onRetryReferences = vi.fn<() => void>();

  render(
    <AsnLineTable
      asn={asn({ expectedArrivalDate: '2026-08-09' })}
      supplierName="합성 공급사 가"
      plantName="합성 공장 가"
      today={TODAY}
      rows={asnLineFixtures}
      isLoading={false}
      itemLookup={itemSource()}
      uomLookup={uomSource()}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onRetryReferences, user: userEvent.setup() };
};

describe('AsnLineTable — 제목줄', () => {
  /* 아래 표만 있으면 어느 건의 라인인지 알 수 없다. 위 표의 행에 이미 있는 값을 그대로 옮긴다. */
  it('고른 건의 입하예정번호·공급사·공장·도착 예정일이 보인다', () => {
    renderTable();

    const summary = screen.getByRole('group', { name: t.summary.label });

    expect(within(summary).getByText('SAMPLE-ASN-0001')).toBeInTheDocument();
    expect(within(summary).getByText('합성 공급사 가')).toBeInTheDocument();
    expect(within(summary).getByText('합성 공장 가')).toBeInTheDocument();
    expect(within(summary).getByText('2026-08-09')).toBeInTheDocument();
  });

  /* 위 표에 두지 않은 값이 여기서 보인다 — 두 자리 어디에도 없으면 받은 자료가 사라진다. */
  it('거래명세서번호와 비고가 보이고, 없으면 「—」다', () => {
    renderTable({ asn: asn({ deliveryNoteNo: null, remarks: null }) });

    const summary = screen.getByRole('group', { name: t.summary.label });

    expect(within(summary).getAllByText(t.values.empty)).toHaveLength(2);
  });

  it('도착 예정일이 지났으면 제목줄에도 경과 표시가 붙는다', () => {
    renderTable();

    expect(screen.getByText(t.values.overdue)).toBeInTheDocument();
  });

  it('도착 예정일이 오늘이면 경과 표시가 붙지 않는다 — 당일 미포함', () => {
    renderTable({ asn: asn({ expectedArrivalDate: '2026-08-10' }) });

    expect(screen.queryByText(t.values.overdue)).not.toBeInTheDocument();
  });
});

describe('AsnLineTable — 열 구성', () => {
  /*
   * **진행 열과 P/O 라인 열을 만들지 않는다**(계획 결정 5·6).
   * 「P/O 라인: —」은 사실상 무발주 표식이고, 이슈 #20 §4가 그 표식을 두지 않기로 정했다.
   */
  it('머리글이 다섯이고 진행·P/O 열이 없다', () => {
    renderTable();

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      t.lineTable.lineNo,
      t.lineTable.item,
      t.lineTable.expectedQty,
      t.lineTable.uom,
      t.lineTable.supplierLotNo,
    ]);
  });

  it('줄번호와 예정수량이 받은 그대로 나온다', () => {
    renderTable({ rows: [asnLine()] });

    expect(screen.getByRole('table')).toHaveTextContent('1');
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('예정수량 0을 빈 칸으로 만들지 않는다', () => {
    renderTable({ rows: [asnLine({ expectedQty: 0 })] });

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  /*
   * **무발주 줄을 목록에서 빼지 않는다**(이슈 #20 §4 「P/O 연결이 빈 행은 그대로 보인다」).
   * 거르면 사용자가 받을 물건 일부를 못 본다.
   */
  it('발주 라인이 없는 줄도 표에 남는다', () => {
    renderTable();

    // 머리글 행을 뺀 나머지가 자료 행이다.
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(
      asnLineFixtures.length + 1,
    );
  });

  it('공급사 LOT가 없으면 「—」가 나온다', () => {
    renderTable({ rows: [asnLine({ supplierLotNo: null })] });

    expect(screen.getByRole('table')).toHaveTextContent(t.values.empty);
  });
});

describe('AsnLineTable — 참조 값의 세 갈래', () => {
  it('품목·단위가 이름으로 보인다', () => {
    renderTable({ rows: [asnLine()] });

    expect(screen.getByText('합성 품목 가')).toBeInTheDocument();
    expect(screen.getByText('합성 단위 개')).toBeInTheDocument();
  });

  it('아직 오지 않았으면 로딩 표기이고 「알 수 없음」이 아니다', () => {
    renderTable({
      rows: [asnLine()],
      itemLookup: itemSource({ entries: [], isLoading: true }),
      uomLookup: uomSource({ entries: [], isLoading: true }),
    });

    expect(screen.getByRole('table')).toHaveTextContent(t.values.referenceLoading);
    expect(screen.getByRole('table')).not.toHaveTextContent(t.values.unknown);
  });

  it('목록에 없는 번호는 「알 수 없음」이다', () => {
    renderTable({ rows: [asnLine({ itemId: 8302 })] });

    expect(screen.getByRole('table')).toHaveTextContent(t.values.unknown);
  });

  it('불러오기가 실패하면 사유를 밝히고 다시 시도할 수단을 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      itemLookup: itemSource({ entries: [], isError: true }),
    });

    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  /* #44 — 이름으로 풀 수 없는 어느 갈래에서도 내부 번호가 새면 안 된다. */
  it.each([
    ['이름이 있는 경우', itemSource(), uomSource()],
    [
      '미도착',
      itemSource({ entries: [], isLoading: true }),
      uomSource({ entries: [], isLoading: true }),
    ],
    ['목록에 없음', itemSource({ entries: [] }), uomSource({ entries: [] })],
    ['실패', itemSource({ entries: [], isError: true }), uomSource({ entries: [], isError: true })],
  ])('%s에도 표에 내부 번호가 나오지 않는다', (_name, itemLookup, uomLookup) => {
    renderTable({ itemLookup, uomLookup });

    const text = screen.getByRole('table').textContent ?? '';

    for (const id of ['7301', '7302', '8301', '8302', '8401', '8501', '7001']) {
      expect(text).not.toContain(id);
    }
  });
});

describe('AsnLineTable — 빈 상태와 로딩', () => {
  it('라인이 0건이면 빈 상태 안내가 보인다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 진행 표기를 낸다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.lines })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /* 라인을 기다리는 동안에도 어느 건을 고른 것인지는 보여야 한다. */
  it('불러오는 중에도 제목줄은 남는다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('group', { name: t.summary.label })).toBeInTheDocument();
  });
});
