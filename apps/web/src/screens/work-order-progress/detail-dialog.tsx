import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { CrewSections } from './crew-sections';
import { servedDelay } from './delay';
import type { WorkOrderCrew } from './queries';
import { RateCell } from './rate-cell';
import { DelayChip, StatusChip } from './status-chips';
import type { WorkOrder, WorkOrderProgressFact } from './types';
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

const RATE_FORMAT = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 });

/** 값이 있을 때만 여는 수량 칸 — 목록의 보류 · 스크랩 · 재작업 열과 같은 규칙이다. */
const extraQty = (label: string, value: number | undefined): InfoFact[] =>
  value === undefined || value === 0
    ? []
    : [{ label, value: <InfoQty value={value} />, isKey: true }];

/**
 * 실적 줄 — 양품 · 불량 · 달성률(값이 있으면 보류 · 스크랩 · 재작업도). 실적 누계를 받지 못했으면 줄째 뺀다.
 *
 * ⛔ 달성률은 서버가 준 값이다 — 양품을 지시 수량으로 다시 나누지 않는다(L-2).
 */
const progressRow = (progress: WorkOrderProgressFact | undefined): InfoFact[] =>
  progress === undefined
    ? []
    : [
        { label: t.goodQty, value: <InfoQty value={progress.goodQty} />, isKey: true },
        ...(progress.defectQty === undefined
          ? []
          : [{ label: t.defectQty, value: <InfoQty value={progress.defectQty} />, isKey: true }]),
        ...extraQty(t.holdQty, progress.holdQty),
        ...extraQty(t.scrapQty, progress.scrapQty),
        ...extraQty(t.reworkQty, progress.reworkQty),
        {
          label: t.achievementRate,
          value: (
            <RateCell
              label={t.achievementRate}
              percent={Math.min(100, Math.max(0, progress.achievementRate * 100))}
              text={RATE_FORMAT.format(progress.achievementRate)}
            />
          ),
          isKey: true,
        },
      ];

/** 이름이 실려 왔을 때만 여는 칸(공정 · P/O). */
const nameFact = (label: string, value: string | undefined): InfoFact[] =>
  value === undefined || value.trim() === '' ? [] : [{ label, value }];

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
 * 실적 누계(양품 · 불량 · 달성률)는 상세 응답에 함께 실려 온다 — 목록의 그 줄과 같은 값이다.
 * 작업 세션 · 작업자별 실적 · 불량 유형은 따로 받아 아래에 잇는다.
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
        {/* 정보 표시 팝업 — 첫 줄 W/O · 품목 · 지시 수량(크게), 둘째 줄 실적, 셋째 줄 상태 · 공정 · P/O, 넷째 줄 일시, 비고가 있으면 마지막 줄. */}
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
            progressRow(workOrder.progress),
            [
              {
                label: t.statusCode,
                /* 지연 · 판정 불가는 상태 칩 옆에 칩으로 — 「지연」 이름 아래 「지연」 값을 되풀이하지 않는다. */
                value: (
                  <>
                    <StatusChip
                      label={statusLabel(workOrder.statusCode)}
                      statusCode={workOrder.statusCode}
                    />
                    <DelayChip delay={servedDelay(workOrder) ?? 'onTime'} />
                  </>
                ),
              },
              ...nameFact(t.process, workOrder.processName ?? workOrder.routingOperationName),
              ...nameFact(t.productionOrder, workOrder.productionOrderNo),
            ],
            [
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
