import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useClientPage } from '../../patterns/client-page';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav } from '../../patterns/page-nav';

import type { CodeOption } from './code-options';
import { formatDateTime, type InspectionResultRound } from './types';
import { withUom } from './uom-lookup';

/**
 * 이전 회차 — **읽기 전용 표.**
 *
 * ⛔ **정정하는 자리가 아니다.** 재검사는 앞 회차를 고치는 것이 아니라 새 회차를 쌓고
 * `previousResultId` 로 사슬을 잇는다(스펙 §5-3). 그래서 이 표에는 누를 것이 없다 —
 * 편집으로 읽힐 여지를 만들지 않는다.
 *
 * ⭐ **회차가 하나뿐이면 아무것도 그리지 않는다.** 「이전 회차 없음」을 내면 재검사가 없는
 * 대다수 의뢰에서 화면이 없는 것을 설명하느라 길어진다 — 이력은 쌓였을 때만 볼 것이다.
 *
 * 판정은 화면이 이미 부른 종합 판정 선택지의 표시명으로 보인다(새 조회를 얹지 않는다). 선택지에
 * 없거나 아직 못 불렀으면 **코드 그대로** 남긴다 — 이력이 비어 보이지 않고, 값이 사라진 코드도 남는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.history;

const JUDGMENT_TONE: Record<string, 'success' | 'error' | 'warning'> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
};

/** 수량 칸에는 단위 코드를 붙인다(모르면 숫자만). */
const columnsOf = (
  uomCode: string | null,
  judgmentOptions: readonly CodeOption[],
): Column<InspectionResultRound>[] => [
  {
    key: 'inspectionRound',
    align: 'center',
    /* 오름 · 내림차순(사용자 지시 2026-10-27 · #185). */
    sortable: true,
    header: t.columns.round,
    width: '64px',
    render: (row) => String(row.inspectionRound),
  },
  {
    key: 'overallJudgmentCode',
    align: 'center',
    header: t.columns.judgment,
    width: '96px',
    /* 상태 칩(합격 초록 · 불합격 빨강 · 보류 노랑) — 검사 이력 표와 같은 모양(사용자 지시 2026-10-27 · #185). */
    render: (row) => (
      <Chip variant="status" size="sm" status={JUDGMENT_TONE[row.overallJudgmentCode] ?? 'idle'}>
        {judgmentOptions.find((option) => option.value === row.overallJudgmentCode)?.label ??
          row.overallJudgmentCode}
      </Chip>
    ),
  },
  {
    key: 'acceptedQty',
    align: 'center',
    header: t.columns.accepted,
    width: '110px',
    render: (row) => withUom(String(row.acceptedQty), uomCode),
  },
  {
    key: 'rejectedQty',
    align: 'center',
    header: t.columns.rejected,
    width: '110px',
    render: (row) => withUom(String(row.rejectedQty), uomCode),
  },
  {
    key: 'heldQty',
    align: 'center',
    header: t.columns.held,
    width: '110px',
    render: (row) => withUom(String(row.heldQty), uomCode),
  },
  {
    key: 'confirmedAt',
    align: 'center',
    header: t.columns.confirmedAt,
    width: '150px',
    /* 확정되지 않은 채 넘어간 회차도 이력에 남는다 — 빈칸으로 두지 않는다. */
    render: (row) => (row.confirmedAt === null ? t.notConfirmed : formatDateTime(row.confirmedAt)),
  },
];

export interface RoundHistoryProps {
  rounds: InspectionResultRound[];
  /** 수량 옆에 붙일 단위 코드. 모르면 `null` */
  uomCode: string | null;
  /** 종합 판정 선택지 — 코드를 표시명으로 옮길 때만 쓴다. 비어 있으면 코드 그대로다 */
  judgmentOptions?: readonly CodeOption[];
  /** 넘칠 때 줄이지 않고 표 안에서 가로로 구른다(좌우 배치 · 사용자 지시 2026-10-27 · #185). */
  scrollX?: boolean;
}

export const RoundHistory = ({
  rounds,
  uomCode,
  judgmentOptions = [],
  scrollX = false,
}: RoundHistoryProps) => {
  /* 다른 탭 표처럼 열 순서 끌기 · 폭 조절(브라우저에 기억) · 상자 폭 맞춤(사용자 지시 2026-10-27 · #185). */
  const ordered = useColumnOrder(
    'omf-mes:iqc-inspection:columns:rounds:order',
    columnsOf(uomCode, judgmentOptions),
  );
  const resizable = useColumnWidths('omf-mes:iqc-inspection:columns:rounds', ordered, {
    fitContent: scrollX,
  });
  const fit = useFitColumns(resizable.columns, { scrollX });
  /* 10 · 20 · 50건씩 쪽으로 나눈다(사용자 지시 2026-10-27 · #185). */
  const paging = useClientPage(rounds, { inspectionRound: (row) => row.inspectionRound });
  if (rounds.length === 0) return null;

  return (
    <section className="iqc-inspection-section">
      <h3>{t.heading}</h3>
      <div
        ref={fit.ref}
        className="iqc-inspection-table-box inspection-queue-table"
        style={resizable.style}
      >
        <Table
          /* 구획 제목(「이전 회차」)이 이미 보인다 — 표 제목은 접근 이름으로만 남긴다. */
          caption={<span className="iqc-inspection-table-caption">{t.caption}</span>}
          density="compact"
          columns={fit.columns}
          rows={paging.rows}
          sort={paging.sort}
          onSortChange={paging.onSortChange}
          getRowId={(row) => String(row.inspectionResultId)}
        />
      </div>
      {paging.nav !== null && <PageNav {...paging.nav} />}
    </section>
  );
};
