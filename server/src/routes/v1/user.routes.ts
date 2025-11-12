import { Router } from "express";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { listUsers } from "../../controllers/user.controller.js";

const router = Router();

// Admin-only user listing (for assigning captains)
router.get("/", requireAuth, requireRoles(["admin"]), listUsers);
// Promote a user to captain and assign to a team (admin only)
router.post(
  "/:id/promote",
  requireAuth,
  requireRoles(["admin"]),
  async (req, res, next) => {
    // Lazy import controller to keep things simple
    const { promoteUser } = await import(
      "../../controllers/user.controller.js"
    );
    return promoteUser(req, res).catch(next);
  }
);

export default router;
