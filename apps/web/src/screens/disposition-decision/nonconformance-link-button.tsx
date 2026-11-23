import { Button, Icon } from '@crefle/web-ui';

export interface NonconformanceLinkButtonProps {
  nonconformanceNo: string;
  /** 단추 글 — 없으면 부적합 번호(「기존 부적합 건 조회」 등 · #352 사용자 지시). */
  text?: string;
  /** 읽는 이름 — 어디로 가는지(「기존 부적합 건 … 조회」 등). */
  label: string;
  onClick: () => void;
}

/**
 * 다른 부적합으로 가는 단추 — 번호 + 이동 아이콘, 빨간 테두리로 강조한 작은 단추(#352 사용자 지시 · 상세의 기존 부적합 건과
 * 「처분 판정」 종결 안내 옆이 같은 모양).
 */
export const NonconformanceLinkButton = ({
  nonconformanceNo,
  text,
  label,
  onClick,
}: NonconformanceLinkButtonProps) => (
  <Button
    variant="outlined"
    size="sm"
    className="disposition-nc-link"
    aria-label={label}
    onClick={onClick}
  >
    {text ?? nonconformanceNo}
    <Icon name="open_in_new" size={16} aria-hidden />
  </Button>
);
