const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000;

function getSession(phone) {
  const session = sessions.get(phone);
  if (!session || Date.now() - session.updatedAt > SESSION_TTL) {
    return { history: [], state: 'idle', data: {} };
  }
  return session;
}

function saveSession(phone, session) {
  sessions.set(phone, { ...session, updatedAt: Date.now() });
}

function clearSession(phone) {
  sessions.delete(phone);
}

module.exports = { getSession, saveSession, clearSession };
