import { AlertBanner, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { WorkOrder } from './types';

export interface DetailDialogProps {
  /** 고른 W/O. 고르지 않았으면 `null` — 창이 열리지 않는다. */
  workOrder: WorkOrder | null;
  isLoading: boolean;
  isError: boolean;
  /** 고른 것이 있는가. 받는 중에도 창은 열려 있어야 한다. */
  isOpen: boolean;
  itemLabel: (itemIdText: string) => string;
  /** 표의 상태 열과 같은 표시명 — 상세만 코드 원문을 찍지 않는다. */
  statusLabel: (statusCode: string) => string;
  onClose: () => void;
}

const t = messages.workOrderProgress.detail;
const blank = messages.workOrderProgress.list.blank;

const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/i;

const dateTimeText = (value: string | undefined): string => {
  if (value === undefined || value === '') return blank;

  const match = DATE_TIME_PATTERN.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

const textOr = (value: string | undefined): string =>
  value === undefined || value === '' ? blank : value;

/**
 * 고른 W/O 의 상세.
 *
 * ⚠ **가운데 창으로 시작한다.** 스펙은 가장자리 서랍(드로어)을 그렸지만 DS 에 가장자리 배치가
 * 없다(design-system-v2-webui#71) — 이슈의 미결 지시대로 **만들지 않고** 가운데 창을 쓴다.
 *
 * ⚠ **실적 이력·생산LOT·세션은 아직 없다.** 그것들을 받으려면 W/O 하나마다 조회를 여러 번 더
 * 내야 한다. 지금은 **받은 것만** 보이고, 없다는 사실을 창 안에 적는다(A-11) — 적지 않으면
 * 「이 W/O 는 실적이 없구나」로 읽힌다.
 *
 * ⛔ **받는 중에도 창은 열려 있다.** 눌렀는데 아무 일도 없다가 나중에 열리면 두 번 누르게 된다.
 *
 * ⛔ **닫기 버튼을 따로 두지 않는다** — 창이 이미 X 를 그린다. 같은 이름의 컨트롤이 둘이면
 * 화면 읽기 도구에서 어느 것을 부르는지 갈리고, 눈으로도 같은 일을 하는 버튼이 둘 있는
 * 셈이다. 닫는 길은 X · Escape · 바깥 누르기 셋으로 이미 넉넉하다.
 */
export const DetailDialog = ({
  workOrder,
  isLoading,
  isError,
  isOpen,
  itemLabel,
  statusLabel,
  onClose,
}: DetailDialogProps) => (
  <Dialog
    open={isOpen}
    onClose={onClose}
    title={workOrder === null ? t.title : `${t.title} — ${workOrder.workOrderNo}`}
  >
    {isLoading && <p role="status">{t.loading}</p>}

    {isError && (
      <div className="banner-slot">
        <AlertBanner variant="error">{t.loadError}</AlertBanner>
      </div>
    )}

    {workOrder !== null && (
      <>
        <dl className="filter-bar">
          {(
            [
              [t.workOrderNo, workOrder.workOrderNo],
              [t.statusCode, statusLabel(workOrder.statusCode)],
              [messages.workOrderProgress.list.columns.itemId, itemLabel(String(workOrder.itemId))],
              [t.orderQty, String(workOrder.orderQty)],
              [t.plannedStartAt, dateTimeText(workOrder.plannedStartAt)],
              [t.plannedEndAt, dateTimeText(workOrder.plannedEndAt)],
              [t.completedAt, dateTimeText(workOrder.completedAt)],
              [t.closedAt, dateTimeText(workOrder.closedAt)],
              [t.remarks, textOr(workOrder.remarks)],
            ] as const
          ).map(([label, value]) => (
            <div className="field-cell" key={label}>
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {/* ⛔ 없다는 사실을 적지 않으면 「이 W/O 는 실적이 없구나」로 읽힌다. */}
        <div className="banner-slot">
          <AlertBanner variant="info">{t.historyUnavailable}</AlertBanner>
        </div>
      </>
    )}
  </Dialog>
);
