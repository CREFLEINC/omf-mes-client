import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.stockAdjust;

/** 확인 창이 되보일 것 전부. **내부 번호는 하나도 담기지 않는다**(`omf-mes#44`). */
export interface RegisterSummary {
  /** 고른 헤더 사유 **코드 그대로**. 값 목록이 미확정이라 화면이 풀 이름이 없다(G-2) */
  reasonCode: string;
  sendToErp: boolean;
  /** 본문에 실릴 줄 수. **화면이 이미 센 값을 받는다** — 창이 다시 세지 않는다 */
  includedCount: number;
  /** 차이가 0이라 빠지는 줄 수. **오류가 아니라 제외다**(C19) */
  excludedCount: number;
  /** 실사에서 불러온 조정인가. **비어 있는 것이 정상이다**(조심 ⑤) */
  hasCountRef: boolean;
}

export interface RegisterConfirmDialogProps {
  summary: RegisterSummary;
  /**
   * 나가는 중인가. **두 버튼을 함께 잠근다** — 실행 버튼만 잠그면 사용자가 닫고 다시 눌러
   * 전표를 두 벌 만든다(공통 훅이 호출마다 새 멱등 키를 만든다).
   */
  isSaving: boolean;
  /**
   * 저장 실패 배너 슬롯. **창을 닫지 않고 이유를 보여야** 다시 시도할 수 있다 —
   * 닫아 버리면 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다(C27).
   */
  banner: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 등록 확인 — **이 화면에서 되돌릴 수 없는 첫 쓰기 앞의 마지막 층이다.**
 *
 * **등록만 한다.** 이 확인 한 번이 상신도 전기도 잇지 않는다 — 그 사실을 창이 적는 이유는,
 * 적지 않으면 사용자가 **재고가 움직인 것으로** 믿은 채 화면을 떠나기 때문이다. 조정은 재고를
 * 움직이는 업무라 그 오해가 특히 비싸다.
 *
 * ⭐ **빠지는 줄 수를 밝힌다**(C19 · D-4). 차이가 0인 줄은 오류가 아니라 **제외**이고,
 * 표의 표식을 못 본 채 확인하는 길이 있다 — 확인한 줄 수와 나가는 줄 수가 갈리지 않아야 한다.
 *
 * **값을 다시 계산하지 않는다.** 줄 수와 코드는 화면이 이미 만든 값을 받는다 — 창이 따로 세면
 * 「사용자가 확인한 것」과 「요청에 실리는 것」이 갈린다.
 *
 * **스크림·X로 닫히지 않는다**(`closeOnBackdropClick={false}`·`showCloseButton={false}` ·
 * 사본 체크리스트 5번). Escape는 디자인 시스템이 막을 수단을 주지 않으므로, 그 길로 닫혀도
 * 무너지지 않게 화면이 **나가는 중인 쓰기를 끊지 않는** 규율을 진다(`resetIfIdle`).
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45`) — 글자와 버튼뿐이다. 고칠 것이 있으면 닫고
 * 폼에서 고친다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const RegisterConfirmDialog = ({
  summary,
  isSaving,
  banner,
  onConfirm,
  onClose,
}: RegisterConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.registerTitle}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.actions.confirmRegister}
        </Button>
      </>
    }
  >
    {banner}

    <p>{t.dialog.registerLead}</p>

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.dialog.reasonCode}</dt>
        <dd>{summary.reasonCode}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.dialog.sendToErp}</dt>
        <dd>{summary.sendToErp ? t.dialog.sendToErpOn : t.dialog.sendToErpOff}</dd>
      </div>
      <div className="field-cell">
        {/* 비어 있는 것이 정상이라 경고 표식을 붙이지 않고 「—」로 둔다(조심 ⑤). */}
        <dt className="field-label">{t.dialog.countRef}</dt>
        <dd>{summary.hasCountRef ? t.source.count : t.values.empty}</dd>
      </div>
    </dl>

    <p>{t.dialog.includedLineCount(summary.includedCount)}</p>

    {/* 빠지는 줄이 없다는 것도 사실이다 — 없을 때 침묵하면 확인이 반쪽이 된다. */}
    <p className="field-note">
      {summary.excludedCount > 0
        ? t.dialog.excludedLineCount(summary.excludedCount)
        : t.dialog.noExcludedLine}
    </p>

    {/* 무엇이 일어나고 무엇이 아직 일어나지 않는지가 실행 버튼 바로 위에 선다. */}
    <p>{t.dialog.registerIsNotPost}</p>
    <p>{t.dialog.registerNoUndo}</p>
  </Dialog>
);
