import { Router } from "express";
import {
  login,
  me,
  signup,
  verifySignupOtp,
  refresh,
  logout,
} from "../../controllers/auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.post("/signup", signup);
router.post("/verify-otp", verifySignupOtp);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
