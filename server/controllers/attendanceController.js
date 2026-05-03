const { db, findById, findByQuery, insertOne, updateOne } = require('../config/db');

const STANDARD_DAY_HOURS = 8;

function hoursBetween(checkInIso, checkOutIso) {
  if (!checkInIso || !checkOutIso) return null;
  const h = (new Date(checkOutIso).getTime() - new Date(checkInIso).getTime()) / (1000 * 60 * 60);
  return Math.max(0, +h.toFixed(2));
}
/**
 * Compute work hours from an attendance record.
 * Supports both legacy (single checkIn/checkOut) and sessions-array records.
 * record.sessions = [ { checkIn, checkOut, hours }, ... ]
 */
function resolveWorkHours(record, asOf = new Date()) {
  const sessions = Array.isArray(record.sessions) ? record.sessions : [];
  const day = String(record.date || '').slice(0, 10);
  const today = asOf.toISOString().split('T')[0];

  // --- Legacy records (no sessions array) ---
  if (sessions.length === 0) {
    if (!record.checkIn) return { workHours: null, extraHours: 0 };
    let wh = null;
    if (record.checkOut) {
      wh = hoursBetween(record.checkIn, record.checkOut);
    } else if (day === today) {
      wh = Math.max(0, +((asOf.getTime() - new Date(record.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(2));
    } else {
      const stored = parseFloat(record.totalHours);
      if (Number.isFinite(stored) && stored >= 0) wh = +stored.toFixed(2);
    }
    const extra = wh != null && wh > STANDARD_DAY_HOURS ? +(wh - STANDARD_DAY_HOURS).toFixed(2) : 0;
    return { workHours: wh, extraHours: extra };
  }

  // --- Sessions-aware records ---
  let totalH = 0;
  let hasLive = false;
  for (const s of sessions) {
    if (s.checkOut) {
      totalH += s.hours ?? hoursBetween(s.checkIn, s.checkOut) ?? 0;
    } else if (day === today) {
      totalH += Math.max(0, (asOf.getTime() - new Date(s.checkIn).getTime()) / (1000 * 60 * 60));
      hasLive = true;
    }
  }
  totalH = Math.max(0, +totalH.toFixed(2));
  const extra = totalH > STANDARD_DAY_HOURS ? +(totalH - STANDARD_DAY_HOURS).toFixed(2) : 0;
  return { workHours: totalH, extraHours: extra, isLive: hasLive };
}

// Office location (Pune Tech Park)
const OFFICE_LOCATION = { lat: 18.5204, lng: 73.8567, radiusMeters: 500 };

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// POST /api/attendance/mark
const markAttendance = (req, res, next) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, selfieData, status: manualStatus } = req.body;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const existing = db.attendance.find(a => a.userId === userId && a.date === today);

    let geoStatus = null;
    let isWithinGeofence = null;

    if (latitude && longitude) {
      const distance = calculateDistance(latitude, longitude, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
      isWithinGeofence = distance <= OFFICE_LOCATION.radiusMeters;
      geoStatus = isWithinGeofence ? 'Present' : 'WFH';
    }

    if (existing) {
      // Migrate legacy records: sessions might be a number or missing
      let sessions = Array.isArray(existing.sessions) ? existing.sessions : [];
      if (sessions.length === 0 && existing.checkIn) {
        // Build a sessions array from legacy top-level fields
        sessions = [{ checkIn: existing.checkIn, checkOut: existing.checkOut || null, hours: existing.checkOut ? hoursBetween(existing.checkIn, existing.checkOut) : null }];
      }
      const lastSession = sessions[sessions.length - 1];
      const isCurrentlyIn = lastSession && !lastSession.checkOut;

      if (isCurrentlyIn) {
        // ─── CHECKOUT: close the active session ───
        const sessionH = hoursBetween(lastSession.checkIn, now.toISOString());
        lastSession.checkOut = now.toISOString();
        lastSession.hours = sessionH;

        // Recompute total hours across all sessions
        const totalH = +(sessions.reduce((s, ss) => s + (ss.hours || 0), 0)).toFixed(2);

        updateOne('attendance', existing._id, {
          sessions,
          checkOut: now.toISOString(),       // top-level: last checkout
          totalHours: String(totalH),
        });
        insertOne('activityLogs', {
          userId, action: 'Checked Out',
          details: `Session ${sessions.length} ended at ${now.toLocaleTimeString()} (${sessionH}h this session, ${totalH}h total)`,
          timestamp: now.toISOString(),
        });
        return res.json({ message: `Checked out! (${totalH}h total today)`, type: 'checkout' });
      }

      // ─── RE-CHECK-IN: start a new session ───
      sessions.push({ checkIn: now.toISOString(), checkOut: null, hours: null });
      updateOne('attendance', existing._id, {
        sessions,
        checkIn: now.toISOString(),    // top-level: latest check-in
        checkOut: null,                // top-level: currently active
      });
      insertOne('activityLogs', {
        userId, action: 'Re-Checked In',
        details: `Session ${sessions.length} started at ${now.toLocaleTimeString()}`,
        timestamp: now.toISOString(),
      });
      return res.json({
        message: `Checked in again (session ${sessions.length})!`, type: 'checkin',
        geofence: isWithinGeofence !== null ? { withinRange: isWithinGeofence } : null,
      });
    }

    // ─── FIRST CHECK-IN of the day ───
    const user = findById('users', userId);
    const firstSession = { checkIn: now.toISOString(), checkOut: null, hours: null };
    const record = insertOne('attendance', {
      userId, date: today,
      status: geoStatus || manualStatus || 'Present',
      checkIn: now.toISOString(), checkOut: null,
      totalHours: null,
      sessions: [firstSession],
      shift: user?.shift || 'Morning',
      geoLocation: (latitude && longitude) ? { lat: latitude, lng: longitude } : null,
      isWithinGeofence,
      hasSelfie: !!selfieData,
      userName: user?.name, userDepartment: user?.department,
    });

    insertOne('activityLogs', {
      userId, action: 'Checked In',
      details: `Session 1 started at ${now.toLocaleTimeString()}${geoStatus ? ` (${geoStatus})` : ''}${selfieData ? ' (selfie)' : ''}`,
      timestamp: now.toISOString(),
    });

    res.status(201).json({
      message: `Checked in as ${record.status}!`, type: 'checkin', record,
      geofence: isWithinGeofence !== null ? { withinRange: isWithinGeofence } : null,
    });
  } catch (error) { next(error); }
};

// GET /api/attendance/user/:userId
const getUserAttendance = (req, res, next) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;
    if (req.user.role === 'Employee' && req.user.id !== userId) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    let records = findByQuery('attendance', { userId });
    if (month) records = records.filter(r => r.date.startsWith(month));
    const enriched = records.map((r) => {
      const { workHours, extraHours } = resolveWorkHours(r);
      return { ...r, workHours, extraHours };
    });
    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    const wfh = records.filter(r => r.status === 'WFH').length;
    const totalHours = enriched.reduce((s, r) => s + (r.workHours != null ? r.workHours : 0), 0);
    const attendanceRate = records.length > 0 ? (((present + wfh) / records.length) * 100).toFixed(1) : 0;
    res.json({
      records: enriched,
      stats: { present, absent, wfh, attendanceRate, totalHours: totalHours.toFixed(1) },
    });
  } catch (error) { next(error); }
};

