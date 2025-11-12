import { Schema, model, type Document } from "mongoose";

export interface PendingUserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: "admin" | "player";
  otpHash?: string;
  otpExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pendingUserSchema = new Schema<PendingUserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["admin", "player"], required: true },
    otpHash: { type: String },
    otpExpires: { type: Date },
  },
  { timestamps: true }
);

export const PendingUser = model<PendingUserDocument>(
  "PendingUser",
  pendingUserSchema
);
