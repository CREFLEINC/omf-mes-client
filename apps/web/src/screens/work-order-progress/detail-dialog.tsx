import { AlertBanner, Button, Dialog, Icon } from '@crefle/web-ui';
import type { ReactNode } from 'react';
import { messages } from '@omf-mes/i18n';

import { CrewSections } from './crew-sections';
import { servedDelay } from './delay';
import { DetailHero } from './detail-hero';
import type { WorkOrderCrew } from './queries';
import type { WorkOrder } from './types';
import { FourMInputsPanel, useFourMInputs } from '../four-m-inputs/panel';
import { InfoEmpty } from '../../patterns/info-facts';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { splitCodeName } from '../../patterns/split-code-name';

import './detail-dialog.css';

interface CrewState {
  data: WorkOrderCrew | undefined;
  isLoading: boolean;
  isError: boolean;
}

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
  /** 표의 라인 열과 같은 이름표(「코드 · 이름」). */
  lineLabel: (lineIdText: string) => string;
  crew: CrewState;
  /** 목록에서 이 줄 바로 앞 · 뒤의 W/O 로 넘긴다. 앞 · 뒤가 없으면(쪽의 끝 · 목록에 없는 건) `null` — 단추가 꺼진다. */
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}

const t = messages.workOrderProgress.detail;
const blank = messages.workOrderProgress.list.blank;

const dateTimeText = (value: string | undefined): string => {
  if (value === undefined || value === '') return blank;

  return formatPlantDateTime(value) ?? value;
};

/** 라인 — 표의 라인 열과 같이 이름만 적는다. 정해지지 않은 지시는 「—」다. */
const lineText = (
  lineId: number | undefined,
  lineLabel: (lineIdText: string) => string,
): string => {
  if (lineId === undefined) return blank;

  const { code, name } = splitCodeName(lineLabel(String(lineId)), '');
  return name === '' ? code : name;
};

const markAutofocus = (element: HTMLButtonElement | null): void => {
  element?.setAttribute('autofocus', '');
};

const textOrBlank = (value: string | null | undefined): string =>
  value === undefined || value === null || value.trim() === '' ? blank : value;

interface SpecItem {
  label: string;
  /** 「—」면 회색으로 적는다. */
  value: ReactNode;
  /** 말줄임될 때 마우스를 올리면 보일 전체 글. */
  title?: string;
}

const SpecRow = ({ item, className }: { item: SpecItem; className?: string }) => (
  <div
    className={
      className === undefined
        ? 'work-order-progress-spec-item'
        : `work-order-progress-spec-item ${className}`
    }
  >
    <dt>{item.label}</dt>
    <dd title={item.title ?? (typeof item.value === 'string' ? item.value : undefined)}>
      {item.value === blank ? <InfoEmpty /> : item.value}
    </dd>
  </div>
);

/**
 * 계획 기간 — 「시작 ~ 종료」 한 줄. 지연이면 종료만 빨갛게 적는다(표의 계획 종료 칸과 같다 — 무엇이 지났는지가 이 값이다).
 * 둘 다 없으면 「—」 하나다.
 */
const plannedPeriod = (workOrder: WorkOrder): ReactNode => {
  if (workOrder.plannedStartAt === undefined && workOrder.plannedEndAt === undefined) return blank;

  const endAt = dateTimeText(workOrder.plannedEndAt);
  const isLate = servedDelay(workOrder) === 'delayed' && workOrder.plannedEndAt !== undefined;

  return (
    <>
      {t.period(dateTimeText(workOrder.plannedStartAt), '')}
      {isLate ? <span className="work-order-progress-late">{endAt}</span> : endAt}
    </>
  );
};

/**
 * 기본 정보 — 이름(왼쪽) · 값(오른쪽) 줄 목록, 두 단(사용자 지시 2026-11-28 「이 부분 UI Design 수정해」).
 *
 * 맨 위 진행 상자와 같은 회색 상자를 하나 더 세우지 않는다 — 상자는 「지금 어떤가」 하나에만 쓰고, 여기는 바탕 위에
 * 가는 줄로만 가른다. 왼쪽 단은 **무엇을 언제**(품목 · P/O · 계획 기간), 오른쪽 단은 **어디서**(공정 · 라인 · 설비)다.
 * 값이 없어도 줄은 두고 「—」로 적는다 — 줄이 빠지면 두 단의 높이가 어긋난다. 비고는 있을 때만 아래에 줄 전체로 적는다.
 */
