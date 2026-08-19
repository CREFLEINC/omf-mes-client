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

/** 어느 쓰기가 실패했나. 두 쓰기의 제목이 갈려야 사용자가 무엇이 막혔는지 안다 */
export type WriteScope = 'read' | 'allRead';

/**
 * 쓰기 실패의 제목 — **무엇이 실패했는지와 어느 쓰기인지 두 축으로 정한다.**
 *
 * ⭐ **되먹임 갈래에 「바꾸지 못했습니다」로 말하면 거짓이다.** 서버는 이미 바꿨고, 사용자가
 * 다시 눌러도 아무 일이 없다(이미 읽음이다). 못 바꾼 것이 아니라 **바꾼 결과를 화면이
 * 반영하지 못한 것**이므로 제목이 그 사실을 그대로 말해야 한다.
 *
 * ⭐ **내보내는 이유는 단위 시험이 이 표를 직접 재기 위해서다.** 되먹임 갈래는 **화면을
 * 거쳐 도달할 수 없고**(화면의 되먹임이 나중에 도는 상태 갱신이라 동기적으로 던지지 않는다 —
 * T3 실측), 그래서 「그 갈래에서 무엇이 보이는가」를 화면 시험으로 고정할 수단이 없다.
 * 전례는 같은 파일 계열의 `describeMarkAllReadReason`이다.
 *
 * | | `request` | `feedback` |
 * | --- | --- | --- |
 * | 읽음 처리 | 읽음으로 바꾸지 못했습니다 | 읽음으로 바꿨지만 화면에 반영하지 못했습니다 |
 * | 모두 읽음 | 모두 읽음으로 바꾸지 못했습니다 | 모두 읽음으로 바꿨지만 화면에 반영하지 못했습니다 |
 */
export const writeFailureTitle = (kind: 'request' | 'feedback', scope: WriteScope): string => {
  if (kind === 'feedback') {
    return scope === 'read' ? t.writeError.feedbackTitle : t.writeError.allReadFeedbackTitle;
  }

  return scope === 'read' ? t.writeError.readTitle : t.writeError.allReadTitle;
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
