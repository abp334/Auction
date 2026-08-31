/**
 * Upload demo player/team images to Supabase Storage and rewrite sample CSVs.
 * Run: npx tsx scripts/seed-demo-media.ts
 */
import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { uploadAuctionMedia } from "../src/utils/supabaseStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(__dirname, "../../samples");

const teams = [
  { name: "Chennai Super Kings", captain: "MS Dhoni", wallet: 100000000, owner: "India Cements", seed: "csk" },
  { name: "Mumbai Indians", captain: "Rohit Sharma", wallet: 100000000, owner: "Reliance", seed: "mi" },
  { name: "Royal Challengers Bangalore", captain: "Virat Kohli", wallet: 100000000, owner: "United Spirits", seed: "rcb" },
  { name: "Kolkata Knight Riders", captain: "Shreyas Iyer", wallet: 100000000, owner: "Knight Riders Group", seed: "kkr" },
  { name: "Delhi Capitals", captain: "Rishabh Pant", wallet: 100000000, owner: "GMR-JSW", seed: "dc" },
];

const first = [
  "Aarav","Vihaan","Aditya","Vivaan","Arjun","Sai","Reyansh","Ayaan","Krishna","Ishaan",
  "Shaurya","Atharv","Advik","Pranav","Rudra","Kabir","Yuvan","Dhruv","Ansh","Om",
  "Rohan","Karan","Nikhil","Suresh","Rahul","Amit","Vikram","Sanjay","Deepak","Manish",
  "Harsh","Yash","Kunal","Varun","Siddharth","Abhinav","Gaurav","Neel","Parth","Dev",
  "Ishan","Jai","Laksh","Milan","Naveen","Piyush","Ritesh","Samar","Tanmay","Uday",
  "Veer","Wasim","Yuvraj","Zayan","Aniket","Bhavesh","Chirag","Darshan","Eshan","Farhan",
];
const last = [
  "Sharma","Patel","Reddy","Singh","Kumar","Gupta","Mehta","Joshi","Nair","Iyer",
  "Chopra","Malhotra","Kapoor","Verma","Shah","Desai","Bose","Rao","Pillai","Khan",
  "Saxena","Agarwal","Bhat","Menon","Das","Chatterjee","Pandey","Mishra","Jain","Trivedi",
];
const rolesCycle: Array<[string, string, string]> = [
  ["Batsman", "Right-Hand Batsman", "N/A"],
  ["Bowler", "N/A", "Right Arm Fast"],
  ["All-Rounder", "Right-Hand Batsman", "Right Arm Medium Fast"],
  ["Wicketkeeper-Batsman", "Left-Hand Batsman", "N/A"],
  ["Batsman", "Left-Hand Batsman", "N/A"],
  ["Bowler", "N/A", "Left Arm Orthodox"],
  ["All-Rounder", "Left-Hand Batsman", "Left Arm Fast"],
  ["Bowler", "N/A", "Right Arm Leg Spin"],
  ["Batsman", "Right-Hand Batsman", "N/A"],
  ["All-Rounder", "Right-Hand Batsman", "Right Arm Off Spin"],
];
const bowlAlts = [
  "Right Arm Fast", "Right Arm Medium Fast", "Right Arm Medium",
  "Left Arm Fast", "Left Arm Medium", "Right Arm Off Spin",
  "Right Arm Leg Spin", "Left Arm Orthodox", "Left Arm Chinaman",
];

async function fetchPng(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log("Uploading 5 team logos + 60 player photos to Supabase…");
  await mkdir(samplesDir, { recursive: true });

  const teamRows: string[] = ["name,captain,wallet,owner,logo"];
  for (const t of teams) {
    const src = `https://api.dicebear.com/7.x/shapes/png?seed=${t.seed}&size=256`;
    const buf = await fetchPng(src);
    const url = await uploadAuctionMedia({
      kind: "team",
      buffer: buf,
      contentType: "image/png",
    });
    console.log("team", t.name, "→", url);
    teamRows.push(
      [t.name, t.captain, t.wallet, t.owner, url].map(csvEscape).join(",")
    );
  }

  const playerRows: string[] = [
    "name,role,baseprice,age,batsmanType,bowlerType,mobile,email,photo",
  ];
  for (let i = 0; i < 60; i++) {
    const name = `${first[i]} ${last[i % last.length]}`;
    let [role, bat, bowl] = rolesCycle[i % rolesCycle.length];
    if (role === "Bowler") bat = "N/A";
    if (role !== "Bowler" && role !== "All-Rounder") bowl = "N/A";
    if (role === "Bowler" && bowl === "N/A") bowl = bowlAlts[i % bowlAlts.length];
    const base = 1000 + (i % 12) * 250;
    const age = 19 + (i % 16);
    const seed = `player${String(i + 1).padStart(2, "0")}`;
    const src = `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}&size=400`;
    const buf = await fetchPng(src);
    const url = await uploadAuctionMedia({
      kind: "player",
      buffer: buf,
      contentType: "image/png",
    });
    console.log(`player ${i + 1}/60`, name);
    playerRows.push(
      [name, role, base, age, bat, bowl, "", "", url].map(csvEscape).join(",")
    );
  }

  const teamsPath = path.join(samplesDir, "demo_static_teams_5.csv");
  const playersPath = path.join(samplesDir, "demo_static_players_60.csv");
  await writeFile(teamsPath, teamRows.join("\n") + "\n", "utf8");
  await writeFile(playersPath, playerRows.join("\n") + "\n", "utf8");
  console.log("Wrote", teamsPath);
  console.log("Wrote", playersPath);
  console.log("Done — all photo/logo URLs are on your Supabase bucket.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