const DetailSpec = ({
  workOrder,
  itemLabel,
  lineLabel,
}: {
  workOrder: WorkOrder;
  itemLabel: (itemIdText: string) => string;
  lineLabel: (lineIdText: string) => string;
}) => {
  const item = splitCodeName(itemLabel(String(workOrder.itemId)), blank);
  const what: SpecItem[] = [
    {
      label: messages.workOrderProgress.list.columns.itemId,
      value: (
        <>
          <strong className="work-order-progress-spec-code">{item.code}</strong>
          {item.name !== '' && item.name !== blank && (
            <span className="work-order-progress-spec-sub">{item.name}</span>
          )}
        </>
      ),
      title: itemLabel(String(workOrder.itemId)),
    },
    { label: t.productionOrder, value: textOrBlank(workOrder.productionOrderNo) },
    { label: t.plannedPeriod, value: plannedPeriod(workOrder) },
  ];
  const where: SpecItem[] = [
    {
      label: t.process,
      value: textOrBlank(workOrder.processName ?? workOrder.routingOperationName),
    },
    { label: t.productionLine, value: lineText(workOrder.productionLineId, lineLabel) },
    {
      label: t.equipment,
      value: textOrBlank(workOrder.plannedEquipmentName ?? workOrder.plannedEquipmentCode),
    },
  ];
  const hasRemarks = workOrder.remarks !== undefined && workOrder.remarks.trim() !== '';

  return (
    <dl className="work-order-progress-spec">
      {[...what, ...where].map((row) => (
        <SpecRow item={row} key={row.label} />
      ))}
      {/* 비고 — 비었거나 공백뿐이면 줄째 뺀다(#360). 있으면 줄 전체 폭으로, 입력한 줄바꿈 그대로. */}
      {hasRemarks && (
        <SpecRow
          className="is-wide"
          item={{
            label: t.remarks,
            value: <span className="work-order-progress-remarks">{workOrder.remarks}</span>,
            title: '',
          }}
        />
      )}
    </dl>
  );
};

/**
 * 기록 구역 — 작업 세션 · 작업자별 실적 · 불량 유형별 · 4M 변경 자재 투입.
 *
 * 넷 다 비었으면 **한 줄**로 적는다. 구역마다 제목과 「없습니다」를 되풀이하면 아무 기록도 없는 W/O 가 창 절반을
 * 안내문으로 채운다(사용자 선택 2026-11-28). 하나라도 있거나, 아직 받는 중이거나, 받지 못했으면 구역을 그대로 둔다 —
 * 「모른다」를 「없다」로 적지 않는다.
 */
const DetailRecords = ({ workOrderId, crew }: { workOrderId: number; crew: CrewState }) => {
  const fourMInputs = useFourMInputs(workOrderId);
  const loaded = crew.isLoading || crew.isError ? undefined : crew.data;
  const isCrewEmpty =
    loaded !== undefined &&
    loaded.sessions.length === 0 &&
    loaded.workerResults.length === 0 &&
    loaded.defectTypes.length === 0 &&
    !loaded.sessionsTruncated &&
    !loaded.resultsTruncated;

  if (isCrewEmpty && fourMInputs.isSuccess && fourMInputs.data.length === 0) {
    return <p className="field-note work-order-progress-no-records">{t.noRecords}</p>;
  }

  return (
    <>
      <CrewSections crew={crew.data} isLoading={crew.isLoading} isError={crew.isError} />

      {/* 4M 변경 자재가 이 W/O 에 투입됐는지(omf-all-around#63 2단계) — 없으면 「내역 없음」 한 줄. */}
      <FourMInputsPanel workOrderId={workOrderId} />
    </>
  );
};

