import { Router } from "express";
import { requireAuth, requireRoles, requireSuperAdmin } from "../../middleware/auth.js";
import {
  closeAuction,
  createAuction,
  seedTestAuction,
  listAuctions,
  placeBid,
  startAuction,
  getAuction,
  getAuctionLive,
  getAuctionReport,
  pauseAuction,
  resumeAuction,
  setCurrentPlayer,
  sellCurrent,
  skipPlayer,
  undoBid,
  registerSale,
  registerUnsold,
  undoSale,
  undoUnsold,
  setStaticCurrentPlayer,
  completeStaticAuction,
  reopenStaticAuction,
  deleteStaticAuction,
} from "../../controllers/auction.controller.js";

const router = Router();

router.get("/", requireAuth, listAuctions);
router.post(
  "/seed-test",
  requireAuth,
  requireSuperAdmin(),
  seedTestAuction
);
router.get("/:id/live", requireAuth, getAuctionLive);
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
router.get("/:id/report", requireAuth, requireRoles(["admin"]), getAuctionReport);
router.post("/:id/close", requireAuth, requireRoles(["admin"]), closeAuction);

// Static ledger endpoints (single-admin physical auction companion)
router.post(
  "/:id/register-sale",
  requireAuth,
  requireRoles(["admin"]),
  registerSale
);
router.post(
  "/:id/register-unsold",
  requireAuth,
  requireRoles(["admin"]),
  registerUnsold
);
router.delete(
  "/:id/sales/:playerId",
  requireAuth,
  requireRoles(["admin"]),
  undoSale
);
router.delete(
  "/:id/unsold/:playerId",
  requireAuth,
  requireRoles(["admin"]),
  undoUnsold
);
router.post(
  "/:id/static-current",
  requireAuth,
  requireRoles(["admin"]),
  setStaticCurrentPlayer
);
router.post(
  "/:id/complete",
  requireAuth,
  requireRoles(["admin"]),
  completeStaticAuction
);
router.post(
  "/:id/reopen",
  requireAuth,
  requireRoles(["admin"]),
  reopenStaticAuction
);
router.delete(
  "/:id",
  requireAuth,
  requireRoles(["admin"]),
  deleteStaticAuction
);

export default router;
