/**
 * 마스터 형 리소스 화면이 공유하는 workflow.
 * 여기 있는 것은 리소스 이름을 알지 않는다 — 특정 리소스로 분기해야 한다면 그 로직은 화면 슬라이스 소유다.
 */
export { codeLockMessage, type Editability } from './editability';
export { SaveErrorBanner, type SaveErrorBannerProps } from './save-error-banner';
export {
  requireIfMatch,
  useMasterWrite,
  type MasterWriteOptions,
  type MasterWriteResult,
  type WriteHeaders,
} from './use-master-write';
