import { createLogger, format, transports } from "winston";

// Destructure winston formats
const { combine, timestamp, printf, colorize, errors, splat } = format;

// Custom log format
const logFormat = printf(({ timestamp, level, message, stack, ...meta }) => {
  // If an error stack is present, log that instead of the message
  const logMessage = stack || message;
  // Stringify extra metadata
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
  return `${timestamp} [${level}] : ${logMessage} ${metaString}`;
});

// Create the Winston logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }), // capture stack traces
    splat(), // for printf-style message interpolation
    timestamp(), // add timestamp
    logFormat // use custom format
  ),
  transports: [
    // Log to console
    new transports.Console({
      format: combine(
        colorize(), // colorize output
        logFormat
      ),
    }),
    // Optionally, log to a file
    // new transports.File({ filename: 'app.log' })
  ],
  exitOnError: false, // do not exit on handled exceptions
});

// Utility wrappers for convenience
export const logInfo = (msg, meta) => logger.info(msg, meta);
export const logWarn = (msg, meta) => logger.warn(msg, meta);
export const logError = (msg, meta) => logger.error(msg, meta);
export const logDebug = (msg, meta) => logger.debug(msg, meta);

// Default export of the logger
export default logger;
