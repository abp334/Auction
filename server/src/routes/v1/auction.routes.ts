import { Router } from "express";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import {
  closeAuction,
  createAuction,
  listAuctions,
  placeBid,
  startAuction,
  getAuction,
  pauseAuction,
  resumeAuction,
  setCurrentPlayer,
  sellCurrent,
  skipPlayer,
  undoBid,
} from "../../controllers/auction.controller.js";

const router = Router();

router.get("/", requireAuth, listAuctions);
router.get("/:id", requireAuth, getAuction);
router.post("/", requireAuth, requireRoles(["admin"]), createAuction);
router.post("/:id/start", requireAuth, requireRoles(["admin"]), startAuction);
router.post("/:id/pause", requireAuth, requireRoles(["admin"]), pauseAuction);
router.post("/:id/resume", requireAuth, requireRoles(["admin"]), resumeAuction);
router.post(
  "/:id/current",
  requireAuth,
  requireRoles(["admin"]),
  setCurrentPlayer
);
router.post(
  "/:id/bid",
  requireAuth,
  requireRoles(["admin", "captain"]),
  placeBid
);
// Allow captains to undo their last bid (if no other team has bid after)
router.post(
  "/:id/undo-bid",
  requireAuth,
  requireRoles(["admin", "captain"]),
  undoBid
);
// Allow authenticated users to trigger auto-sell (for automatic timer-based selling)
// Backend validates auction state and handles the sale logic securely
router.post("/:id/sell-current", requireAuth, sellCurrent);
// Allow captains to skip current player
router.post("/:id/skip", requireAuth, requireRoles(["captain"]), skipPlayer);
router.post("/:id/close", requireAuth, requireRoles(["admin"]), closeAuction);

export default router;
