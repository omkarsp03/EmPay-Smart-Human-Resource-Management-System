/** Standard contract hours per day for "extra" overtime calculation */
export const STANDARD_DAY_HOURS = 8;

/**
 * @param {object} record - attendance row with date, checkIn, checkOut?, totalHours?
 * @param {Date} [now] - current time (for open sessions on today's date)
 * @returns {{ workH: number|null, extraH: number, isLive: boolean }}
 */
export function getWorkAndExtraHours(record, now = new Date()) {
  if (!record?.checkIn) return { workH: null, extraH: 0, isLive: false };

  const recordDate = String(record.date || '').slice(0, 10);
  const todayStr = now.toISOString().split('T')[0];

  let workH;
  let isLive = false;

  if (record.checkOut) {
    workH =
      (new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / (1000 * 60 * 60);
    workH = Math.max(0, +workH.toFixed(2));
  } else if (recordDate === todayStr) {
    workH =
      (now.getTime() - new Date(record.checkIn).getTime()) / (1000 * 60 * 60);
    workH = Math.max(0, +workH.toFixed(2));
    isLive = true;
  } else {
    const stored = parseFloat(record.totalHours);
    if (Number.isFinite(stored) && stored > 0) {
      workH = +stored.toFixed(2);
    } else {
      return { workH: null, extraH: 0, isLive: false };
    }
  }

  const extraH =
    workH > STANDARD_DAY_HOURS ? +(workH - STANDARD_DAY_HOURS).toFixed(2) : 0;
  return { workH, extraH, isLive };
}

export function formatHours(h) {
  if (h == null || Number.isNaN(h)) return '—';
  return `${h}h`;
}
