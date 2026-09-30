import { i18n } from '@/i18n';
import { apiErrorCode, apiErrorMessage } from '@/api-client/error';

/**
 * Codes whose message is always the same, so translating them locally loses
 * nothing.
 *
 * BAD_REQUEST and CONFLICT are deliberately absent: the backend reuses them for
 * unrelated causes (a wrong current password, an unknown group, a taken
 * username, the last superuser), where the message carries the only detail that
 * tells the caller what to fix.
 */
const TRANSLATED_CODES = ['UNAUTHORIZED', 'FORBIDDEN', 'LAST_SUPERUSER', 'INTERNAL'];

/**
 * Turns whatever the generated client returns in `error` into a message fit for
 * an alert. A code with a fixed meaning is translated; otherwise the backend
 * message wins because it names the actual problem.
 */
export function useApiError() {
  // The global composer is used instead of useI18n() so the helper also works
  // outside a component setup, and so a returned string is not a live binding.
  const t = i18n.global.t;

  return (error: unknown, fallbackKey = 'common.unknownError'): string => {
    const code = apiErrorCode(error);
    const message = apiErrorMessage(error);

    if (code && TRANSLATED_CODES.includes(code)) {
      const key = `error.${code}`;
      const translated = t(key);
      if (translated !== key) {
        return translated;
      }
    }

    return message || t(fallbackKey);
  };
}
