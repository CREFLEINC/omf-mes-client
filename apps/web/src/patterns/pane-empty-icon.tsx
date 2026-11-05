import { Icon } from '@crefle/web-ui';

/** 빈 상자 안내의 둥근 바탕 아이콘 — 목록은 assignment, 상세 선택 전은 layers(omf-all-around#228). */
export const PaneEmptyIcon = ({ name }: { name: 'assignment' | 'layers' }) => (
  <span className="inspection-standard-empty-icon">
    <Icon name={name} size={20} />
  </span>
);
