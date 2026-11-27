import { AlertBanner, Button, Chip, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { CrewSections } from './crew-sections';
import type { WorkOrderCrew } from './queries';
import type { WorkOrder } from './types';
import { FourMInputsPanel } from '../four-m-inputs/panel';
import { InfoCodeName, InfoFacts, InfoQty, type InfoFact } from '../../patterns/info-facts';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { splitCodeName } from '../../patterns/split-code-name';

import './detail-dialog.css';

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
  crew: { data: WorkOrderCrew | undefined; isLoading: boolean; isError: boolean };
  onClose: () => void;
}

const t = messages.workOrderProgress.detail;
const blank = messages.workOrderProgress.list.blank;

const dateTimeText = (value: string | undefined): string => {
  if (value === undefined || value === '') return blank;

  return formatPlantDateTime(value) ?? value;
};

/**
 * 비고 줄 — 비었거나 공백뿐이면 줄째 뺀다(라벨 · 「—」 · 여백 모두 · #360). 있으면 상자 마지막 줄에 상자 전체 폭으로,
 * 입력한 줄바꿈 그대로 · 길면 자연 줄바꿈(`.work-order-progress-remarks`).
 */
const remarksRow = (remarks: string | undefined): InfoFact[] =>
  remarks === undefined || remarks.trim() === ''
    ? []
    : [
        {
          label: t.remarks,
          value: <span className="work-order-progress-remarks">{remarks}</span>,
        },
      ];

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
 * ⛔ **닫는 단추는 하나다** — 정보 표시 팝업 시안(2026-11-27 · #360)대로 아래 단추 줄 [닫기] 하나만 두고
 * 제목 줄 X 는 끈다. 같은 이름의 컨트롤이 둘이면 화면 읽기 도구에서 어느 것을 부르는지 갈린다.
 */
export const DetailDialog = ({
  workOrder,
  isLoading,
  isError,
  isOpen,
  itemLabel,
  statusLabel,
  crew,
  onClose,
}: DetailDialogProps) => (
  <Dialog
    open={isOpen}
    onClose={onClose}
    title={workOrder === null ? t.title : `${t.title} — ${workOrder.workOrderNo}`}
    size="lg"
    className="work-order-progress-detail-dialog"
    showCloseButton={false}
    footer={
      <Button variant="outlined" onClick={onClose}>
        {t.close}
      </Button>
    }
  >
    {isLoading && <p role="status">{t.loading}</p>}

    {isError && (
      <div className="banner-slot">
        <AlertBanner variant="error">{t.loadError}</AlertBanner>
      </div>
    )}

    {workOrder !== null && (
      <>
        {/* 정보 표시 팝업 — 첫 줄 W/O · 품목 · 지시 수량(크게), 둘째 줄 상태 · 일시, 비고가 있으면 마지막 줄(시안 2026-11-27 · #360). */}
        <InfoFacts
          rows={[
            [
              { label: t.workOrderNo, value: workOrder.workOrderNo, isKey: true },
              {
                label: messages.workOrderProgress.list.columns.itemId,
                value: (
                  <InfoCodeName
                    code={splitCodeName(itemLabel(String(workOrder.itemId)), blank).code}
                    name={splitCodeName(itemLabel(String(workOrder.itemId)), blank).name}
                  />
                ),
                title: itemLabel(String(workOrder.itemId)),
                isKey: true,
              },
              { label: t.orderQty, value: <InfoQty value={workOrder.orderQty} />, isKey: true },
            ],
            [
              {
                label: t.statusCode,
                value: <Chip size="sm">{statusLabel(workOrder.statusCode)}</Chip>,
              },
              { label: t.plannedStartAt, value: dateTimeText(workOrder.plannedStartAt) },
              { label: t.plannedEndAt, value: dateTimeText(workOrder.plannedEndAt) },
              { label: t.completedAt, value: dateTimeText(workOrder.completedAt) },
              { label: t.closedAt, value: dateTimeText(workOrder.closedAt) },
            ],
            remarksRow(workOrder.remarks),
          ]}
        />

        <CrewSections crew={crew.data} isLoading={crew.isLoading} isError={crew.isError} />

        {/* 4M 변경 자재가 이 W/O 에 투입됐는지(omf-all-around#63 2단계) — 없으면 「내역 없음」 한 줄. */}
        <FourMInputsPanel workOrderId={workOrder.workOrderId} />
      </>
    )}
  </Dialog>
);
