import pino from 'pino';
import pinoCaller from 'pino-caller';
const logFile: string|undefined = process.env.LOG_FILE;


export let logger = pino({
  name: process.env.APP_ID?process.env.APP_ID:'converter-app',
  level: process.env.LOG_LEVEL?process.env.LOG_LEVEL:'info',
}, logFile ? pino.destination(logFile) : pino.destination(1));
logger = process.env.NODE_ENV === 'development'?pinoCaller(logger):logger;

export default logger;
