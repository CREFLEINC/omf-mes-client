import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AsnTable, type AsnTableProps } from './asn-table';
import { asn, asnFixtures } from './fixtures';
import type { ReferenceSource } from './lookups';

const t = messages.inboundSchedule;

/** 「오늘」은 화면이 인자로 준다 — 픽스처의 어제·오늘·내일도 같은 기준으로 만든다. */
const TODAY = new Date();
const ROWS = asnFixtures(TODAY);

const supplierSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '8101', label: '합성 공급사 가', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

const renderTable = (overrides: Partial<AsnTableProps> = {}) => {
  const onFirstPage = vi.fn<() => void>();
  const onToggleSelect = vi.fn<(asnId: number) => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <AsnTable
      rows={ROWS}
      isLoading={false}
      hasQuery
      isBeyondLast={false}
      today={TODAY}
      selectedId={null}
      supplierLookup={supplierSource()}
      onFirstPage={onFirstPage}
      onToggleSelect={onToggleSelect}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onFirstPage, onToggleSelect, onRetryReferences, user: userEvent.setup() };
};

/** 자료 행의 첫 칸(입하예정번호)만 뽑는다. 정렬 결과를 순서로 판정하는 유일한 근거다. */
const rowNumbers = (): string[] =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');

describe('AsnTable — 열 구성', () => {
  it('응답 건수만큼 행이 그려진다', () => {
    renderTable();

    // 머리글 행을 뺀 나머지가 자료 행이다.
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(ROWS.length + 1);
  });

  /*
   * **진행 열과 P/O 라인 열을 만들지 않는다**(계획 결정 5·6). 계약에 진행률·발주 수량 필드가
   * 하나도 없고, 발주 라인 경로를 조립할 `purchaseOrderId`도 없다. 지어낸 값을 그리는 것보다 없는 것이 낫다.
   */
  it('머리글이 여섯이고 진행·P/O 열이 없다', () => {
    renderTable();

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      t.table.asnNo,
      t.table.supplier,
      t.table.expectedArrivalDate,
      t.summary.deliveryNoteNo,
      t.table.status,
      t.table.select,
    ]);
  });

  it('입하예정번호와 거래명세서번호가 받은 그대로 나온다', () => {
    renderTable({ rows: [asn()] });

    expect(screen.getByText('SAMPLE-ASN-0001')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-DN-0001')).toBeInTheDocument();
  });

  /* 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
  it('거래명세서번호가 없으면 「—」가 나온다', () => {
    renderTable({ rows: [asn({ deliveryNoteNo: null })] });

    expect(screen.getByRole('table')).toHaveTextContent(t.values.empty);
  });
});

describe('AsnTable — 참조 값의 세 갈래', () => {
  it('목록에 있으면 이름으로 보인다', () => {
    renderTable({ rows: [asn()] });

    expect(screen.getByText('합성 공급사 가')).toBeInTheDocument();
  });

  /* #47 — 아직 오지 않은 것과 목록에 없는 것을 같은 문구로 뭉개면 뜻이 반대로 읽힌다. */
  it('아직 오지 않았으면 로딩 표기이고 「알 수 없음」이 아니다', () => {
    renderTable({
      rows: [asn()],
      supplierLookup: supplierSource({ entries: [], isLoading: true }),
    });

    expect(screen.getByRole('table')).toHaveTextContent(t.values.referenceLoading);
    expect(screen.getByRole('table')).not.toHaveTextContent(t.values.unknown);
  });

  it('목록에 있으나 그 값이 없으면 「알 수 없음」이다', () => {
    renderTable({ rows: [asn({ supplierId: 8102 })] });

    expect(screen.getByRole('table')).toHaveTextContent(t.values.unknown);
    expect(screen.getByRole('table')).not.toHaveTextContent(t.values.referenceLoading);
  });

  /* 실패를 삼키면 이름 칸이 이유 없이 비어 보이고, 사용자가 할 조치가 사라진다. */
  it('불러오기가 실패하면 사유를 밝히고 다시 시도할 수단을 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      rows: [asn()],
      supplierLookup: supplierSource({ entries: [], isError: true }),
    });

    expect(screen.getByRole('table')).toHaveTextContent(t.values.referenceFailed);
    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('실패하지 않았으면 다시 시도 수단을 내지 않는다', () => {
    renderTable({ rows: [asn()] });

    expect(screen.queryByText(t.reasons.referencesFailed)).not.toBeInTheDocument();
  });

  /*
   * **#44 — 내부 번호를 화면에 내지 않는다.** 이름으로 풀 수 없는 세 갈래(미도착·목록에 없음·실패)
   * 어디에서도 번호가 새면 안 된다. 사용자가 쓸 수 없는 값이 자료로 읽힌다.
   */
  it.each([
    ['이름이 있는 경우', supplierSource()],
    ['미도착', supplierSource({ entries: [], isLoading: true })],
    ['목록에 없음', supplierSource({ entries: [] })],
    ['실패', supplierSource({ entries: [], isError: true })],
  ])('%s에도 표에 내부 번호가 나오지 않는다', (_name, lookup) => {
    renderTable({ rows: ROWS, supplierLookup: lookup });

    const text = screen.getByRole('table').textContent ?? '';

    for (const id of ['7001', '7002', '7003', '8101', '8102', '8201', '8202']) {
      expect(text).not.toContain(id);
    }
  });
});

