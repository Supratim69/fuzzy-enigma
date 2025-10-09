import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

const isDev = process.env.NODE_ENV !== "production";

export const logger = isDev
    ? pino(
          pino.transport({
              target: "pino-pretty",
              options: {
                  translateTime: "SYS:standard",
                  ignore: "pid,hostname",
                  singleLine: false,
              },
          })
      ).child({}, { level })
    : pino({ level });

export default logger;
