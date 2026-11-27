import { Button, Chip, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { InfoFacts } from './info-facts';

const t = messages.judgmentConfirm;

/** 판정이 LOT 을 어느 쪽으로 보내는가 — 색과 LOT 상태 글을 고른다. 모르는 코드는 `unknown`. */
export type JudgmentConfirmDirection = 'release' | 'hold' | 'pending' | 'unknown';

/** 최종 판정 칩 색 — 모르는 코드는 회색. */
const CHIP_STATUS: Record<JudgmentConfirmDirection, 'success' | 'error' | 'warning' | 'idle'> = {
  release: 'success',
  hold: 'error',
  pending: 'warning',
  unknown: 'idle',
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
  /** LOT 상태 글을 화면이 따로 줄 때(PQC — 작업지시 단위라 전이가 OQC 와 다르다). 주면 `picked` 보다 앞선다. */
  lotStates?: Record<JudgmentConfirmDirection, string>;
  /** 「확정 시 적용 사항」 줄. 비면 구획을 그리지 않는다. */
  applyLines?: readonly string[];
  /** 경고 라벨 글. 기본은 「되돌릴 수 없음」 — IQC 처럼 [확정 취소]가 있는 화면은 따로 준다. */
  note?: string;
  /** 저장 실패 배너 — 창 안에 낸다. */
  banner?: ReactNode;
  /** 본문 상자에 더할 클래스 — 화면별 모양 조정(IQC 경고 글 키우기 · omf-all-around#296). */
  className?: string;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 판정 확정 확인 창(사용자 시안 2026-11-17 · omf-all-around#286) — IQC · OQC · PQC 관리웹이 같이 쓴다.
 * 확인 팝업 시안(#360) — 짧은 제목, 사실 상자(의뢰 번호 · 최종 판정 / 검사 결과 · LOT 상태) · 질문 · 적용 사항 · 안내 줄.
 * 쓰기는 이 창의 [판정 확정]에서만 나가고, 보내는 동안에는 닫히지 않는다.
 */
export const JudgmentConfirmDialog = ({
  inspectionRequestNo,
  judgmentLabel,
  direction,
  quantities,
  picked = false,
  lotStates,
  applyLines = [],
  note = t.irreversible,
  banner,
  className,
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
    <div
      className={
        className === undefined
          ? 'users-roles-worker-dialog judgment-confirm'
          : `users-roles-worker-dialog judgment-confirm ${className}`
      }
    >
      {banner}
      <InfoFacts
        rows={[
          [
            { label: t.requestNo, value: inspectionRequestNo, isKey: true },
            {
              label: t.judgmentHeading,
              title: judgmentLabel,
              value: (
                <Chip size="sm" variant="status" status={CHIP_STATUS[direction]}>
                  {judgmentLabel}
                </Chip>
              ),
            },
          ],
          [
            ...(quantities === null
              ? []
              : [
                  {
                    label: t.resultRow,
                    title: `${t.accepted} ${quantities.accepted} · ${t.rejected} ${quantities.rejected} · ${t.held} ${quantities.held}`,
                    value: (
                      <span className="judgment-confirm-qty">
                        <span>
                          {t.accepted}{' '}
                          <b data-tone={toneIfAny(quantities.accepted, 'success')}>
                            {quantities.accepted}
                          </b>
                        </span>{' '}
                        <span>
                          {t.rejected}{' '}
                          <b data-tone={toneIfAny(quantities.rejected, 'error')}>
                            {quantities.rejected}
                          </b>
                        </span>{' '}
                        <span>
                          {t.held} <b>{quantities.held}</b>
                        </span>
                      </span>
                    ),
                  },
                ]),
            {
              label: t.lotRow,
              value: (lotStates ?? (picked ? t.pickedLotState : t.lotState))[direction],
            },
          ],
        ]}
      />
      <p>{t.question}</p>
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
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
        <Icon name="warning" size={16} aria-hidden />
        {note}
      </p>
    </div>
  </Dialog>
);
