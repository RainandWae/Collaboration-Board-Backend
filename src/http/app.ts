import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { corsOrigins } from "../config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth.routes";
import { boardsRouter } from "./routes/boards.routes";
import { healthRouter } from "./routes/health.routes";
import { listsRouter } from "./routes/lists.routes";
import { cardsRouter } from "./routes/cards.routes";
import { searchRouter } from "./routes/search.routes";
import { openApiSpec } from "../docs/openapi";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(morgan("dev"));
  
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
