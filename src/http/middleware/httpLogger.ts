import pinoHttp from "pino-http";
import { logger } from "../../logger/logger";

function getRequestId(header: string | string[] | undefined) {
  if (Array.isArray(header)) {
    return header[0] ?? "unknown";
  }

  return header ?? "unknown";
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    return getRequestId(req.headers["x-request-id"]);
  },
  customProps: (req) => ({
    requestId: getRequestId(req.headers["x-request-id"])
  })
});
