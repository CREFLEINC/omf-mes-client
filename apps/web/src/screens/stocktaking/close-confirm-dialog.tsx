import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { CountSummaryView } from './types';

const t = messages.stocktaking;

/**
 * 창 본문에 그대로 나열할 것.
 *
 * **이름이 아니라 값이 온다.** 참조 풀이(창고)는 화면이 이미 끝냈고 이 창은 받은 것을 그리기만
 * 한다 — 여기서 다시 풀면 **확인한 것과 마감하는 것이 갈린다.**
 *
 * **번호를 담지 않는다**(#44). 창고는 「코드 · 이름」이나 풀지 못한 사정 문구로 오며, 실사는
 * **업무 번호**(`inventoryCountNo`)로 온다 — 이 타입에 내부 번호 자리가 없어 샐 경로도 없다.
 */
export interface CloseSummary {
  countNo: string;
  warehouseName: string;
  plannedDate: string;
  /** 마감 시점의 진행 요약. **서버가 계산해 상세 응답에 함께 준 값**이다. */
  summary: CountSummaryView;
}

export interface CloseConfirmDialogProps {
  summary: CloseSummary;
  onConfirm: () => void;
  onClose: () => void;
}

interface SummaryRow {
  key: string;
  label: string;
  value: string;
}

/**
 * 나열 차례가 **아래 구획의 제목줄·요약 4칸과 같다.** 사용자는 거기서 보던 것을 여기서 다시
 * 읽으므로 차례가 갈리면 눈으로 맞춰 볼 수 없다.
 */
const toRows = (summary: CloseSummary): SummaryRow[] => [
  { key: 'countNo', label: t.detail.inventoryCountNo, value: summary.countNo },
  { key: 'warehouse', label: t.detail.warehouse, value: summary.warehouseName },
  { key: 'plannedDate', label: t.detail.plannedDate, value: summary.plannedDate },
  {
    key: 'plannedCount',
    label: t.detail.planned,
    value: t.detail.countValue(summary.summary.plannedCount),
  },
  {
    key: 'countedCount',
    label: t.detail.counted,
    value: t.detail.countValue(summary.summary.countedCount),
  },
  {
    key: 'uncountedCount',
    label: t.detail.uncounted,
    value: t.detail.countValue(summary.summary.uncountedCount),
  },
  {
    key: 'varianceCount',
    label: t.detail.variance,
    value: t.detail.countValue(summary.summary.varianceCount),
  },
];

/**
 * 마감 확인 — **이 화면에서 가장 비싼 조작 앞의 마지막 층이다.**
 *
 * 마감한 실사를 다시 여는 오퍼레이션이 계약에 없다(실측 — 이 자원의 경로는 넷뿐이며 어느
 * 것도 마감을 물리지 않는다). 개시는 잘못 만들어도 쓸모없는 전표가 하나 남을 뿐이지만,
 * 마감은 **진행 중인 실사를 되돌릴 수 없이 끝낸다.**
 *
 * **보이는 것이 개시 창과 다르다.** 개시 창은 **보낼 값 넷**을 다시 보이는데, 마감이 보내는
 * 값은 영업일 하나이고 그것마저 화면이 파생한다(`close-request.ts`) — 확인시킬 「값」이 없다.
 * 그래서 이 창은 **무엇을 마감하는가**(실사번호·창고·계획일)와 **지금 어디까지 됐는가**
 * (요약 4칸)를 보인다. 요약을 다시 보이는 것이 특히 값을 한다: 마감 버튼은 두 건수가 0일 때만
 * 열리므로, 창에 선 0이 **버튼이 열린 이유를 그 자리에서 설명한다.**
 *
 * **창 안에 선택칸을 두지 않는다**(#45 · DS `design-system-v2-webui#68`). 이 창은 값을 고치는
 * 자리가 아니라 확인하는 자리다.
 *
 * **스크림 클릭으로 닫히는 것을 막는다**(`closeOnBackdropClick={false}`) — 개시 확인 창과 같은
 * 편이고 파기 확인 창과 갈리는 자리다. 되돌릴 수 없는 조작을 확인하는 창이 스치는 클릭에
 * 사라지면 확인 자체가 형식이 된다.
 *
 * **상태 칩을 쓰지 않는다.** 설치본의 `StatusChipProps`에 `disabled`가 없어(실측) 비활성
 * 표현이 어긋나는 갭이 있다 — 이 슬라이스는 걸릴 자리를 만들지 않고 평문으로 낸다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const CloseConfirmDialog = ({ summary, onConfirm, onClose }: CloseConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    title={t.dialog.closeTitle}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" onClick={onClose}>
          {t.actions.keepCounting}
        </Button>
        <Button onClick={onConfirm}>{t.actions.confirmClose}</Button>
      </>
    }
  >
    <p>{t.dialog.closeLead}</p>

    <dl className="filter-bar">
      {toRows(summary).map((row) => (
        <div className="field-cell" key={row.key}>
          <dt className="field-label">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>

    <p>{t.dialog.closeIrreversible}</p>
  </Dialog>
);
