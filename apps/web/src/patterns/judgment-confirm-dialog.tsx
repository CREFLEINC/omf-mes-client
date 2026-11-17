import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.judgmentConfirm;

/** 판정이 LOT 을 어느 쪽으로 보내는가 — 색과 LOT 상태 글을 고른다. 모르는 코드는 `unknown`. */
export type JudgmentConfirmDirection = 'release' | 'hold' | 'pending' | 'unknown';

const TONE: Record<JudgmentConfirmDirection, string> = {
  release: 'success',
  hold: 'error',
  pending: 'warning',
  unknown: 'neutral',
};

/** 0 이 아닌 수량만 색을 입힌다(시안 — 「합격 3」만 초록). */
const toneIfAny = (qty: string, tone: string): string | undefined =>
  Number(qty.replace(/,/g, '')) === 0 ? undefined : tone;

export interface JudgmentConfirmDialogProps {
  inspectionRequestNo: string;
  judgmentLabel: string;
  direction: JudgmentConfirmDirection;
  /** 합격 · 불합격 · 보류 수량(표시 글). 셀 수 없으면 `null` — 줄을 그리지 않는다. */
  quantities: { accepted: string; rejected: string; held: string } | null;
  /** 대상 LOT 이 없는 출하작업지시 OQC 면 참 — LOT 상태 글이 「집은 LOT」 기준이 된다. */
  picked?: boolean;
  /** 「확정 시 적용 사항」 줄. 비면 구획을 그리지 않는다. */
  applyLines?: readonly string[];
  /** 저장 실패 배너 — 창 안에 낸다. */
  banner?: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 판정 확정 확인 창(사용자 시안 2026-11-17 · omf-all-around#286) — OQC · PQC 관리웹이 같이 쓴다.
 * 질문 제목 · 의뢰 번호 · 최종 판정 · 검사 결과 / LOT 상태 상자 · 적용 사항 · 되돌릴 수 없음 안내.
 * 쓰기는 이 창의 [판정 확정]에서만 나가고, 보내는 동안에는 닫히지 않는다.
 */
export const JudgmentConfirmDialog = ({
  inspectionRequestNo,
  judgmentLabel,
  direction,
  quantities,
  picked = false,
  applyLines = [],
  banner,
  isSaving,
  onClose,
  onConfirm,
}: JudgmentConfirmDialogProps) => (
  <Dialog
    open
    size="lg"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.title}
    footer={
      <>
        <Button disabled={isSaving} variant="outlined" onClick={onClose}>
          {t.back}
        </Button>
        <Button loading={isSaving} variant="filled" onClick={onConfirm}>
          {t.confirm}
        </Button>
      </>
    }
    onClose={() => {
      if (!isSaving) onClose();
    }}
  >
    <div className="judgment-confirm">
      {banner}
      <p className="judgment-confirm-target">{t.target(inspectionRequestNo)}</p>
      <div className="judgment-confirm-judgment">
        <h3>{t.judgmentHeading}</h3>
        <strong data-tone={TONE[direction]}>{judgmentLabel}</strong>
      </div>
      <dl className="judgment-confirm-rows">
        {quantities === null ? null : (
          <div className="judgment-confirm-row">
            <dt>{t.resultRow}</dt>
            <dd>
              <span>
                {t.accepted}{' '}
                <b data-tone={toneIfAny(quantities.accepted, 'success')}>{quantities.accepted}</b>
              </span>
              <span>
                {t.rejected}{' '}
                <b data-tone={toneIfAny(quantities.rejected, 'error')}>{quantities.rejected}</b>
              </span>
              <span>
                {t.held} <b>{quantities.held}</b>
              </span>
            </dd>
          </div>
        )}
        <div className="judgment-confirm-row">
          <dt>{t.lotRow}</dt>
          <dd>{(picked ? t.pickedLotState : t.lotState)[direction]}</dd>
        </div>
      </dl>
      {applyLines.length === 0 ? null : (
        <section className="judgment-confirm-apply" aria-label={t.applyHeading}>
          <h3>{t.applyHeading}</h3>
          <ul>
            {applyLines.map((line) => (
              <li key={line}>
                <Icon name="check" size={16} aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* 경고 라벨 — 화면의 「판정 확정 후 수정이 불가합니다」 줄과 같은 모양(표식 · 글 한 줄 가운데 맞춤 · #286). */}
      <p className="iqc-inspection-action-note" data-tone="warning">
        <Icon name="warning" size={18} aria-hidden />
        {t.irreversible}
      </p>
    </div>
  </Dialog>
);
