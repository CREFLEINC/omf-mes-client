import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatLocalDateTime } from '../../patterns/date-display';

const t = messages.workOrderProgress.basis;

export interface BasisBarProps {
  /**
   * 화면에 보이는 수가 **언제 받아 낸 것인가.**
   *
   * ⛔ 「지금」이 아니다. 조회가 실패해도 앞서 받은 것이 그대로 보이므로, 그때 기준을 「지금」
   * 으로 올리면 **낡은 수에 새 시각을 붙이게 된다** — 사용자는 방금 갱신된 값으로 읽는다.
   */
  basisAt: Date;
  onRefresh: () => void;
}

/**
 * 마지막 갱신 시각과 「갱신」 — 통합 대시보드 · 재고 현황의 「갱신」과 같은 모양(#360).
 *
 * ⭐ **둘은 한 자리에 있어야 한다.** L-6 이 자동 갱신을 금지하므로 갱신 단추가 **유일한 갱신
 * 수단**이고, L-5 가 요구하는 기준 시각은 「그 수단을 마지막으로 쓴 때」다. 화면 맨 위 오른쪽 한 줄
 * (목록 · 상세 화면의 「⋯」 줄과 같은 자리)에 선다.
 */
export const BasisBar = ({ basisAt, onRefresh }: BasisBarProps) => (
  <div className="list-detail-toolbar">
    {/* `yyyy-MM-dd HH:mm`(보는 사람 시계 · ⭐ 관리웹 날짜 표기 통일 · 사용자 지시 2026-10-19). */}
    <span className="dashboard-refresh-status">{t.label(formatLocalDateTime(basisAt))}</span>
    <Button
      variant="outlined"
      size="sm"
      className="stock-status-refresh-button"
      leadingIcon={<Icon name="refresh" size={18} />}
      onClick={onRefresh}
    >
      {t.refresh}
    </Button>
  </div>
);
