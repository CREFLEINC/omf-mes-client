import { Button, EmptyState, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { VersionFormValues } from './types';
import type { GuideTextField } from './version-summary';

const t = messages.inspectionStandard;

export interface VersionSettingRowProps {
  title: string;
  /** 제목 아래 한 줄 — 건수. 지시문 줄은 두지 않는다(사용자 지시 · #258). */
  summary?: string;
  /** 오른쪽 끝 단추(항목 추가 · 도면 추가 · 지시문 수정). 고칠 수 없는 버전이면 넘기지 않는다. */
  action?: ReactNode;
  /** 줄 아래 내용(검사 항목 표 · 도면) — 늘 펼쳐 둔다(접고 펴기는 걷었다 · 사용자 지시 #258). */
  children?: ReactNode;
}

/**
 * 「버전별 설정」의 한 칸(사용자 시안 · omf-all-around#258) — 테두리 카드에 제목 · 요약, 오른쪽 끝 단추.
 * 검사 항목 · 도면은 그 아래에 종전 탭 내용을 늘 보인다.
 */
export const VersionSettingRow = ({ title, summary, action, children }: VersionSettingRowProps) => (
  <div className="inspection-standard-setting-row">
    <div className="inspection-standard-setting-head">
      <div className="inspection-standard-setting-toggle">
        <span className="inspection-standard-setting-text">
          <span className="inspection-standard-setting-title">{title}</span>
          {summary !== undefined && (
            <span className="inspection-standard-setting-summary">{summary}</span>
          )}
        </span>
      </div>
      {action}
    </div>
    {children !== undefined && <div className="inspection-standard-setting-body">{children}</div>}
  </div>
);

/**
 * 「검사 지시문」 줄(#252 · 줄 모양은 #258) — 화면 언어의 칸 하나만 보이고 고친다(사용자 지시).
 * 고칠 수 있는 버전(작성중)에서만 「지시문 수정」을 둔다. 줄 아래에 문구 또는 빈 상태 — 검사 항목 · 도면과 같은 모양(사용자 지시 · #258).
 */
export const VersionGuideRow = ({
  values,
  onEditGuide,
}: {
  /** 저장된 값 — 편집 중인 초안이 아니다. */
  values: VersionFormValues;
  onEditGuide?: (field: GuideTextField) => void;
}) => {
  const field: GuideTextField = 'guideText';
  const text = values[field].trim();

  return (
    <VersionSettingRow
      title={t.versionSection.rowGuide}
      action={
        onEditGuide === undefined ? undefined : (
          <Button
            variant="outlined"
            leadingIcon={<Icon name="edit" size={18} />}
            aria-label={t.versionSection.editGuide(t.fields[field])}
            onClick={() => onEditGuide(field)}
          >
            {t.versionSection.guideEditAction}
          </Button>
        )
      }
    >
      {text === '' ? (
        <EmptyState
          size="sm"
          icon={<Icon name="description" size={32} />}
          title={t.versionSection.guideNoneTitle}
          description={
            onEditGuide === undefined ? undefined : t.versionSection.guideNoneDescription
          }
        />
      ) : (
        <p className="inspection-standard-guide-text">{values[field]}</p>
      )}
    </VersionSettingRow>
  );
};
