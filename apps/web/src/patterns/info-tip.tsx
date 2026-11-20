import { Icon, Tooltip } from '@crefle/web-ui';

/**
 * ⓘ — 알아 둘 규칙이지만 늘 펼쳐 둘 문장은 아닌 것(C-6 · 관리웹 정리 시안 A). 마우스를 올리거나 초점을
 * 주면 문장이 뜬다(DS `Tooltip`). 단추 이름이 곧 그 문장이다 — DS 툴팁은 뜬 뒤에야 설명을 이어 붙여,
 * 초점이 먼저 닿는 보조기술이 문장을 놓치지 않게. 라벨 · 제목 바로 뒤에 두고, 문장은 오른쪽에 줄을 바꿔 띄운다
 * (가운데 위로 띄우면 긴 문장이 화면 왼쪽 밖으로 잘린다).
 */
export const InfoTip = ({ text }: { text: string }) => (
  <Tooltip className="info-tip-anchor" placement="right" content={text}>
    <button type="button" className="info-tip" aria-label={text}>
      <Icon name="info" size={16} aria-hidden />
    </button>
  </Tooltip>
);
