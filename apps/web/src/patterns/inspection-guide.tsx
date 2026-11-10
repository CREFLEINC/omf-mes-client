import { Icon } from '@crefle/web-ui';
import type { InspectionPlanVersionGuideForward } from '@omf-mes/api-client';
import { activeLocale, messages, type Locale } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

/**
 * 화면 언어의 안내 문구 — 그 언어 칸이 비면 다른 언어 문구다. 둘 다 비면 `null`(omf-all-around#252).
 */
export const guideTextOf = (
  version: InspectionPlanVersionGuideForward | null | undefined,
  locale: Locale = activeLocale(),
): string | null => {
  const ko = version?.guideTextKo?.trim() ?? '';
  const vi = version?.guideTextVi?.trim() ?? '';
  const [first, second] = locale === 'vi' ? [vi, ko] : [ko, vi];
  return first !== '' ? first : second !== '' ? second : null;
};

/** 의뢰가 쓰는 기준 버전의 안내 문구 — 버전이 없으면 부르지 않는다. */
export const useInspectionGuide = (inspectionPlanVersionId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['inspection-guide', inspectionPlanVersionId] as const,
    enabled: inspectionPlanVersionId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-plan-versions/{inspectionPlanVersionId}', {
          params: { path: { inspectionPlanVersionId: inspectionPlanVersionId as number } },
        }),
      ).then(({ inspectionPlanVersion }) => guideTextOf(inspectionPlanVersion)),
  });
};

/**
 * 검사 안내 띠(omf-all-around#252) — IQC · PQC · OQC 검사 화면의 기준 정보 바로 아래에 둔다. 검사 기준 버전에 적은 문구를
 * 정보 아이콘 + 파란 바탕으로 보이고, 줄바꿈은 그대로 둔다. 문구가 없거나 읽지 못하면 아무것도 그리지 않는다 — 검사를 막지 않는다.
 */
export const InspectionGuideNotice = ({
  inspectionPlanVersionId,
}: {
  inspectionPlanVersionId: number | null;
}) => {
  const guide = useInspectionGuide(inspectionPlanVersionId);
  const text = guide.data ?? null;
  if (text === null) return null;
  return (
    <p
      className="iqc-inspection-action-note inspection-guide-note"
      data-tone="info"
      role="note"
      aria-label={messages.common.inspectionHub.guide}
    >
      <Icon name="info" size={16} aria-hidden />
      <span>{text}</span>
    </p>
  );
};
