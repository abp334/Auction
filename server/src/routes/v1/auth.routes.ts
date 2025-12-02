import { Router } from "express";
import {
  login,
  me,
  signup,
  refresh,
  logout,
  debugUser,
  verifyOtp, // Added import
} from "../../controllers/auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-otp", verifyOtp); // Added route
// Dev-only: inspect user record
router.get("/debug/user", async (req, res, next) => {
  try {
    return debugUser(req, res);
  } catch (err) {
    next(err);
  }
});
router.get("/me", requireAuth, me);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
