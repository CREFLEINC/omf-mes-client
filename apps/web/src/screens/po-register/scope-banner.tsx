import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.poRegister;

/**
 * 이 화면이 무엇을 하는 곳인지 밝히는 상시 안내.
 *
 * **맥락이 있든 없든 늘 선다.** 이 화면을 일반 구매 발주 등록으로 읽는 것이 여기서 가장 비싼
 * 오해이고(이슈 §6 ①), 그 오해는 등록을 마친 뒤에야 드러난다 — 되돌리려면 승인을 타야 한다.
 *
 * 사이드바에 항목을 두지 않는 것과 **같은 결정의 두 면**이다(계획 결정 13). 진입을 줄이고,
 * 들어온 사람에게는 범위를 밝힌다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ScopeBanner = () => (
  <div className="banner-slot">
    <AlertBanner variant="info" title={t.scope.title}>
      {t.scope.description}
    </AlertBanner>
  </div>
);
