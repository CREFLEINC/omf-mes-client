import { Icon } from '@crefle/web-ui';
import type {
  InspectionGuideForward,
  InspectionPlanVersionGuideForward,
} from '@omf-mes/api-client';
import { activeLocale, messages, type Locale } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

/**
 * 화면 언어의 안내 문구 — 그 언어 칸이 비면 다른 언어 문구다. 둘 다 비면 `null`(omf-all-around#252).
 */
export const guideTextOf = (
  guide: InspectionPlanVersionGuideForward | null | undefined,
  locale: Locale = activeLocale(),
): string | null => {
  const ko = guide?.guideTextKo?.trim() ?? '';
  const vi = guide?.guideTextVi?.trim() ?? '';
  const [first, second] = locale === 'vi' ? [vi, ko] : [ko, vi];
  return first !== '' ? first : second !== '' ? second : null;
};

export interface GuideBlock {
  scopeCode: InspectionGuideForward['scopeCode'];
  text: string;
}

/** 의뢰의 검사 안내 — 공통 기준 · 품목 기준 순서로, 화면 언어 문구만 남긴다(빈 것은 뺀다). */
export const useInspectionGuide = (inspectionRequestId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['inspection-guide', 'request', inspectionRequestId] as const,
    enabled: inspectionRequestId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-requests/{inspectionRequestId}', {
          params: { path: { inspectionRequestId: inspectionRequestId as number } },
        }),
      ).then((detail): GuideBlock[] =>
        (detail.inspectionGuides ?? []).flatMap((guide) => {
          const text = guideTextOf(guide);
          return text === null ? [] : [{ scopeCode: guide.scopeCode, text }];
        }),
      ),
  });
};

/**
 * 검사 안내 띠(omf-all-around#252) — IQC · PQC · OQC 검사 화면의 기준 정보 바로 아래에 둔다. 전 품목 공통 기준의 안내와
 * 품목 기준의 안내를 함께(공통이 위) 정보 아이콘 + 파란 바탕으로 보이고, 줄바꿈은 그대로 둔다. 둘 다 있을 때만 「공통 안내」 ·
 * 「품목 안내」 이름표를 붙인다. 문구가 없거나 읽지 못하면 아무것도 그리지 않는다 — 검사를 막지 않는다.
 */
export const InspectionGuideNotice = ({
  inspectionRequestId,
}: {
  inspectionRequestId: number | null;
}) => {
  const blocks = useInspectionGuide(inspectionRequestId).data ?? [];
  if (blocks.length === 0) return null;
  const t = messages.common.inspectionHub;
  return (
    <div
      className="iqc-inspection-action-note inspection-guide-note"
      data-tone="info"
      role="note"
      aria-label={t.guide}
    >
      <Icon name="info" size={16} aria-hidden />
      <div className="inspection-guide-blocks">
        {blocks.map((block) => (
          <div key={block.scopeCode} className="inspection-guide-block">
            {blocks.length > 1 && (
              <strong className="inspection-guide-scope">
                {block.scopeCode === 'COMMON' ? t.guideCommon : t.guideItem}
              </strong>
            )}
            <span>{block.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
