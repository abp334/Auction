import { Router } from "express";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { uploadImage } from "../../controllers/upload.controller.js";

const router = Router();

router.post(
  "/image",
  requireAuth,
  requireRoles(["admin"]),
  uploadImage
);

export default router;
