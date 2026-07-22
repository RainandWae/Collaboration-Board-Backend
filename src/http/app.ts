import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { corsOrigins } from "../config/env";
import { openApiSpec } from "../docs/openapi";
import { errorHandler } from "./middleware/errorHandler";
import { httpLogger } from "./middleware/httpLogger";
import { requestContext } from "./middleware/requestContext";
import { authRouter } from "./routes/auth.routes";
import { boardsRouter } from "./routes/boards.routes";
import { cardsRouter } from "./routes/cards.routes";
import { healthRouter } from "./routes/health.routes";
import { listsRouter } from "./routes/lists.routes";
import { searchRouter } from "./routes/search.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(requestContext);
  app.use(httpLogger);

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get("/docs.json", (_req, res) => {
    res.json(openApiSpec);
  });

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/boards", boardsRouter);
  app.use("/lists", listsRouter);
  app.use("/cards", cardsRouter);
  app.use("/search", searchRouter);

  app.use(errorHandler);

  return app;
}
