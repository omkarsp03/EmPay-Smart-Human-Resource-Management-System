/** Standard contract hours per day for "extra" overtime calculation */
export const STANDARD_DAY_HOURS = 8;

function hoursBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60));
}

/**
 * Compute work hours from an attendance record.
 * Supports both sessions-array records and legacy single checkIn/checkOut.
 *
 * @param {object} record - attendance row with date, checkIn, checkOut, sessions[]?, totalHours?
 * @param {Date}   [now]  - current time (for open sessions on today's date)
 * @returns {{ workH: number|null, extraH: number, isLive: boolean }}
 */
export function getWorkAndExtraHours(record, now = new Date()) {
  const sessions = Array.isArray(record?.sessions) ? record.sessions : [];
  const recordDate = String(record?.date || '').slice(0, 10);
  const todayStr = now.toISOString().split('T')[0];

  // --- Sessions-aware records ---
  if (sessions.length > 0) {
    let totalH = 0;
    let isLive = false;

    for (const s of sessions) {
      if (s.checkOut) {
        totalH += s.hours ?? hoursBetween(s.checkIn, s.checkOut);
      } else if (recordDate === todayStr) {
        // Open session — still checked in
        totalH += Math.max(0, (now.getTime() - new Date(s.checkIn).getTime()) / (1000 * 60 * 60));
        isLive = true;
      }
    }

    totalH = Math.max(0, +totalH.toFixed(2));
    const extraH = totalH > STANDARD_DAY_HOURS ? +(totalH - STANDARD_DAY_HOURS).toFixed(2) : 0;
    return { workH: totalH, extraH, isLive };
  }

  // --- Legacy records (no sessions array) ---
  if (!record?.checkIn) return { workH: null, extraH: 0, isLive: false };

  let workH;
  let isLive = false;

  if (record.checkOut) {
    workH = Math.max(0, +hoursBetween(record.checkIn, record.checkOut).toFixed(2));
  } else if (recordDate === todayStr) {
    workH = Math.max(0, +((now.getTime() - new Date(record.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(2));
    isLive = true;
  } else {
    const stored = parseFloat(record.totalHours);
    if (Number.isFinite(stored) && stored > 0) {
      workH = +stored.toFixed(2);
    } else {
      return { workH: null, extraH: 0, isLive: false };
    }
  }

  const extraH = workH > STANDARD_DAY_HOURS ? +(workH - STANDARD_DAY_HOURS).toFixed(2) : 0;
  return { workH, extraH, isLive };
}

export function formatHours(h) {
  if (h == null || Number.isNaN(h)) return '—';
  return `${h}h`;
}
