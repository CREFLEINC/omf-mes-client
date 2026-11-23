import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useScreenTitle } from '../../patterns/screen-title';
import { UnregisterDevice } from '../device-registration/unregister';
import './screen.css';

const t = messages.shellHome.settings;
const unregister = messages.deviceRegistration.signIn.unregister;

/**
 * 설정. 작업 목록(홈) 앱바의 사번 칩 오른쪽 아이콘으로 들어온다(사용자 지시 2026-11-23, 홈 맨 아래
 * 단추에서 옮김).
 *
 * 드물게 쓰는 것을 모은다 - 지금은 기기 등록 해제 하나다. 사번 입력 화면에 두었을 때는 교대 때마다
 * 눈에 걸렸다. 행은 홈의 업무 행과 같은 모양이다.
 */
export const SettingsScreen = () => {
  useScreenTitle(t.label);

  return (
    <div className="settings">
      <section className="settings__group" aria-labelledby="settings-device">
        <h2 id="settings-device" className="settings__heading">
          {t.device}
        </h2>
        <UnregisterDevice
          trigger={(open) => (
            <button type="button" className="settings__row" onClick={open}>
              <span className="settings__icon">
                <Icon name="phonelink_erase" size={24} />
              </span>
              <strong>{unregister.open}</strong>
              <Icon name="chevron_right" size={24} className="settings__chevron" />
            </button>
          )}
        />
      </section>
    </div>
  );
};
