import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, username, role, status, developerCode, managerId }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token is invalid or has expired. Please log in again.' });
  }
}

export function requireManager(req, res, next) {
  if (!req.user || req.user.role !== 'MANAGER') {
    return res.status(403).json({ message: 'Access denied. Manager role required.' });
  }
  next();
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
