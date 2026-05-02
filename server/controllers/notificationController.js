const { db, findByQuery, updateOne } = require('../config/db');

const getNotifications = (req, res, next) => {
  try {
    let notifications = findByQuery('notifications', { userId: req.user.id });
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unreadCount = notifications.filter(n => !n.readStatus).length;
    res.json({ notifications: notifications.slice(0, 50), unreadCount });
  } catch (error) { next(error); }
};

const markAsRead = (req, res, next) => {
  try {
    const updated = updateOne('notifications', req.params.id, { readStatus: true });
    if (!updated) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ message: 'Marked as read.' });
  } catch (error) { next(error); }
};

const markAllAsRead = (req, res, next) => {
  try {
    const notifs = findByQuery('notifications', { userId: req.user.id });
    notifs.forEach(n => updateOne('notifications', n._id, { readStatus: true }));
    res.json({ message: 'All marked as read.' });
  } catch (error) { next(error); }
};

module.exports = { getNotifications, markAsRead, markAllAsRead };
