import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toReasonLines, toVisibleLine } from './reason-draft';

const t = messages.stockAdjust;

/** 확인 창이 되보일 것 전부. **내부 번호는 하나도 담기지 않는다**(`omf-mes#44`). */
export interface SubmitSummary {
  /** 업무 번호 — 어느 전표를 올리는지 밝힌다. 내부 번호가 아니다 */
  inventoryAdjustmentNo: string;
  /** 상신 사유 **전문**. 줄바꿈이 유지된다 */
  reason: string;
  /** 결재함 목록에서 요약을 겸할 첫 줄. **전문과 나눠 보인다**(C30 · A-12) */
  reasonFirstLine: string;
}

export interface SubmitConfirmDialogProps {
  summary: SubmitSummary;
  /**
   * 나가는 중인가. **두 버튼을 함께 잠근다** — 실행 버튼만 잠그면 사용자가 닫고 다시 눌러
   * 결재 요청을 두 벌 만든다(공통 훅이 호출마다 새 멱등 키를 만든다).
   */
  isSaving: boolean;
  /**
   * 저장 실패 배너 슬롯. **창을 닫지 않고 이유를 보여야** 다시 시도할 수 있다 — 닫아 버리면
   * 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
   */
  banner: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 상신 확인 — **되돌릴 수 없는 둘째 조작 앞의 마지막 층이다**(D-17).
 *
 * **등록과 별개 동작이다.** 이 창은 **이미 만들어진** 전표를 결재에 올리는 것만 확인한다 —
 * 등록 확인 창이 「등록만 합니다」로 못 박은 것의 짝이다.
 *
 * ⭐ **사유 전문과 첫 줄을 나눠 보인다**(C30). 결재함 목록에서 요약을 겸하는 것이 첫 줄이라
 * (공유계약 A-12) 어느 문장이 남들에게 보일지 보내기 전에 확인시킨다. **헤더 사유(코드)와
 * 다른 값이다**(D-8) — 그쪽은 등록 확인 창이 이미 되보였다.
 *
 * **승인자·결재선을 이 창이 고르지 않는다**(D-12). 계약의 본문이 사유 한 칸이라 보낼 자리가
 * 없고, 승인 주체는 결재선 정의(W-06-15)가 정한 대로 전개된다 — 그 사실을 적어야 사용자가
 * 「고르는 칸이 없다」를 결함으로 읽지 않는다.
 *
 * **스크림·X로 닫히지 않는다**(`closeOnBackdropClick={false}`·`showCloseButton={false}` ·
 * 사본 체크리스트 5번의 3방어). **버리기 창과 갈리는 자리다** — 그쪽은 닫혀도 잃는 것이 없어
 * 전례가 스크림을 열어 두지만, 이 창은 닫히는 순간 확인 자체가 형식이 된다. Escape는 디자인
 * 시스템이 막을 수단을 주지 않으므로, 그 길로 닫혀도 무너지지 않게 화면이 **나가는 중인 쓰기를
 * 끊지 않는** 규율을 진다(`resetIfIdle`).
 *
 * **창 안에 입력칸을 두지 않는다**(`omf-mes#45`) — 글자와 버튼뿐이다. 사유를 고칠 것이 있으면
 * 닫고 결과 구획의 사유 칸에서 고친다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const SubmitConfirmDialog = ({
  summary,
  isSaving,
  banner,
  onConfirm,
  onClose,
}: SubmitConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.submitTitle}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.actions.confirmSubmit}
        </Button>
      </>
    }
  >
    {banner}

    <p>{t.dialog.submitLead}</p>

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.result.inventoryAdjustmentNo}</dt>
        <dd>{summary.inventoryAdjustmentNo}</dd>
      </div>
    </dl>

    {/*
     * 사유는 **전문과 첫 줄을 나눠** 보인다. 첫 줄만 보이면 무엇을 보내는지 모르고, 전문만
     * 보이면 어느 줄이 남들에게 요약으로 보일지 모른다.
     */}
    <section aria-label={t.dialog.reasonFull}>
      <p className="field-label">{t.dialog.reasonFull}</p>
      {/*
       * 줄바꿈이 뜻을 나른다 — 한 줄로 이어 붙이면 문단 구분이 사라진다. 줄마다 상자를 세우고
       * 빈 줄은 보이는 글자로 바꾼다(`app.css`를 고치지 않는다).
       *
       * 키에 순번을 섞는다 — 같은 글자가 두 줄에 오는 것이 사유에서는 흔하다.
       */}
      {toReasonLines(summary.reason).map((line, index) => (
        <p key={`${String(index)}:${line}`}>{toVisibleLine(line)}</p>
      ))}
    </section>

    <section aria-label={t.dialog.reasonFirstLine}>
      <p className="field-label">{t.dialog.reasonFirstLine}</p>
      <p>{summary.reasonFirstLine}</p>
      <p className="field-note">{t.dialog.reasonSummaryNote}</p>
    </section>

    {/* 무엇이 일어나는지가 실행 버튼 바로 위에 선다. */}
    <p>{t.dialog.submitApprover}</p>
    <p>{t.dialog.submitNoUndo}</p>
  </Dialog>
);
