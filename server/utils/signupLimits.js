const { v4: uuidv4 } = require('uuid');

const MAX_ACCOUNTS_PER_IP = 3;
const MAX_ACCOUNTS_PER_DEVICE = 3;
const DEVICE_COOKIE = 'fathoms_device';
const ACCOUNTS_COOKIE = 'fathoms_device_accounts';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: ONE_YEAR_MS,
};

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function parseAccountsCookie(req) {
  try {
    const raw = req.cookies?.[ACCOUNTS_COOKIE];
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function ensureDeviceCookie(req, res) {
  let deviceId = req.cookies?.[DEVICE_COOKIE];
  if (!deviceId) {
    deviceId = uuidv4();
    res.cookie(DEVICE_COOKIE, deviceId, COOKIE_OPTS);
  }
  return deviceId;
}

function setDeviceAccountsCookie(res, accountIds) {
  const unique = [...new Set(accountIds.filter(Boolean))].slice(0, MAX_ACCOUNTS_PER_DEVICE);
  res.cookie(ACCOUNTS_COOKIE, JSON.stringify(unique), COOKIE_OPTS);
}

async function checkSignupLimits(req, res, db) {
  const ip = getClientIp(req);
  const deviceId = ensureDeviceCookie(req, res);
  const deviceAccounts = parseAccountsCookie(req);

  const ipCount = await db.countSignupsByIp(ip);
  const deviceCount = await db.countSignupsByDevice(deviceId);
  const cookieCount = deviceAccounts.length;

  if (ipCount >= MAX_ACCOUNTS_PER_IP) {
    return {
      blocked: true,
      status: 403,
      error: 'Account limit reached for this network. You can create up to 3 accounts per IP address. If you already have an account, try logging in instead.',
      code: 'ip_limit',
    };
  }

  if (deviceCount >= MAX_ACCOUNTS_PER_DEVICE || cookieCount >= MAX_ACCOUNTS_PER_DEVICE) {
    return {
      blocked: true,
      status: 403,
      error: 'Account limit reached for this device. You can create up to 3 accounts per device. If you already have an account, try logging in instead.',
      code: 'device_limit',
    };
  }

  return { blocked: false, ip, deviceId, deviceAccounts };
}

async function recordSignup(req, res, db, userId, meta) {
  await db.recordSignup({
    id: uuidv4(),
    user_id: userId,
    ip_address: meta.ip,
    device_id: meta.deviceId,
    created_at: new Date().toISOString(),
  });

  const nextAccounts = [...new Set([...meta.deviceAccounts, userId])];
  setDeviceAccountsCookie(res, nextAccounts);
}

module.exports = {
  MAX_ACCOUNTS_PER_IP,
  MAX_ACCOUNTS_PER_DEVICE,
  ensureDeviceCookie,
  checkSignupLimits,
  recordSignup,
};
