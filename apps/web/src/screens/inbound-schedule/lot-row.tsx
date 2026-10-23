import { Button, Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { formatDate } from './period';
import { OneLine } from './receipt-status';
import { stageGroupTone, stageTone } from './stage';
import type { InboundLotProgress, InboundStageCode, InboundStageGroup } from './types';

const t = messages.inboundSchedule;

/**
 * 날짜 칸 — 서버의 일시에서 **공장 달력의 날짜**만 `YYYY.MM.DD` 로. 비면 「—」.
 * 앞 10자리를 자르면 UTC 날짜가 되어 공장 새벽(UTC 전날 밤)의 입하가 하루 앞당겨 보인다.
 */
const dateOf = (value: string | null | undefined): string =>
  value === null || value === undefined || value === ''
    ? t.values.empty
    : formatDate(toPlantDateTimeParts(value)?.date ?? value.slice(0, 10));

/** 모르는 코드는 번역하지 않고 그대로, 중립 색으로 낸다 — 뜻을 지어내지 않는다(C-17 · receipt-status.tsx 와 같은 길). */
const stageLabel = (code: string): string =>
  code in t.stage.code ? t.stage.code[code as InboundStageCode] : code;

/** LOT 줄의 단계 칩. */
export const StageChip = ({ code }: { code: string }) => (
  <Chip variant="status" status={stageTone(code)} size="sm">
    {stageLabel(code)}
  </Chip>
);

/** 묶음 칩 — 왼쪽 「진행」 칸과 발주 머리가 쓴다. 수가 있으면 「검사 대기 2」. */
export const StageGroupChip = ({ group, count }: { group: InboundStageGroup; count?: number }) => (
  <Chip variant="status" status={stageGroupTone(group)} size="sm">
    {count === undefined ? t.stage.group[group] : t.stage.groupCount(t.stage.group[group], count)}
  </Chip>
);

/**
 * 접기 손잡이 — 발주 라인 첫 칸. `aria-expanded` 가 상태를 말하고 접근 이름이 어느 줄인지 밝힌다.
 * 표 부품의 줄 클릭이 없어 단추가 직접 받는다.
 */
export const TreeToggle = ({
  isExpanded,
  label,
  onToggle,
}: {
  isExpanded: boolean;
  label: string;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className="po-board-tree-toggle"
    aria-expanded={isExpanded}
    aria-label={label}
    onClick={onToggle}
  >
    <Icon name="expand_more" size={20} />
  </button>
);

/**
 * LOT 줄 첫 칸의 안내선 자리. 선 자체는 칸(td)이 그린다(app.css — 마지막 줄은 갈고리) — 그래서 줄 높이를 다 쓴다.
 * `data-lot-row` 가 그 줄을 LOT 줄로, `data-last` 가 마지막 줄로 알린다.
 */
export const TreeGuide = ({ isLast }: { isLast: boolean }) => (
  <span
    className="po-board-tree-guide"
    aria-hidden="true"
    data-lot-row="true"
    {...(isLast ? { 'data-last': 'true' } : {})}
  />
);

/**
 * LOT 줄의 근거 — 입하일로 시작하고, 그 뒤는 **서버가 준 값만** 적는다. 단계마다 무엇이 그 단계의 증거인지가 다르다:
 * 검사 단계는 의뢰번호·요청일, 보류는 사유 이름, 입고 대기는 검사 결과, 적치 이후는 입고 전표·적치일.
 * 문장이 아니라 「·」로 이은 조각이다(C-16 — 셀에 문장을 쓰지 않는다).
 */
export const lotEvidence = (lot: InboundLotProgress): string => {
  const { inspection, goodsReceipt, putaway } = lot;
  const parts: string[] = [t.lot.receivedOn(dateOf(lot.receiptDatetime))];

  if (inspection !== null) {
    if (inspection.judgmentCode === 'ACCEPTED') {
      parts.push(t.lot.evidence.accepted(dateOf(inspection.judgedAt ?? inspection.requestedAt)));
    } else if (inspection.judgmentCode === 'REJECTED') {
      parts.push(t.lot.evidence.rejected);
    } else if (inspection.statusCode === 'SKIPPED') {
      parts.push(t.lot.evidence.skipped);
    } else {
      parts.push(
        t.lot.evidence.requested(inspection.inspectionRequestNo, dateOf(inspection.requestedAt)),
      );
    }
  } else if (lot.stageCode === 'RECEIPT_READY') {
    parts.push(t.lot.evidence.noInspection);
  }

  for (const reason of lot.blockedReasons) parts.push(reason.name);

  if (goodsReceipt !== null) {
    parts.push(
      t.lot.evidence.posted(goodsReceipt.goodsReceiptNo, dateOf(goodsReceipt.receiptDatetime)),
    );
  }

  if (putaway !== null && putaway.completedAt !== null) {
    parts.push(t.lot.evidence.putawayDone(dateOf(putaway.completedAt)));
  }

  return parts.join(t.lot.evidence.separator);
};

/** 품목명 칸의 LOT 줄 — LOT 번호(그대로) + 근거(보조색 · 넘치면 말줄임). */
export const LotMainCell = ({ lot }: { lot: InboundLotProgress }) => {
  const evidence = lotEvidence(lot);

  return (
    <span className="po-board-lot-main">
      <span className="po-board-lot-no">{lot.lotNo}</span>
      {evidence !== '' && <OneLine text={evidence} />}
    </span>
  );
};

/** 창고 칸의 LOT 줄 — 적치된(또는 임시 적치된) 위치 「코드 · 이름」. 아직 자리가 없으면 빈 칸. */
export const lotLocation = (lot: InboundLotProgress): string => {
  const putaway = lot.putaway;

  if (putaway === null || putaway.locationCode === null) return '';

  return putaway.locationName === null
    ? putaway.locationCode
    : `${putaway.locationCode} · ${putaway.locationName}`;
};

export interface LotActionProps {
  lot: InboundLotProgress;
  /** 보내는 중인 IQC 의뢰의 LOT. 그 단추만 돈다. */
  requestingLotId: number | null;
  /** 없으면(권한 없음) 「입고 처리」 단추를 세우지 않는다 — 막는 것은 서버다. */
  onPostReceipt?: (lot: InboundLotProgress) => void;
  onRequestIqc?: (lot: InboundLotProgress) => void;
}

/**
 * 「다음 할 일」 칸 — **서버가 정한 것만** 선다(C-17). 이 화면이 하는 둘은 단추, PDA 의 일은 글자.
 * 검사 자체는 품질팀의 일이라 검사 화면으로 가는 길을 두지 않는다 — 입고 담당이 하는 것은 **의뢰 요청**이다
 * (사용자 지시 2026-10-22).
 */
export const LotActionCell = ({
  lot,
  requestingLotId,
  onPostReceipt,
  onRequestIqc,
}: LotActionProps) => {
  switch (lot.nextActionCode) {
    case 'REQUEST_IQC':
      return onRequestIqc === undefined ? null : (
        <Button
          variant="outlined"
          size="sm"
          aria-label={t.actions.requestIqcRow(lot.lotNo)}
          loading={requestingLotId === lot.lotId}
          disabled={requestingLotId !== null && requestingLotId !== lot.lotId}
          onClick={() => {
            onRequestIqc(lot);
          }}
        >
          {t.actions.requestIqc}
        </Button>
      );
    case 'POST_RECEIPT':
      return onPostReceipt === undefined ? null : (
        <Button
          variant="outlined"
          size="sm"
          aria-label={t.actions.postReceiptRow(lot.lotNo)}
          onClick={() => {
            onPostReceipt(lot);
          }}
        >
          {t.actions.postReceipt}
        </Button>
      );
    case 'PUTAWAY':
      return <span className="po-board-lot-note">{t.lot.putawayOnPda}</span>;
    default:
      return null;
  }
};
