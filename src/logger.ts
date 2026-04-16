import pino from "pino";

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");
const date = new Date().toISOString().slice(0, 10);
const logFile = `logs/bot-${date}.log`;

const transport = pino.transport({
  targets: isProd
    ? [
        { target: "pino/file", level, options: { destination: 1 } },
        { target: "pino/file", level, options: { destination: logFile, mkdir: true } },
      ]
    : [
        {
          target: "pino-pretty",
          level,
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
        },
        { target: "pino/file", level, options: { destination: logFile, mkdir: true } },
      ],
});

const logger = pino({ level }, transport);

export default logger;
