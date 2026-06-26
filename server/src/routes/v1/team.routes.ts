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

router.get("/", requireAuth, listTeams);
router.get("/:id", requireAuth, getTeam);

// Admin-only mutations
router.post("/", requireAuth, requireRoles(["admin"]), createTeam);
router.put("/:id", requireAuth, requireRoles(["admin"]), updateTeam);
router.delete("/:id", requireAuth, requireRoles(["admin"]), deleteTeam);

export default router;