/**
 * 고른 W/O 의 상세.
 *
 * ⚠ **가운데 창으로 시작한다.** 스펙은 가장자리 서랍(드로어)을 그렸지만 DS 에 가장자리 배치가
 * 없다(design-system-v2-webui#71) — 이슈의 미결 지시대로 **만들지 않고** 가운데 창을 쓴다.
 *
 * 짜임(사용자 선택 2026-11-28 · 시안 B 「진행 먼저」) — 맨 위 상자가 상태 · 수량 · 달성률과 진행 단계를, 그 아래
 * 두 단 줄 목록이 품목 · P/O · 계획 기간 · 공정 · 라인 · 설비를 보인다. 그 아래가 기록 구역이다.
 * W/O 번호는 제목에만 적는다 — 제목과 첫 칸에 두 번 나오지 않는다. 제목은 「W/O 상세」(작게) 뒤에 번호(굵게)다.
 *
 * 실적 누계(양품 · 불량 · 달성률)는 상세 응답에 함께 실려 온다 — 목록의 그 줄과 같은 값이다.
 * 작업 세션 · 작업자별 실적 · 불량 유형은 따로 받아 아래에 잇는다.
 *
 * ⛔ **받는 중에도 창은 열려 있다.** 눌렀는데 아무 일도 없다가 나중에 열리면 두 번 누르게 된다.
 *
 * ⛔ **닫는 단추는 하나다** — 정보 표시 팝업 시안(2026-11-27 · #360)대로 아래 단추 줄 [닫기] 하나만 두고
 * 제목 줄 X 는 끈다. 같은 이름의 컨트롤이 둘이면 화면 읽기 도구에서 어느 것을 부르는지 갈린다.
 * 그 줄 왼쪽의 [이전 W/O] · [다음 W/O] 는 창을 닫지 않고 목록의 앞뒤 줄로 넘긴다.
 */
export const DetailDialog = ({
  workOrder,
  isLoading,
  isError,
  isOpen,
  itemLabel,
  statusLabel,
  lineLabel,
  crew,
  onPrev,
  onNext,
  onClose,
}: DetailDialogProps) => (
  <Dialog
    open={isOpen}
    onClose={onClose}
    title={
      /* 창의 종류는 작은 회색 글씨로, W/O 번호는 굵게 — 읽어야 할 것은 번호다(사용자 선택 2026-11-28 · 안 1). */
      <span className="work-order-progress-detail-title">
        <span className="work-order-progress-detail-title-kind">{t.title}</span>
        {workOrder !== null && (
          <>
            {' '}
            <strong className="work-order-progress-detail-title-no">{workOrder.workOrderNo}</strong>
          </>
        )}
      </span>
    }
    size="lg"
    className="work-order-progress-detail-dialog"
    showCloseButton={false}
    footer={
      <>
        <span className="work-order-progress-detail-nav">
          {/* 화살표는 넘어가는 쪽에 둔다 — 이전은 글 앞, 다음은 글 뒤(사용자 지시 2026-11-28). */}
          <Button
            disabled={onPrev === null}
            leadingIcon={<Icon name="chevron_left" size={18} />}
            variant="text"
            onClick={onPrev ?? undefined}
          >
            {t.prev}
          </Button>
          <Button
            disabled={onNext === null}
            trailingIcon={<Icon name="chevron_right" size={18} />}
            variant="text"
            onClick={onNext ?? undefined}
          >
            {t.next}
          </Button>
        </span>
        {/*
         * 창이 열리면 [닫기]에 초점을 둔다 — 앞에 놓인 [이전 W/O]가 먼저 잡히면 주 동작처럼 보인다.
         * 브라우저는 창을 열 때 `autofocus` **속성**이 붙은 것을 찾는다. React 의 `autoFocus` 는 속성을 남기지 않고
         * 붙는 순간 한 번 초점을 줄 뿐이라, 뒤이어 열리는 창이 첫 단추로 초점을 옮겨 버린다 — 그래서 속성을 직접 단다.
         */}
        <Button ref={markAutofocus} variant="outlined" onClick={onClose}>
          {t.close}
        </Button>
      </>
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
        <DetailHero statusLabel={statusLabel} workOrder={workOrder} />

        <DetailSpec itemLabel={itemLabel} lineLabel={lineLabel} workOrder={workOrder} />

        <DetailRecords crew={crew} workOrderId={workOrder.workOrderId} />
      </>
    )}
  </Dialog>
);
