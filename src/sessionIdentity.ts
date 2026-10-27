import type { HistoricalLog } from '../types';
/** Distinct IDs identify sessions; legacy rows are conservatively grouped by date. */
export const recordedSessionKey = (log: HistoricalLog) => log.sessionId || `legacy:${log.date}`;
