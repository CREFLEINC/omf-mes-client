import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { InfoFacts } from '../../patterns/info-facts';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.stockAdjust;

/** 확인 창이 되보일 것 전부. **내부 번호는 하나도 담기지 않는다**(`omf-mes#44`). */
export interface PostSummary {
  /** 업무 번호 — 어느 전표를 전기하는지 밝힌다. 내부 번호가 아니다 */
  inventoryAdjustmentNo: string;
  /** 영업일. **화면이 만든 글자를 그대로 받는다** — 창이 다시 세면 확인한 것과 나가는 것이 갈린다 */
  businessDate: string;
  /** 발생 일시. 칸이 준 글자 그대로다 — 초와 offset은 보내는 자리가 붙인다 */
  occurredAtLocal: string;
  /** 두 날짜가 갈렸는가. **막지 않고 밝힌다**(공유계약 C-8의 야간조 경계) */
  isBusinessDateApart: boolean;
}

export interface PostConfirmDialogProps {
  summary: PostSummary;
  /**
   * 나가는 중인가. **두 버튼을 함께 잠근다** — 실행 버튼만 잠그면 사용자가 닫고 다시 눌러
   * **재고를 두 번 움직인다**(공통 훅이 호출마다 새 멱등 키를 만든다).
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
 * 전기 확인 — **이 화면에서 재고를 움직이는 유일한 창이다**(D-17).
 *
 * 상신 확인 창과 **갈라 둔다.** 그 창이 확인시키는 것은 「이 문장이 결재함 요약이 된다」이고,
 * 여기서 확인시키는 것은 **무엇이 언제 자로 원장에 잡히는가**다 — 조정의 내용은 이미 서버에
 * 있고 이 창이 고칠 수 없다.
 *
 * **되돌릴 수 없다는 사실은 단추 줄 왼쪽 경고 한 줄(`dialog.postNoUndo`)로만 밝힌다** — 등록 확인 창과
 * 같은 짜임(사실 상자 + 단추 줄 경고 · #360).
 *
 * **두 날짜가 갈려도 막지 않는다**(공유계약 C-8). 자정을 넘겨 일한 조정이면 그것이 정상이고,
 * 막으면 어제 자 조정을 전기할 길이 사라진다 — 화면은 **밝히기만 한다.**
 *
 * **스크림·X로 닫히지 않는다**(사본 체크리스트 5번의 3방어). 되돌릴 수 없는 조작의 확인이
 * 스치는 클릭에 사라지면 확인이 형식이 된다 — Escape는 디자인 시스템이 막을 수단을 주지
 * 않으므로, 그 길로 닫혀도 무너지지 않게 화면이 **나가는 중인 쓰기를 끊지 않는** 규율을 진다
 * (`resetIfIdle`).
 *
 * **창 안에 입력칸을 두지 않는다**(`omf-mes#45`) — 글자와 버튼뿐이다. 고칠 것이 있으면 닫고
 * 전기 구획의 칸에서 고친다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const PostConfirmDialog = ({
  summary,
  isSaving,
  banner,
  onConfirm,
  onClose,
}: PostConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.postTitle}
    footer={
      /* 되돌릴 수 없다는 한 줄은 단추 줄 왼쪽 끝, 단추는 오른쪽 — 등록 확인 창과 같다(#360). */
      <div className="confirm-foot">
        {/* 경고 칩 — 앱 안내 칩(`iqc-inspection-action-note`)의 경고 색(사용자 지시 2026-11-27 · #360). */}
        <p className="iqc-inspection-action-note" data-tone="warning">
          <Icon name="warning" size={14} aria-hidden />
          {t.dialog.postNoUndo}
        </p>
        <span className="confirm-foot-actions">
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {t.actions.keepReviewing}
          </Button>
          <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
            {t.actions.confirmPost}
          </Button>
        </span>
      </div>
    }
  >
    {banner}

    {/* 사실 상자 — 정보 표시 팝업 시안 상자, 등록 확인 창과 같은 짜임(#360). */}
    <InfoFacts
      rows={[
        [
          {
            label: t.result.inventoryAdjustmentNo,
            value: summary.inventoryAdjustmentNo,
            isKey: true,
          },
        ],
        [
          { label: t.post.businessDate, value: summary.businessDate },
          /* 입력값(`yyyy-MM-ddTHH:mm`)을 `yyyy-MM-dd HH:mm`로 보인다(⭐ 사용자 지시 2026-10-19). offset 이 없어 글자 그대로. */
          {
            label: t.post.occurredAt,
            value: formatPlantDateTime(summary.occurredAtLocal) ?? summary.occurredAtLocal,
          },
        ],
      ]}
    />

    {/* 갈린 날짜는 **막지 않고 밝힌다** — 뜻한 값인지 실수인지는 사용자가 안다. */}
    {summary.isBusinessDateApart && <p className="field-note">{t.dialog.postDatesApart}</p>}
  </Dialog>
);