// GET /api/attendance/today
const getTodayAttendance = (req, res, next) => {
  try {
    const today = typeof req.query.date === 'string' && req.query.date ? req.query.date : new Date().toISOString().split('T')[0];
    const records = findByQuery('attendance', { date: today });
    const asOf = new Date();
    const enriched = records.map((r) => {
      const user = findById('users', r.userId);
      const { workHours, extraHours } = resolveWorkHours(r, asOf);
      return {
        ...r,
        userName: user?.name,
        userDepartment: user?.department,
        userRole: user?.role,
        workHours,
        extraHours,
      };
    });
    const totalEmployees = db.users.filter(u => u.status === 'Active').length;
    res.json({
      records: enriched, total: totalEmployees,
      stats: {
        present: records.filter(r => r.status === 'Present').length,
        wfh: records.filter(r => r.status === 'WFH').length,
        absent: totalEmployees - records.length,
        rate: ((records.length / totalEmployees) * 100).toFixed(1),
      },
    });
  } catch (error) { next(error); }
};

// GET /api/attendance/shifts — Shift management
const getShifts = (req, res, next) => {
  try {
    const shifts = {
      Morning: { start: '09:00', end: '18:00', label: 'Morning Shift', color: '#6366F1' },
      Evening: { start: '14:00', end: '23:00', label: 'Evening Shift', color: '#F59E0B' },
      Night: { start: '22:00', end: '07:00', label: 'Night Shift', color: '#8B5CF6' },
    };

    const employees = db.users.filter(u => u.status === 'Active');
    const shiftAssignments = employees.map(u => ({
      _id: u._id, name: u.name, department: u.department,
      shift: u.shift || 'Morning',
    }));

    const shiftSummary = {};
    shiftAssignments.forEach(a => {
      shiftSummary[a.shift] = (shiftSummary[a.shift] || 0) + 1;
    });

    res.json({ shifts, assignments: shiftAssignments, summary: shiftSummary });
  } catch (error) { next(error); }
};

// PUT /api/attendance/shift/:userId
const updateShift = (req, res, next) => {
  try {
    const { userId } = req.params;
    const { shift } = req.body;
    if (!['Morning', 'Evening', 'Night'].includes(shift)) {
      return res.status(400).json({ message: 'Invalid shift.' });
    }
    const user = updateOne('users', userId, { shift });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    insertOne('activityLogs', {
      userId: req.user.id, action: 'Shift Updated',
      details: `Changed ${user.name}'s shift to ${shift}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: `Shift updated to ${shift}.`, user });
  } catch (error) { next(error); }
};

// GET /api/attendance/workforce-status — card indicators (Present / On Leave / Absent)
const getWorkforceStatus = (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const activeUsers = db.users.filter((u) => u.status === 'Active');
    const statusByUser = {};
    activeUsers.forEach((u) => {
      const onLeave = db.leaves.some((l) => {
        if (l.userId !== u._id || l.status !== 'Approved') return false;
        return l.startDate <= today && l.endDate >= today;
      });
      if (onLeave) {
        statusByUser[u._id] = 'On Leave';
        return;
      }
      const att = db.attendance.find((a) => a.userId === u._id && a.date === today);
      if (att && att.checkIn) {
        statusByUser[u._id] = 'Present';
        return;
      }
      statusByUser[u._id] = 'Absent';
    });
    res.json({ date: today, statusByUser });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markAttendance,
  getUserAttendance,
  getTodayAttendance,
  getShifts,
  updateShift,
  getWorkforceStatus,
};
