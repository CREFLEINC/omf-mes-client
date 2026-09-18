import { Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
 * ⛔ **판정을 표시명으로 옮기지 않는다.** 옮기려면 공통코드 조회가 하나 더 필요한데, 그
 * 조회가 실패하면 이력이 통째로 비어 보인다. 이 표가 하는 일은 「앞에 무엇이 있었나」를
 * 남기는 것이라 코드 그대로가 오히려 정확하다 — 값이 사라진 코드도 그대로 남는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.history;

/** 수량 칸에는 단위 코드를 붙인다(모르면 숫자만). */
const columnsOf = (uomCode: string | null): Column<InspectionResultRound>[] => [
  {
    key: 'inspectionRound',
    header: t.columns.round,
    width: '64px',
    render: (row) => String(row.inspectionRound),
  },
  {
    key: 'overallJudgmentCode',
    header: t.columns.judgment,
    render: (row) => row.overallJudgmentCode,
  },
  {
    key: 'acceptedQty',
    header: t.columns.accepted,
    render: (row) => withUom(String(row.acceptedQty), uomCode),
  },
  {
    key: 'rejectedQty',
    header: t.columns.rejected,
    render: (row) => withUom(String(row.rejectedQty), uomCode),
  },
  {
    key: 'heldQty',
    header: t.columns.held,
    render: (row) => withUom(String(row.heldQty), uomCode),
  },
  {
    key: 'confirmedAt',
    header: t.columns.confirmedAt,
    width: '124px',
    /* 확정되지 않은 채 넘어간 회차도 이력에 남는다 — 빈칸으로 두지 않는다. */
    render: (row) => (row.confirmedAt === null ? t.notConfirmed : formatDateTime(row.confirmedAt)),
  },
];

export interface RoundHistoryProps {
  rounds: InspectionResultRound[];
  /** 수량 옆에 붙일 단위 코드. 모르면 `null` */
  uomCode: string | null;
}

export const RoundHistory = ({ rounds, uomCode }: RoundHistoryProps) => {
  if (rounds.length === 0) return null;

  return (
    <section className="iqc-inspection-section">
      <h3>{t.heading}</h3>
      <Table
        /* 구획 제목(「이전 회차」)이 이미 보인다 — 표 제목은 접근 이름으로만 남긴다. */
        caption={<span className="iqc-inspection-table-caption">{t.caption}</span>}
        density="compact"
        columns={columnsOf(uomCode)}
        rows={rounds}
        getRowId={(row) => String(row.inspectionResultId)}
      />
    </section>
  );
};
