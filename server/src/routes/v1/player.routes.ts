import { Router } from "express";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import {
  createPlayer,
  deletePlayer,
  getPlayer,
  listPlayers,
  updatePlayer,
} from "../../controllers/player.controller.js";

const router = Router();

router.get("/", requireAuth, listPlayers);
router.get("/:id", requireAuth, getPlayer);

// Admin-only mutations
router.post("/", requireAuth, requireRoles(["admin"]), createPlayer);
router.put("/:id", requireAuth, requireRoles(["admin"]), updatePlayer);
router.delete("/:id", requireAuth, requireRoles(["admin"]), deletePlayer);

export default router;
