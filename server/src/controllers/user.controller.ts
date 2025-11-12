import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import { User } from "../models/User.js";
import { Team } from "../models/Team.js";

// Admin-only: list users with basic info (supports ?search=)
export async function listUsers(req: Request, res: Response) {
  const { search } = req.query as { search?: string };
  const filter: any = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  const users = await User.find(filter)
    .select("_id name email role teamId")
    .sort({ name: 1 })
    .lean();
  return res.status(StatusCodes.OK).json({ users });
}

// Admin-only: promote a user to captain and assign to a team.
export async function promoteUser(req: Request, res: Response) {
  const { id } = req.params;
  const { teamId } = req.body as { teamId?: string };
  if (!teamId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "teamId is required to promote to captain" });
  }

  const user = await User.findById(id);
  if (!user)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });

  const team = await Team.findById(teamId);
  if (!team)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });

  // Assign captain role and team
  user.role = "captain";
  user.teamId = teamId;
  await user.save();

  // Update team captain fields
  team.captainId = user.id;
  team.captain = user.name;
  await team.save();

  return res.status(StatusCodes.OK).json({
    user: { id: user.id, name: user.name, role: user.role },
    team: { id: team.id, name: team.name },
  });
}
