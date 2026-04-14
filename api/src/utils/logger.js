const fs   = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

function timestamp() {
  return new Date().toISOString();
}

function writeLog(level, message, meta = {}) {
  const entry = JSON.stringify({
    timestamp: timestamp(),
    level,
    message,
    ...meta
  });
  console.log(entry);

  const logFile = path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(logFile, entry + '\n');
}

const logger = {
  info:  (msg, meta) => writeLog('INFO',  msg, meta),
  warn:  (msg, meta) => writeLog('WARN',  msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
  debug: (msg, meta) => writeLog('DEBUG', msg, meta),
};

// Express request logger middleware
logger.requestMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('HTTP Request', {
      method:   req.method,
      url:      req.originalUrl,
      status:   res.statusCode,
      duration: Date.now() - start + 'ms',
      ip:       req.ip
    });
  });
  next();
};

module.exports = logger;