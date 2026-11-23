import { Button, Icon } from '@crefle/web-ui';

export interface NonconformanceLinkButtonProps {
  nonconformanceNo: string;
  /** 읽는 이름 — 어디로 가는지(「선별 전 부적합 … 보기」 등). */
  label: string;
  onClick: () => void;
}

/**
 * 다른 부적합으로 가는 단추 — 번호 + 이동 아이콘, 테두리 있는 작은 단추(#352 사용자 지시 · 상세의 선별 전 부적합과
 * 「처분 판정」 종결 안내 옆이 같은 모양).
 */
export const NonconformanceLinkButton = ({
  nonconformanceNo,
  label,
  onClick,
}: NonconformanceLinkButtonProps) => (
  <Button
    variant="outlined"
    size="sm"
    className="app-button-neutral disposition-nc-link"
    aria-label={label}
    onClick={onClick}
  >
    {nonconformanceNo}
    <Icon name="open_in_new" size={16} aria-hidden />
  </Button>
);
