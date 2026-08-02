import { FEATURE_IDS, PROFILES } from '../config/schema.js';
import type { FeedbackInput, Profile } from '../types.js';

const TASK_TYPES = ['screen', 'feature', 'docs', 'settings', 'other'];
const LENGTHES = ['short', 'appropriate', 'long'];
const UNDERSTANDABLE = ['yes', 'partial', 'no'];
const REUSE = ['yes', 'no', 'unknown'];
const SEVERITIES = ['low', 'medium', 'high'];
const STATUSES = ['noted', 'needs_reproduction', 'planned', 'confirmed'];

const requiredKeys = [
  'date', 'projectAlias', 'taskType', 'profile', 'activeFeatures', 'perceivedLength', 'understandable',
  'mostUsefulFeature', 'unnecessaryFeature', 'missingInfo', 'inaccurateContent', 'reuseConfig',
  'improvementIdea', 'severity', 'status',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function validateFeedback(input: unknown): { ok: true; value: FeedbackInput } | { ok: false; error: string } {
  if (!isRecord(input)) return { ok: false, error: '피드백은 JSON 객체여야 합니다.' };
  if (Object.keys(input).some((key) => !requiredKeys.includes(key))) return { ok: false, error: '지원하지 않는 피드백 항목이 있습니다.' };
  if (requiredKeys.some((key) => !(key in input))) return { ok: false, error: '필수 피드백 항목이 빠졌습니다.' };
  const strings = ['projectAlias', 'mostUsefulFeature', 'unnecessaryFeature', 'missingInfo', 'inaccurateContent', 'improvementIdea'];
  if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: '날짜 형식이 올바르지 않습니다.' };
  if (strings.some((key) => typeof input[key] !== 'string' || String(input[key]).length > 2000)) return { ok: false, error: '피드백 글자 수나 형식이 올바르지 않습니다.' };
  if (!String(input.projectAlias).trim()) return { ok: false, error: '익명 프로젝트 별칭을 입력하세요.' };
  if (!TASK_TYPES.includes(String(input.taskType))) return { ok: false, error: '작업 종류가 올바르지 않습니다.' };
  if (!Object.keys(PROFILES).includes(String(input.profile))) return { ok: false, error: '지원하지 않는 Profile입니다.' };
  if (!Array.isArray(input.activeFeatures) || input.activeFeatures.some((id) => typeof id !== 'string' || !FEATURE_IDS.includes(id as never))) {
    return { ok: false, error: '활성 Feature 목록이 올바르지 않습니다.' };
  }
  if (!LENGTHES.includes(String(input.perceivedLength))) return { ok: false, error: '보고서 길이 선택이 올바르지 않습니다.' };
  if (!UNDERSTANDABLE.includes(String(input.understandable))) return { ok: false, error: '이해하기 쉬웠는지 선택이 올바르지 않습니다.' };
  if (!REUSE.includes(String(input.reuseConfig))) return { ok: false, error: '재사용 의향 선택이 올바르지 않습니다.' };
  if (!SEVERITIES.includes(String(input.severity))) return { ok: false, error: '심각도 선택이 올바르지 않습니다.' };
  if (!STATUSES.includes(String(input.status))) return { ok: false, error: '조치 상태 선택이 올바르지 않습니다.' };
  return { ok: true, value: input as FeedbackInput };
}
