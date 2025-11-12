import { Schema, model, type Document } from "mongoose";

export type UserRole = "admin" | "captain" | "player";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  teamId?: string; // for captains and players
  refreshTokenHash?: string;
  // Email verification fields
  emailVerified?: boolean;
  otpHash?: string;
  otpExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "captain", "player"],
      required: true,
    },
    teamId: { type: String },
    refreshTokenHash: { type: String },
    emailVerified: { type: Boolean, default: false },
    otpHash: { type: String },
    otpExpires: { type: Date },
  },
  { timestamps: true }
);

export const User = model<UserDocument>("User", userSchema);
