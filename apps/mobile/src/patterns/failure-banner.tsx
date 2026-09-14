import { AlertBanner, type AlertBannerProps } from '@crefle/web-ui';

export interface FailureBannerProps extends Omit<AlertBannerProps, 'title'> {
  /** `useLoadFailure` 가 고른 문구. null 이면 셸이 이미 알린 것이다. */
  title: string | null;
}

/**
 * 조회 실패 배너.
 *
 * 등록 만료는 셸이 화면 위에 한 번만 알리므로 그때 `useLoadFailure` 는 null 을 준다. 그대로
 * `AlertBanner` 에 넘기면 제목 없는 빈 배너가 선다 - 문구가 없으면 배너째 그리지 않는다(#1198).
 */
export const FailureBanner = ({ title, ...rest }: FailureBannerProps) =>
  title === null ? null : <AlertBanner {...rest} title={title} />;
