import { AlertBanner } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

const t = messages.notificationCenter;

/**
 * 쓰기 실패의 원인을 한 줄 안내로 옮긴다.
 *
 * ⭐ **조회 실패 배너(`load-error-banner.tsx`)와 갈래가 다르다.** 그쪽은 사용자가 할 수 있는
 * 조치가 재시도뿐이라 액션이 하나인데, 여기서는 **다시 시도를 붙이지 않는다** — 읽음 처리는
 * 카드를 다시 누르면 되고, 「모두 읽음」은 버튼이 그 자리에 그대로 있다. 배너에 또 하나를
 * 두면 같은 조작으로 가는 문이 둘이 된다(공유계약 G-23의 이웃 문제).
 *
 * ⭐ **404를 따로 가른다.** 이 갈래는 **목록이 낡았을 때** 난다 — 다른 자리에서 지워졌거나
 * 기간 밖으로 나간 알림을 누른 경우다. 「잠시 뒤 다시 시도하세요」로 뭉뚱그리면 몇 번을
 * 눌러도 같은 답이 오는데, 실제로 푸는 조치는 **기간을 다시 조회하는 것**이다.
 *
 * 빈 문구 방어는 조회 배너와 같은 규율이다 — 서버가 빈 문구를 주는 일이 실제로 있고,
 * 여러 오류를 이을 때는 **잇기 전에 항목별로** 다듬는다.
 */
export const describeWriteError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      if (error.status === 404) return t.writeError.notFound;
      return error.message === undefined || error.message.trim() === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message.trim() === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors
        .map((item) => item.message)
        .filter((message) => message.trim() !== '');

      return lines.length === 0 ? messages.httpError.description : lines.join(' ');
    }
  }
};

export interface WriteErrorBannerProps {
  error: ApiError;
  /** 무엇이 실패했나. 두 쓰기의 제목이 달라야 사용자가 어느 조작이 막혔는지 안다 */
  title: string;
}

/**
 * 쓰기 실패 배너. 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매(`.banner-slot`)를 붙인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const WriteErrorBanner = ({ error, title }: WriteErrorBannerProps) => (
  <div className="banner-slot">
    <AlertBanner variant="error" title={title}>
      {describeWriteError(error)}
    </AlertBanner>
  </div>
);
