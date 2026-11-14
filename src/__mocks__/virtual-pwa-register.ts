export const lastRegisterSWOptions: { current?: Record<string, unknown> } = {};

export function registerSW(options?: Record<string, unknown>) {
  lastRegisterSWOptions.current = options;
  return (reloadPage?: boolean) => {
    void reloadPage;
  };
}