describe('AsnTable — 상태와 경과 표시', () => {
  /*
   * **값에 따라 배지 변형을 가르지 않는다.** 값 집합을 모르는 채 색을 가르면 뜻을 지어내는 것이다
   * (이슈 #20 §4). 코드 글자만 빼면 두 배지의 마크업이 완전히 같아야 한다.
   */
  it('상태 배지가 값과 무관하게 같은 모양이다', () => {
    renderTable({
      rows: [
        asn({ statusCode: 'SAMPLE_STATUS_A' }),
        asn({ asnId: 7002, statusCode: 'SAMPLE_STATUS_B' }),
      ],
    });

    /*
     * **배지의 뿌리를 본다.** 디자인 시스템 `Chip`은 변형 클래스를 뿌리 `<span>`에 붙이고
     * 글자는 그 안의 이름 없는 `<span>`에 넣는다 — 글자 요소만 비교하면 변형이 갈려도 같아 보인다.
     */
    const chipRoot = (code: string): HTMLElement => {
      const root = screen.getByText(code).parentElement;

      if (root === null) throw new Error(`상태 배지의 뿌리를 찾지 못했습니다: ${code}`);

      return root;
    };

    const first = chipRoot('SAMPLE_STATUS_A').outerHTML.replaceAll('SAMPLE_STATUS_A', 'X');
    const second = chipRoot('SAMPLE_STATUS_B').outerHTML.replaceAll('SAMPLE_STATUS_B', 'X');

    // 뿌리의 클래스가 곧 변형이다. 값에 따라 갈리면 이 두 문자열이 달라진다.
    expect(second).toBe(first);
    expect(chipRoot('SAMPLE_STATUS_A').className).toBe(chipRoot('SAMPLE_STATUS_B').className);
  });

  it('상태 코드를 번역하지 않고 그대로 낸다', () => {
    renderTable({ rows: [asn({ statusCode: 'SAMPLE_STATUS_A' })] });

    expect(screen.getByText('SAMPLE_STATUS_A')).toBeInTheDocument();
  });

  /* 확정된 처리는 당일 미포함이다(이슈 #20 §4). */
  it('어제 도착 예정이면 경과 표시가 붙고 오늘·내일에는 붙지 않는다', () => {
    renderTable();

    expect(screen.getAllByText(t.values.overdue)).toHaveLength(1);
  });

  it('전부 내일 예정이면 경과 표시가 하나도 없다', () => {
    renderTable({ rows: [asn({ expectedArrivalDate: '2999-12-31' })] });

    expect(screen.queryByText(t.values.overdue)).not.toBeInTheDocument();
  });
});

describe('AsnTable — 정렬', () => {
  it('기본 정렬이 도착 예정일 오름차순이다', () => {
    renderTable({ rows: [ROWS[2], ROWS[0], ROWS[1]].filter((row) => row !== undefined) });

    expect(rowNumbers()).toEqual(['SAMPLE-ASN-0001', 'SAMPLE-ASN-0002', 'SAMPLE-ASN-0003']);
    expect(
      screen.getByRole('columnheader', { name: new RegExp(t.table.expectedArrivalDate) }),
    ).toHaveAttribute('aria-sort', 'ascending');
  });

  /*
   * **정렬은 화면 안에서 일어난다.** 계약에 정렬 파라미터가 없어 서버로 보낼 수 없다.
   * 제어 정렬(`sort`)을 넘기면 디자인 시스템이 내부 재정렬을 쓰지 않으므로,
   * 머리글을 눌러 순서가 실제로 뒤집히는지가 「화면 안 정렬」의 증거다.
   */
  it('머리글을 누르면 화면 안에서 순서가 뒤집힌다', async () => {
    const { user } = renderTable();

    await user.click(screen.getByRole('button', { name: new RegExp(t.table.expectedArrivalDate) }));

    expect(rowNumbers()).toEqual(['SAMPLE-ASN-0003', 'SAMPLE-ASN-0002', 'SAMPLE-ASN-0001']);
  });

  /* 밝히지 않으면 사용자가 「전체가 정렬된 것」으로 읽는다 — 서버가 쪽을 나눠 준다. */
  it('정렬 범위가 현재 쪽이라는 안내가 보인다', () => {
    renderTable();

    expect(screen.getByText(t.notes.sortScope)).toBeInTheDocument();
  });
});

describe('AsnTable — 빈 상태와 로딩', () => {
  it('결과가 0건이면 빈 상태 안내가 보이고 자료 행이 없다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(rowNumbers()).toEqual([t.empty.noResultTitle + t.empty.noResultDescription]);
  });

  /* 「결과가 없다」와 안내가 갈려야 사용자가 할 조치(첫 쪽으로)가 드러난다. */
  it('쪽 밖이면 첫 쪽으로 가는 안내를 낸다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });

  it('불러오는 중에는 표 대신 진행 표기를 낸다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.asns })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('AsnTable — 건 고르기', () => {
  /* 「선택」이 행마다 되풀이되면 어느 건을 고르는 것인지 알 수 없다. */
  it('선택 버튼의 접근 이름에 입하예정번호가 들어간다', () => {
    renderTable({ rows: [asn()] });

    expect(
      screen.getByRole('button', { name: t.actions.selectRow('SAMPLE-ASN-0001') }),
    ).toBeInTheDocument();
  });

  it('선택을 누르면 그 건의 번호를 상위에 알린다', async () => {
    const { onToggleSelect, user } = renderTable({ rows: [asn()] });

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SAMPLE-ASN-0001') }));

    expect(onToggleSelect).toHaveBeenCalledWith(7001);
  });

  /* 고른 건은 해제할 수단이 그 자리에 있어야 한다 — 없으면 아래 표를 닫을 방법이 없다. */
  it('이미 고른 건의 버튼은 해제로 바뀐다', async () => {
    const { onToggleSelect, user } = renderTable({ rows: [asn()], selectedId: 7001 });

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('SAMPLE-ASN-0001') }),
    );

    expect(onToggleSelect).toHaveBeenCalledWith(7001);
  });
});
