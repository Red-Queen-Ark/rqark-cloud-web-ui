/**
 * The `source` this app files its sessions under.
 *
 * `rqark-data-cloud` stamps every session with the application that uploaded
 * it and lets a caller filter the listing by it. The sidebar reads only the
 * sessions this app started, so it queries `GET /sessions?source=AGENT_CLOUD`;
 * the engine writes the same value when it owns a session.
 *
 * A session created without the source therefore does not match its own
 * filter: the row exists in the cloud and is owned by the user, but the sidebar
 * cannot see it until the engine's first save stamps the source on. Sending it
 * at creation is what makes a new session show up right away, so both the
 * create call and the listing must use this one value.
 */
export const SESSION_SOURCE = 'AGENT_CLOUD';
