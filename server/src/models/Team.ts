import { Schema, model, type Document } from 'mongoose';

export interface TeamDocument extends Document {
  name: string;
  wallet: number; // budget
  captainId?: string; // userId of captain
  logo?: string;
  owner?: string;
  mobile?: string;
  email?: string;
  captain?: string; // captain name (for display)
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<TeamDocument>(
  {
    name: { type: String, required: true, unique: true },
    wallet: { type: Number, required: true, default: 0 },
    captainId: { type: String },
    logo: { type: String },
    owner: { type: String },
    mobile: { type: String },
    email: { type: String },
    captain: { type: String },
  },
  { timestamps: true }
);

export const Team = model<TeamDocument>('Team', teamSchema);


