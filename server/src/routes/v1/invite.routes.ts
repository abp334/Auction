import { Router } from "express";
import {
  createInviteCode,
  listInviteCodes,
  revokeInviteCode,
} from "../../controllers/invite.controller.js";
import { requireAuth, requireSuperAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireSuperAdmin());

router.post("/", createInviteCode);
router.get("/", listInviteCodes);
router.delete("/:id", revokeInviteCode);

export default router;
