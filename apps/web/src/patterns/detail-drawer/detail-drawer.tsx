import { Dialog } from '@crefle/web-ui';
import type { ReactNode } from 'react';

/**
 * T-W-A 조회형 상세 드로어(규범 6장 `DetailDrawer`). DS `Dialog placement="right"` 감싸개.
 *
 * - 머리에 **대상 번호**와 닫기를 둔다. 목록 아래로 상세를 붙이지 않는다(C-2).
 * - 대상 번호만으로 구분이 어려우면 `summary` 한 줄(이벤트와 시각 등)을 머리 바로 아래 둔다.
 * - 닫기는 Escape·스크림·X 모두 `onClose` 하나로 온다. 선택 해제(주소의 `selected` 지우기)는 부르는 쪽이 한다.
 *
 * 첫 사용 화면: W-CO-13 알림 발송 이력(omf-all-around#183). 두 번째 화면부터 이 부품을 쓴다.
 */
export interface DetailDrawerProps {
  /** 머리 — 대상 번호. */
  title: ReactNode;
  summary?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export const DetailDrawer = ({
  title,
  summary,
  onClose,
  children,
  className,
}: DetailDrawerProps) => (
  <Dialog
    open
    onClose={onClose}
    placement="right"
    size="lg"
    title={title}
    className={['detail-drawer', className ?? ''].filter((name) => name !== '').join(' ')}
  >
    {summary !== undefined && <p className="detail-drawer-summary">{summary}</p>}
    {children}
  </Dialog>
);
