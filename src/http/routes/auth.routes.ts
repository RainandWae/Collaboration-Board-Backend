import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { signAccessToken } from "../../auth/jwt";
import { prisma } from "../../db/prisma";
import { HttpError } from "../errors/httpError";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { loginRateLimiter, registerRateLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post(
  "/register",
  registerRateLimiter,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user
      .create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new HttpError(409, "Email is already registered");
        }

        throw error;
      });

    res.status(201).json({
      token: signAccessToken({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email, name: user.name }
    });
  })
);

authRouter.post(
  "/login",
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email }
    });

    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, "Invalid email or password");
    }

    res.json({
      token: signAccessToken({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email, name: user.name }
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    res.json({ user });
  })
);
