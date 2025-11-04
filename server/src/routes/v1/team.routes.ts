import { Router } from "express";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import {
  createTeam,
  deleteTeam,
  getTeam,
  listTeams,
  updateTeam,
} from "../../controllers/team.controller.js";

const router = Router();

// Public endpoints for viewing teams (needed for captain signup)
router.get("/", listTeams);
router.get("/:id", getTeam);

// Admin-only mutations
router.post("/", requireAuth, requireRoles(["admin"]), createTeam);
router.put("/:id", requireAuth, requireRoles(["admin"]), updateTeam);
router.delete("/:id", requireAuth, requireRoles(["admin"]), deleteTeam);

export default router;
