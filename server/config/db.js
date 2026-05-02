const { v4: uuidv4 } = require('uuid');

// In-memory database store
const db = {
  users: [],
  attendance: [],
  leaves: [],
  leaveAllocations: [],
  payroll: [],
  notifications: [],
  activityLogs: [],
};

// Helper to generate MongoDB-like ObjectIds
const generateId = () => uuidv4().replace(/-/g, '').substring(0, 24);

// Query helpers
const findById = (collection, id) => db[collection].find(item => item._id === id);
const findByQuery = (collection, query) => {
  return db[collection].filter(item => {
    return Object.entries(query).every(([key, value]) => {
      if (value === undefined || value === null) return true;
      if (typeof value === 'object' && value.$in) {
        return value.$in.includes(item[key]);
      }
      if (typeof value === 'object' && value.$gte && value.$lte) {
        return item[key] >= value.$gte && item[key] <= value.$lte;
      }
      if (typeof value === 'object' && value.$gte) {
        return item[key] >= value.$gte;
      }
      if (typeof value === 'object' && value.$lte) {
        return item[key] <= value.$lte;
      }
      if (typeof value === 'object' && value.$regex) {
        const regex = new RegExp(value.$regex, value.$options || '');
        return regex.test(item[key]);
      }
      return item[key] === value;
    });
  });
};

const insertOne = (collection, doc) => {
  const newDoc = { _id: generateId(), ...doc, createdAt: doc.createdAt || new Date().toISOString() };
  db[collection].push(newDoc);
  return newDoc;
};

const updateOne = (collection, id, update) => {
  const index = db[collection].findIndex(item => item._id === id);
  if (index === -1) return null;
  db[collection][index] = { ...db[collection][index], ...update, updatedAt: new Date().toISOString() };
  return db[collection][index];
};

const deleteOne = (collection, id) => {
  const index = db[collection].findIndex(item => item._id === id);
  if (index === -1) return false;
  db[collection].splice(index, 1);
  return true;
};

const count = (collection, query = {}) => {
  if (Object.keys(query).length === 0) return db[collection].length;
  return findByQuery(collection, query).length;
};

module.exports = { db, generateId, findById, findByQuery, insertOne, updateOne, deleteOne, count };
