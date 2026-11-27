import { messages } from '@omf-mes/i18n';

import { readAppVersion } from './app-version';

const t = messages.shellNav;

interface AppVersionTextProps {
  /** 그 자리의 모양. 상단 바는 테두리 뱃지, 로그인 화면은 카드 아래 작은 글자다 */
  className: string;
}

/**
 * 지금 떠 있는 관리웹의 버전 글자. 릴리스 태그가 없는 빌드는 「개발 빌드」로 말한다.
 *
 * 상단 바 이름 옆과 로그인 카드 아래 두 자리가 함께 쓴다 — 로그인 화면은 셸 밖이라
 * `app/` 을 부를 수 없어서(`dep:check` 의 `app-inner-direction`) 여기 둔다.
 *
 * ⛔ **보이는 글자에 「버전」을 붙이지 않는다.** `v0.3.10` 은 그 자체로 읽힌다. 다만 읽어 주는
 * 이름에는 붙인다 — 숫자만 들으면 무엇의 값인지 모른다.
 */
export const AppVersionText = ({ className }: AppVersionTextProps) => {
  const appVersion = readAppVersion();

  if (appVersion.kind === 'dev') {
    return <span className={className}>{t.version.dev}</span>;
  }

  return (
    <span className={className} aria-label={t.version.release(appVersion.version)}>
      {appVersion.version}
    </span>
  );
};
