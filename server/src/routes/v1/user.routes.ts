import { Router } from "express";
import { requireAuth, requireRoles, requireSuperAdmin } from "../../middleware/auth.js";
import { listUsers, listAdminUsers, listCaptainUsers, deleteUser } from "../../controllers/user.controller.js";

const router = Router();

// Admin-only user listing (for assigning captains)
router.get("/", requireAuth, requireRoles(["admin"]), listUsers);

// Super admin: list all admin users
router.get("/admins", requireAuth, requireSuperAdmin(), listAdminUsers);

// Super admin: list all captain users
router.get("/captains", requireAuth, requireSuperAdmin(), listCaptainUsers);

// Super admin: delete a user
router.delete("/:id", requireAuth, requireSuperAdmin(), deleteUser);

// Promote a user to captain and assign to a team (admin only)
router.post(
  "/:id/promote",
  requireAuth,
  requireRoles(["admin"]),
  async (req, res, next) => {
    const { promoteUser } = await import(
      "../../controllers/user.controller.js"
    );
    return promoteUser(req, res).catch(next);
  }
);

export default router;
