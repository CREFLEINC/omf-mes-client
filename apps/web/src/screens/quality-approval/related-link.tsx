import { Icon } from '@crefle/web-ui';
import { Link } from 'react-router';

export interface RelatedLinkProps {
  /** 무엇이 연관됐는가(「연관 부적합」·「대상 LOT」…). 묶음 이름으로도 쓴다. */
  heading: string;
  /** 어느 것인가 — 번호를 단추 «옆에» 둔다. 단추 이름은 갈 곳을, 번호는 어느 것인지를 말한다. */
  value: string;
  /** 갈 주소 — 가는 쪽 화면이 만든다(진입 규약 omf-mes#194 §3). */
  to: string;
  label: string;
}

/**
 * 다른 화면에서 그 정보를 여는 한 줄(#193) — 왼쪽에 이름 · 번호, 오른쪽에 주 색 알약 단추 모양의 링크.
 * 버튼이 아니라 링크다 — 문서를 바꾸는 이동이라 이름이 곧 갈 곳이다.
 */
export const RelatedLink = ({ heading, value, to, label }: RelatedLinkProps) => (
  <div className="quality-approval-concession-nc" role="group" aria-label={heading}>
    <div>
      <h3>{heading}</h3>
      <span>{value}</span>
    </div>
    <Link className="quality-approval-concession-nc-link" to={to}>
      {label}
      <Icon name="open_in_new" size={18} />
    </Link>
  </div>
);
