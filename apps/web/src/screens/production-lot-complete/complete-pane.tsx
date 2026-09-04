import { AlertBanner, Button, Chip, Progress, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import {
  toAchievementPercent,
  type Achievement,
  type BlockReason,
  type Judgment,
} from './completion-judgment';
import type { Lot, LotProgress, ReasonOption } from './types';

const t = messages.productionLotComplete;

/** 판정 배지의 말과 색. 서버가 준 값을 옮기기만 한다 — 화면이 다시 판정하지 않는다. */
const judgmentChip = (achievement: Achievement): { text: string; tone: 'success' | 'warning' } => {
  switch (achievement) {
    case 'UNDER':
      return { text: t.judgment.under, tone: 'warning' };
    case 'OVER':
      return { text: t.judgment.over, tone: 'success' };
    case 'NORMAL':
      return { text: t.judgment.normal, tone: 'success' };
    case null:
      return { text: t.detail.unknownValue, tone: 'warning' };
  }
};

/**
 * 막힌 사유를 사람 말로.
 *
 * ⛔ **게이팅 사유는 여기서 만들지 않는다** — 게이팅은 판정이 다섯 갈래라 화면이 그 표를 갖고,
 * 여기는 그것을 받아 그대로 보인다. 두 곳에서 만들면 같은 상태를 다르게 말하게 된다.
 */
const blockedText = (reason: BlockReason | null, gateText: string | null): string | null => {
  if (reason === null) return null;
  if (reason === 'gate') return gateText;

  return t.blocked[reason];
};

export interface CompletePaneProps {
  lot: Lot | null;
  progress: LotProgress | null;
  judgment: Judgment;
  reasons: readonly ReasonOption[];
  reasonCode: string | null;
  onReasonChange: (value: string) => void;
  /** 사유 목록 조회가 실패했는가 — 미달 마감을 열 수 없다 */
  reasonsFailed: boolean;
  /** 서버가 사유 칸을 짚어 되돌린 오류 */
  serverReasonError: string | null;
  /** 게이팅이 막았을 때 보일 문구. 열려 있으면 `null` */
  gateText: string | null;
  isSubmitting: boolean;
  onComplete: () => void;
  onCloseUnder: () => void;
}

/**
 * 우단 《완료 판정》.
 *
 * ⭐ **두 버튼을 나란히 두되 같은 것으로 보이지 않게 한다**(스펙 §3 · R71 「별도 명시 액션」).
 * 하나만 열리므로 사용자가 고를 일은 없지만, **닫힌 쪽도 자리를 지킨다** — 사라지면 어느 결말로
 * 가는지가 눌러 보기 전까지 보이지 않는다.
 */
export const CompletePane = ({
  lot,
  progress,
  judgment,
  reasons,
  reasonCode,
  onReasonChange,
  reasonsFailed,
  serverReasonError,
  gateText,
  isSubmitting,
  onComplete,
  onCloseUnder,
}: CompletePaneProps) => {
  const reasonFieldId = useId();

  if (lot === null) return <p className="field-note">{t.detail.notSelected}</p>;

  const percent = toAchievementPercent(progress);
  const chip = judgmentChip(judgment.achievement);
  /* 미달 마감 쪽을 먼저 둔다 — 버튼 순서와 같아야 어느 버튼의 사유인지 눈이 따라간다. */
  const blockedNotes = [
    ...new Set(
      [
        blockedText(judgment.closeUnderBlockedBy, gateText),
        blockedText(judgment.completeBlockedBy, gateText),
      ].filter((note): note is string => note !== null),
    ),
  ];

  /* 미달일 때만 사유 칸을 세운다 — 목표를 채운 LOT 에는 고를 것이 없다. */
  const underway = judgment.achievement === 'UNDER';

  return (
    <>
      <dl className="pop-lotdone-figures">
        <dt>{t.detail.lotLabel}</dt>
        <dd className="pop-lotdone-no" title={lot.lotNo}>
          {lot.lotNo}
        </dd>

        <dt>{t.detail.targetLabel}</dt>
        <dd>{lot.initialQty}</dd>

        <dt>{t.detail.goodQtyLabel}</dt>
        <dd>{progress === null ? t.detail.unknownValue : progress.goodQty}</dd>

        <dt>{t.detail.achievementLabel}</dt>
        <dd>
          {percent === null ? (
            t.detail.unknownValue
          ) : (
            <span className="pop-lotdone-rate">
              {`${String(percent)}%`}
              <Chip status={chip.tone}>{chip.text}</Chip>
            </span>
          )}
        </dd>

        <dt>{t.detail.varianceLabel}</dt>
        <dd>{progress === null ? t.detail.unknownValue : progress.varianceQty}</dd>
      </dl>

      {percent !== null && (
        <Progress
          value={percent}
          max={100}
          tone={judgment.achievement === 'UNDER' ? 'warning' : 'success'}
          valueText={`${String(percent)}%`}
          aria-label={t.detail.achievementLabel}
        />
      )}

      {/*
        ⛔ **진척을 못 받은 것을 조용히 넘기지 않는다.** 위 칸들이 「확인할 수 없음」으로 서
        있어도, 왜 버튼이 닫혔는지는 따로 말해야 사용자가 다시 불러올 생각을 한다.
      */}
      {progress === null && <p className="field-error">{t.detail.progressUnavailable}</p>}

      {/* 초과는 막지 않는다(§5-4) — 경고가 아니라 안내로 말한다. */}
      {judgment.achievement === 'OVER' && (
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.judgment.over}>
            {t.judgment.overNotice}
          </AlertBanner>
        </div>
      )}

      {underway && (
        <div className="field-cell">
          <label className="field-label" htmlFor={reasonFieldId}>
            {t.reason.label}
          </label>
          <Select
            id={reasonFieldId}
            options={reasons.map((reason) => ({ value: reason.value, label: reason.label }))}
            value={reasonCode}
            onChange={onReasonChange}
            placeholder={t.reason.placeholder}
            aria-required
            invalid={serverReasonError !== null}
            disabled={reasonsFailed || reasons.length === 0}
          />
          {reasonsFailed && <p className="field-error">{t.reason.loadFailed}</p>}
          {!reasonsFailed && reasons.length === 0 && (
            <p className="field-error">{t.reason.empty}</p>
          )}
          {serverReasonError !== null && <p className="field-error">{serverReasonError}</p>}
        </div>
      )}

      {/*
        ⛔ **되돌릴 수 없다는 것을 버튼 «위»에 둔다**(§8-5 · `omf-mes#87`). 누른 뒤에 알리면
        사용자가 할 수 있는 것이 없다 — 완료를 되돌리는 화면이 인벤토리에 없다.
      */}
      <p className="field-note">{t.warning.irreversible}</p>

      <div className="pop-lotdone-actions">
        <Button
          className="pop-touch-target"
          variant="outlined"
          size="xl"
          disabled={!judgment.canCloseUnder || isSubmitting}
          onClick={onCloseUnder}
        >
          {t.action.closeUnder}
        </Button>
        <Button
          className="pop-touch-target"
          variant="filled"
          size="xl"
          disabled={!judgment.canComplete || isSubmitting}
          onClick={onComplete}
        >
          {t.action.complete}
        </Button>
      </div>

      {/*
        막힌 사유를 **버튼마다** 낸다 — 하나로 뭉치면 「완료가 막힌 이유」와 「미달 마감이 막힌
        이유」가 섞여, 지금 무엇을 하면 되는지가 사라진다.
        ⛔ **단, 같은 사유면 한 번만 낸다.** 공통 문턱(게이팅·사번·진척)에 걸리면 두 버튼이 같은
        이유로 닫히는데, 그때 같은 문장을 두 번 세우면 사용자는 서로 다른 두 문제로 읽는다.
      */}
      {blockedNotes.map((note) => (
        <p className="field-note" key={note}>
          {note}
        </p>
      ))}

      {isSubmitting && <p className="field-note">{t.action.submitting}</p>}
    </>
  );
};
