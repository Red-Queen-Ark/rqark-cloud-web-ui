import { defineConfig } from '@hey-api/openapi-ts';

// The backend serves its Swagger document at <base>/swagger.json. Override the
// spec location with VITE_API_SPEC_URL when the backend does not run on the
// default host/port.
const specUrl = process.env.VITE_API_SPEC_URL ?? 'http://localhost:7302/api/swagger.json';

export default defineConfig({
  input: specUrl,
  // `src/api` is wiped on every run (clean defaults to true), so it must only
  // ever contain generated code. Hand-written client glue lives in
  // `src/api-client`.
  output: 'src/api',
  plugins: [
    // baseUrl is disabled here and set at runtime from VITE_API_BASE_URL so the
    // generated client never pins a host. See src/api-client/runtime.ts.
    { name: '@hey-api/client-fetch', baseUrl: false },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
