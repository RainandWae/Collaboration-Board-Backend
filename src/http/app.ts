import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "../config/env";
import { authRouter } from "./routes/auth.routes";
import { boardsRouter } from "./routes/boards.routes";
import { healthRouter } from "./routes/health.routes";
import { listsRouter } from "./routes/lists.routes";
import { cardsRouter } from "./routes/cards.routes";
import { searchRouter } from "./routes/search.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/boards", boardsRouter);
  app.use("/lists", listsRouter);
  app.use("/cards", cardsRouter);
  app.use("/search", searchRouter);

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(err);
      res.status(400).json({ error: "Request failed" });
    }
  );

  return app;
}
