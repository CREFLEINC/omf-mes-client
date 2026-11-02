import { Icon } from '@crefle/web-ui';

/** 이력이 없을 때 — 둥근 상자 가운데 정보 아이콘 + 한 줄(사용자 시안 · omf-all-around#223). 판정 이력 · 특채가 같이 쓴다. */
export const EmptyNote = ({ text }: { text: string }) => (
  <p className="disposition-empty-note">
    <Icon name="info" size={20} aria-hidden />
    {text}
  </p>
);
