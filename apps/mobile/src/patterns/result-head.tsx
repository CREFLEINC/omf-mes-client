import { Icon } from '@crefle/web-ui';

import './result-head.css';

export interface ResultHeadProps {
  /** 서버가 받았다(success) · 이 기기에 담겨 보낼 차례를 기다린다(pending). */
  tone: 'success' | 'pending';
  title: string;
  description?: string;
}

/**
 * 등록한 뒤 화면의 첫 줄. 「됐다」를 원 안의 표시와 제목 하나로 먼저 말한다.
 *
 * 전에는 결과가 다른 안내와 같은 띠였다. 띠가 몇 개 서는 화면에서 그것이 끝났다는 뜻인지,
 * 또 무언가를 하라는 뜻인지 다 읽어야 갈렸다. 되돌아온 것(오류)은 이것으로 그리지 않는다 - 그때는
 * 할 일이 남아 있어 오류 띠가 맞다.
 */
export const ResultHead = ({ tone, title, description }: ResultHeadProps) => (
  <div className={`result-head result-head--${tone}`} role="status">
    <span className="result-head__mark" aria-hidden="true">
      <Icon name={tone === 'success' ? 'check' : 'cloud_upload'} size={36} />
    </span>
    <h2 className="result-head__title">{title}</h2>
    {description === undefined ? null : <p className="result-head__description">{description}</p>}
  </div>
);
