import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Joi from "joi";
import {
  isSupabaseStorageConfigured,
  uploadAuctionMedia,
} from "../utils/supabaseStorage.js";

const uploadSchema = Joi.object({
  kind: Joi.string().valid("player", "team").required(),
  contentType: Joi.string()
    .valid("image/jpeg", "image/png", "image/webp", "image/gif")
    .default("image/jpeg"),
  data: Joi.string().base64({ paddingRequired: false }).required(),
});

export async function uploadImage(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  if (!isSupabaseStorageConfigured()) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      error:
        "Image storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the server.",
    });
  }

  const { error, value } = uploadSchema.validate(req.body);
  if (error) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: error.message });
  }

  try {
    const buffer = Buffer.from(value.data, "base64");
    const url = await uploadAuctionMedia({
      kind: value.kind,
      buffer,
      contentType: value.contentType,
    });
    return res.status(StatusCodes.OK).json({ url });
  } catch (err: any) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: err?.message || "Upload failed",
    });
  }
}
