import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Play,
  Pause,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Users,
  Trophy,
  Plus,
  Trash2,
  Image as ImageIcon,
  Download,
  Pencil,
  StopCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { parseCSV, jsonToCSV } from "@/lib/utils";
import AuctionRoom from "@/components/auction/AuctionRoom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PLAYER_ROLES = [
  "Batsman",
  "Bowler",
  "All-Rounder",
  "Wicketkeeper-Batsman",
];

const BATTING_TYPES = ["Right-Hand Batsman", "Left-Hand Batsman"];

const BOWLING_TYPES = [
  "None",
  "Right Arm Fast",
  "Right Arm Medium Fast",
  "Right Arm Medium",
  "Left Arm Fast",
  "Left Arm Medium Fast",
  "Left Arm Medium",
  "Right Arm Off Spin",
  "Right Arm Leg Spin",
  "Left Arm Orthodox",
  "Left Arm Chinaman",
  "Left Arm Wrist Spin",
];

const needsBattingType = (role: string) =>
  ["Batsman", "All-Rounder", "Wicketkeeper-Batsman"].includes(role);

const needsBowlingType = (role: string) =>
  ["Bowler", "All-Rounder"].includes(role);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d][\d\s-]{6,14}$/;

const isValidEmail = (value: string) => EMAIL_REGEX.test(String(value || "").trim());
const isValidPhone = (value: string) => PHONE_REGEX.test(String(value || "").trim());

const noop = () => undefined;

const AuctionTab = () => {
  const { toast } = useToast();
  const [currentAuction, setCurrentAuction] = useState<any>(null);
  const [auctionName, setAuctionName] = useState("");

  // Lists of data to be submitted (Unified arrays for CSV + Manual)
  const [teamsData, setTeamsData] = useState<any[]>([]);
  const [playersData, setPlayersData] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Manual Dialog States
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);

  // Edit mode: index of the staged item being edited (null = adding new)
  const [editTeamIndex, setEditTeamIndex] = useState<number | null>(null);
  const [editPlayerIndex, setEditPlayerIndex] = useState<number | null>(null);

  const emptyTeamForm = {
    name: "",
    wallet: 10000000,
    owner: "",
    code: "",
    logo: "🏆",
    captain: "",
    captainEmail: "",
  };
  const emptyPlayerForm = {
    name: "",
    role: "",
    basePrice: 1000,
    age: 25,
    batsmanType: "Right-Hand Batsman",
    bowlerType: "None",
    mobile: "",
    email: "",
    photo: "",
  };

  // Manual Form States
  const [teamForm, setTeamForm] = useState({ ...emptyTeamForm });
  const [playerForm, setPlayerForm] = useState({ ...emptyPlayerForm });

  // Check for active auction on load
  useEffect(() => {
    const checkActive = async () => {
      const res = await apiFetch("/auctions");
      if (res.ok) {
        const { auctions } = await res.json();
        const active = auctions.find(
          (a: any) =>
            a.state === "active" || a.state === "draft" || a.state === "paused"
        );
        if (active) setCurrentAuction(active);
      }
    };
    checkActive();
  }, []);

  // Poll lightweight live snapshot when auction is running (full fetch only on setup)
  useEffect(() => {
    if (!currentAuction || currentAuction.state === "completed") return;
    const aId = currentAuction.id;
    const useLivePoll =
      currentAuction.state === "active" || currentAuction.state === "paused";

    const poll = async () => {
      const path = useLivePoll ? `/auctions/${aId}/live` : `/auctions/${aId}`;
      const res = await apiFetch(path);
      if (!res.ok) return;
      const data = await res.json();
      if (useLivePoll && data.live) {
        setCurrentAuction((prev: any) => ({
          ...prev,
          ...data.live,
          sales: data.live.sales || prev?.sales || [],
          unsoldPlayers: Array.from({ length: data.live.unsoldCount || 0 }),
        }));
      } else if (data.auction) {
        setCurrentAuction(data.auction);
      }
    };

    poll();
    const interval = setInterval(poll, useLivePoll ? 10000 : 5000);
    return () => clearInterval(interval);
  }, [currentAuction?.id, currentAuction?.state]);

  // Gallery Image Handler (Converts file to Base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPlayerForm((prev) => ({ ...prev, photo: reader.result as string }));
        toast({
          title: "Image Uploaded",
          description: "Player photo is ready.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCsvUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "teams" | "players"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) throw new Error("Empty file");

        if (type === "teams") {
          const mappedTeams = parsed.map((p) => ({
            name: p.name || p.team || p["team name"] || "New Team",
            wallet: Number(p.wallet || 10000000),
            owner: p.owner || "Owner",
            logo: p.logo || "🏆",
            captain: p.captain || p["captain name"] || "",
            captainEmail: p.email || p["captain email"] || "",
          }));
          const invalidEmails = mappedTeams.filter(
            (t) => !isValidEmail(t.captainEmail)
          );
          if (invalidEmails.length > 0) {
            toast({
              title: "Invalid Captain Email",
              description: `${invalidEmails.length} team row(s) are missing a valid captain email. Each team needs a valid email to auto-create the captain's login.`,
              variant: "destructive",
            });
            return;
          }
          setTeamsData((prev) => [...prev, ...mappedTeams]);
        } else {
          const rowsMissingRole = parsed.filter((p) => !String(p.role || "").trim());
          if (rowsMissingRole.length > 0) {
            toast({
              title: "Missing Player Roles",
              description: "Every player row must include a role.",
              variant: "destructive",
            });
            return;
          }
          // Treat "N/A" (used for not-applicable batting/bowling) as empty.
          const cleanNA = (value: any) => {
            const s = String(value ?? "").trim();
            return s.toUpperCase() === "N/A" ? "" : s;
          };
          const mappedPlayers = parsed.map((p) => ({
            name: p.name || "Unknown Player",
            role: String(p.role).trim(),
            basePrice: Number(p.baseprice || p.price || 1000),
            age: Number(p.age || 25),
            photo: p.photo || "",
            batsmanType: cleanNA(p.batsmantype || p.battingtype || p.batting),
            bowlerType:
              cleanNA(p.bowlertype || p.bowlingtype || p.bowling) || "None",
            mobile: p.mobile || "",
            email: p.email || "",
          }));
          const invalidEmails = mappedPlayers.filter(
            (p) => !isValidEmail(p.email)
          );
          if (invalidEmails.length > 0) {
            toast({
              title: "Invalid Player Email",
              description: `${invalidEmails.length} player row(s) are missing a valid email. Each player needs a valid email to auto-create their login.`,
              variant: "destructive",
            });
            return;
          }
          const invalidMobiles = mappedPlayers.filter(
            (p) => p.mobile && !isValidPhone(p.mobile)
          );
          if (invalidMobiles.length > 0) {
            toast({
              title: "Invalid Mobile Number",
              description: `${invalidMobiles.length} player row(s) have an invalid mobile number.`,
              variant: "destructive",
            });
            return;
          }
          setPlayersData((prev) => [...prev, ...mappedPlayers]);
        }
        toast({
          title: "Success",
          description: `Imported data from ${file.name}`,
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to parse CSV.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleCSV = (type: "teams" | "players") => {
    const sample =
      type === "teams"
        ? [
            {
              name: "Chennai Super Kings",
              captain: "MS Dhoni",
              wallet: 10000000,
              owner: "Owner Name",
              logo: "🦁",
              email: "captain.csk@example.com",
            },
            {
              name: "Mumbai Indians",
              captain: "Rohit Sharma",
              wallet: 10000000,
              owner: "Owner Name",
              logo: "🔵",
              email: "captain.mi@example.com",
            },
          ]
        : [
            {
              name: "Het Shah",
              role: "Batsman",
              baseprice: 1000,
              age: 25,
              batsmanType: "Right-Hand Batsman",
              bowlerType: "N/A",
              mobile: "9876543210",
              email: "het.shah@example.com",
              photo: "https://example.com/het.jpg",
            },
            {
              name: "Ravi Kumar",
              role: "Bowler",
              baseprice: 1500,
              age: 28,
              batsmanType: "N/A",
              bowlerType: "Right Arm Fast",
              mobile: "9876500000",
              email: "ravi.kumar@example.com",
              photo: "",
            },
            {
              name: "Arjun Mehta",
              role: "All-Rounder",
              baseprice: 2000,
              age: 26,
              batsmanType: "Left-Hand Batsman",
              bowlerType: "Left Arm Orthodox",
              mobile: "9870000000",
              email: "arjun.mehta@example.com",
              photo: "",
            },
          ];

    const csvContent = jsonToCSV(sample);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Sample Downloaded",
      description: `Edit sample_${type}.csv and upload it in the "Upload ${
        type === "teams" ? "Teams" : "Players"
      } CSV" box.`,
    });
  };

  const createAndStartAuction = async () => {
    if (!auctionName || teamsData.length < 2 || playersData.length === 0) {
      toast({
        title: "Validation Error",
        description:
          "Ensure you have a tournament name, 2+ teams, and players.",
        variant: "destructive",
      });
      return;
    }
    if (playersData.some((player) => !String(player.role || "").trim())) {
      toast({
        title: "Validation Error",
        description: "Every player must have a role before creating an auction.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/auctions", {
        method: "POST",
        body: JSON.stringify({
          name: auctionName,
          teams: teamsData,
          players: playersData,
        }),
      });
      if (res.ok) {
        const { auction } = await res.json();
        setCurrentAuction(auction);
        toast({
          title: "Success",
          description: "Auction initialized! Captains can now join.",
        });
      } else {
        const err = await res.json();
        toast({
          title: "Error",
          description: err.error,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to create auction",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const formatINR = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  const generateCSV = (report: any) => {
    const flatReport: any[] = [];
    report.teams.forEach((t: any) => {
      t.Roster.forEach((p: any) => {
        flatReport.push({
          Status: "SOLD",
          Team: t.TeamName,
          Captain: t.Captain,
          Player: p.Name,
          Role: p.Role,
          BasePrice: p.BasePrice || p.SoldPrice,
          SoldPrice: p.SoldPrice || p.Price,
        });
      });
    });
    report.unsold.forEach((p: any) => {
      flatReport.push({
        Status: "UNSOLD",
        Team: "-",
        Captain: "-",
        Player: p.Name,
        Role: p.Role,
        BasePrice: p.BasePrice,
        SoldPrice: 0,
      });
    });

    const csvContent = jsonToCSV(flatReport);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Results_${(report.auctionName || auctionName).replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatePDF = (report: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const name = report.auctionName || auctionName || "Auction";
    const dateStr = new Date(report.date || Date.now()).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const totalSold = report.summary?.totalSold ?? report.teams.reduce((s: number, t: any) => s + (t.Roster?.length || 0), 0);
    const totalUnsold = report.summary?.totalUnsold ?? (report.unsold?.length || 0);
    const totalPlayers = totalSold + totalUnsold;
    const totalSpent = report.summary?.totalSpent ?? report.teams.reduce((s: number, t: any) => s + (t.TotalSpent || 0), 0);
    const totalBids = report.summary?.totalBids ?? 0;
    const highestSale = report.summary?.highestSale;

    // Colors
    const amber = [245, 158, 11];
    const dark = [15, 20, 25];
    const darkCard = [26, 35, 50];
    const green = [34, 197, 94];
    const red = [239, 68, 68];
    const blue = [59, 130, 246];
    const purple = [168, 85, 247];
    const gray = [156, 163, 175];

    // Team colors for charts
    const teamColors = [
      [245, 158, 11], [59, 130, 246], [34, 197, 94], [168, 85, 247],
      [236, 72, 153], [20, 184, 166], [249, 115, 22], [99, 102, 241],
    ];

    // ===== PAGE 1: COVER + SUMMARY =====

    // Dark background header
    doc.setFillColor(dark[0], dark[1], dark[2]);
    doc.rect(0, 0, pageWidth, 55, "F");

    // Accent bar
    doc.setFillColor(amber[0], amber[1], amber[2]);
    doc.rect(0, 55, pageWidth, 3, "F");

    // Title on dark bg
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text(name, 14, 25);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(amber[0], amber[1], amber[2]);
    doc.text("AUCTION REPORT", 14, 35);

    doc.setTextColor(180, 180, 180);
    doc.setFontSize(10);
    doc.text(dateStr, 14, 45);

    // Summary stat cards
    let y = 70;
    const cardW = (pageWidth - 42) / 4;
    const cardH = 28;
    const stats = [
      { label: "Total Players", value: String(totalPlayers), color: amber },
      { label: "Sold", value: String(totalSold), color: green },
      { label: "Unsold", value: String(totalUnsold), color: red },
      { label: "Total Bids", value: String(totalBids), color: blue },
    ];

    stats.forEach((stat, i) => {
      const x = 14 + i * (cardW + 4);
      doc.setFillColor(darkCard[0], darkCard[1], darkCard[2]);
      doc.roundedRect(x, y, cardW, cardH, 3, 3, "F");
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
      doc.text(stat.value, x + cardW / 2, y + 13, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text(stat.label.toUpperCase(), x + cardW / 2, y + 22, { align: "center" });
    });

    // Total Spent + Highest Sale row
    y += cardH + 10;
    doc.setFillColor(darkCard[0], darkCard[1], darkCard[2]);
    doc.roundedRect(14, y, pageWidth - 28, 22, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text("TOTAL SPENT", 22, y + 9);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(amber[0], amber[1], amber[2]);
    doc.text(formatINR(totalSpent), 22, y + 17);

    if (highestSale) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text("HIGHEST SALE", pageWidth / 2 + 10, y + 9);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(green[0], green[1], green[2]);
      doc.text(
        `${highestSale.playerName} → ${highestSale.teamName} (${formatINR(highestSale.price)})`,
        pageWidth / 2 + 10,
        y + 17
      );
    }

    // ===== TEAM SPENDING BAR CHART =====
    y += 35;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text("Team Spending Comparison", 14, y);
    y += 8;

    const maxSpent = Math.max(...report.teams.map((t: any) => t.TotalSpent || 0), 1);
    const barMaxWidth = pageWidth - 80;
    const barH = 10;
    const barGap = 4;

    report.teams.forEach((team: any, i: number) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const color = teamColors[i % teamColors.length];
      const barWidth = Math.max(((team.TotalSpent || 0) / maxSpent) * barMaxWidth, 2);

      // Team name
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 50, 50);
      const truncatedName = team.TeamName.length > 12 ? team.TeamName.substring(0, 12) + "…" : team.TeamName;
      doc.text(truncatedName, 14, y + barH / 2 + 1);

      // Bar background
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(55, y, barMaxWidth, barH, 2, 2, "F");

      // Bar fill
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(55, y, barWidth, barH, 2, 2, "F");

      // Value label
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(formatINR(team.TotalSpent || 0), 55 + barMaxWidth + 3, y + barH / 2 + 1);

      y += barH + barGap;
    });

    // ===== PIE CHART: Sold vs Unsold =====
    y += 10;
    if (y > 210) { doc.addPage(); y = 20; }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text("Player Auction Outcome", 14, y);
    y += 5;

    const pieX = 50;
    const pieY = y + 30;
    const pieR = 25;

    if (totalPlayers > 0) {
      const soldAngle = (totalSold / totalPlayers) * 2 * Math.PI;

      // Draw sold segment (green)
      doc.setFillColor(green[0], green[1], green[2]);
      drawPieSlice(doc, pieX, pieY, pieR, 0, soldAngle);

      // Draw unsold segment (red)
      if (totalUnsold > 0) {
        doc.setFillColor(red[0], red[1], red[2]);
        drawPieSlice(doc, pieX, pieY, pieR, soldAngle, 2 * Math.PI);
      }

      // Center circle (donut effect)
      doc.setFillColor(255, 255, 255);
      doc.circle(pieX, pieY, pieR * 0.55, "F");

      // Center text
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text(`${Math.round((totalSold / totalPlayers) * 100)}%`, pieX, pieY + 2, { align: "center" });
      doc.setFontSize(6);
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text("SOLD", pieX, pieY + 7, { align: "center" });

      // Legend
      const legendX = pieX + pieR + 20;
      doc.setFillColor(green[0], green[1], green[2]);
      doc.circle(legendX, pieY - 6, 3, "F");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.text(`Sold: ${totalSold} players`, legendX + 6, pieY - 4);

      doc.setFillColor(red[0], red[1], red[2]);
      doc.circle(legendX, pieY + 6, 3, "F");
      doc.text(`Unsold: ${totalUnsold} players`, legendX + 6, pieY + 8);
    }

    y = pieY + pieR + 15;

    // ===== PAGE 2+: TEAM ROSTERS =====
    doc.addPage();
    y = 15;

    // Section header
    doc.setFillColor(dark[0], dark[1], dark[2]);
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setFillColor(amber[0], amber[1], amber[2]);
    doc.rect(0, 20, pageWidth, 2, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Team Rosters", 14, 14);
    y = 30;

    report.teams.forEach((team: any, tIdx: number) => {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      const color = teamColors[tIdx % teamColors.length];

      // Team header card
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(team.TeamName, 20, y + 7);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Captain: ${team.Captain}  |  Players: ${team.PlayersCount}  |  Spent: ${formatINR(team.TotalSpent)}  |  Purse Left: ${formatINR(team.RemainingPurse)}`,
        20,
        y + 13
      );
      y += 20;

      if (team.Roster && team.Roster.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["#", "Player", "Role", "Sold Price"]],
          body: team.Roster.map((p: any, idx: number) => [
            String(idx + 1),
            p.Name,
            p.Role || "-",
            formatINR(p.SoldPrice || p.Price || 0),
          ]),
          theme: "grid",
          headStyles: {
            fillColor: [color[0], color[1], color[2]],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 8,
          },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            3: { halign: "right", fontStyle: "bold" },
          },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      } else {
        doc.setFontSize(9);
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.text("No players acquired.", 20, y + 4);
        y += 12;
      }
    });

    // Unsold players section
    if (report.unsold && report.unsold.length > 0) {
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      // Unsold header
      doc.setFillColor(red[0], red[1], red[2]);
      doc.roundedRect(14, y, pageWidth - 28, 12, 2, 2, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`Unsold Players (${report.unsold.length})`, 20, y + 8);
      y += 16;

      autoTable(doc, {
        startY: y,
        head: [["#", "Player", "Role", "Base Price"]],
        body: report.unsold.map((p: any, idx: number) => [
          String(idx + 1),
          p.Name,
          p.Role || "-",
          formatINR(p.BasePrice || 0),
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [red[0], red[1], red[2]],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          3: { halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer on every page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text(
        `Generated by ClashBid • Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    }

    doc.save(`${name.replace(/\s+/g, "_")}_Report.pdf`);
  };

  function drawPieSlice(doc: jsPDF, cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const steps = 50;
    const angleStep = (endAngle - startAngle) / steps;
    // Build points array: center, arc points, back to center
    const points: [number, number][] = [[cx, cy]];
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + i * angleStep - Math.PI / 2;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    points.push([cx, cy]);

    // Convert to PDF coordinates and draw filled polygon via raw PDF operators
    const pageH = doc.internal.pageSize.getHeight();
    const k = 72 / 25.4; // mm to points
    const pdfPoints = points.map((p) => [p[0] * k, (pageH - p[1]) * k] as [number, number]);
    const pathOps = pdfPoints
      .map((p, i) => `${p[0].toFixed(2)} ${p[1].toFixed(2)} ${i === 0 ? "m" : "l"}`)
      .join(" ");
    (doc as any).internal.out(pathOps + " f");
  }

  const downloadCSV = async () => {
    if (!currentAuction) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/auctions/${currentAuction.id}/report`);
      if (res.ok) {
        const { report } = await res.json();
        generateCSV(report);
        toast({ title: "CSV Downloaded", description: "Results exported." });
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!currentAuction) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/auctions/${currentAuction.id}/report`);
      if (res.ok) {
        const { report } = await res.json();
        generatePDF(report);
        toast({ title: "PDF Downloaded", description: "Full report exported." });
      }
    } finally {
      setLoading(false);
    }
  };

  const closeAndWipe = async () => {
    if (!currentAuction) return;
    setShowEndConfirm(false);
    setLoading(true);
    try {
      const aId = currentAuction.id;
      // Fetch report before closing (for PDF + CSV)
      const reportRes = await apiFetch(`/auctions/${aId}/report`);
      let report: any = null;
      if (reportRes.ok) {
        const data = await reportRes.json();
        report = data.report;
      }

      const res = await apiFetch(`/auctions/${aId}/close`, {
        method: "POST",
      });
      if (res.ok) {
        // Use the pre-fetched report (close endpoint wipes data)
        if (report) {
          generateCSV(report);
          generatePDF(report);
        } else {
          // Fallback: use whatever close returns
          const { report: closeReport } = await res.json();
          if (closeReport) generateCSV(closeReport);
        }

        setCurrentAuction(null);
        setTeamsData([]);
        setPlayersData([]);
        setAuctionName("");
        toast({
          title: "Auction Closed",
          description: "PDF & CSV saved. Data wiped.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const startAuction = async () => {
    const aId = currentAuction.id;
    setLoading(true);
    await apiFetch(`/auctions/${aId}/start`, { method: "POST" });
    setLoading(false);
  };

  const pauseAuction = async () => {
    const aId = currentAuction.id;
    setLoading(true);
    await apiFetch(`/auctions/${aId}/pause`, { method: "POST" });
    setLoading(false);
  };

  const resumeAuction = async () => {
    const aId = currentAuction.id;
    setLoading(true);
    await apiFetch(`/auctions/${aId}/resume`, { method: "POST" });
    setLoading(false);
  };

  const copyRoomCode = () => {
    if (currentAuction?.roomCode) {
      navigator.clipboard.writeText(currentAuction.roomCode);
      toast({ title: "Copied!", description: "Room code copied to clipboard" });
    }
  };

  return (
    <div className="space-y-6">
      {!currentAuction ? (
        // SETUP INTERFACE
        <Card className="border-amber-500/30 bg-[#1a2332]">
          <CardHeader>
            <CardTitle className="text-white">New Auction Session</CardTitle>
            <CardDescription className="text-gray-400">
              Configure tournament manually or via CSV.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-white">Tournament Name</Label>
              <Input
                value={auctionName}
                onChange={(e) => setAuctionName(e.target.value)}
                placeholder="e.g. Premier League 2025"
                className="bg-[#0f1419] border-white/20 text-white"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* TEAMS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" /> Teams (
                    {teamsData.length})
                  </h3>
                  <Dialog
                    open={isTeamDialogOpen}
                    onOpenChange={(open) => {
                      setIsTeamDialogOpen(open);
                      if (!open) {
                        setEditTeamIndex(null);
                        setTeamForm({ ...emptyTeamForm });
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                        onClick={() => {
                          setEditTeamIndex(null);
                          setTeamForm({ ...emptyTeamForm });
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Manual
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a2332] text-white border-white/10 max-w-lg">
                      <DialogHeader>
                        <DialogTitle>
                          {editTeamIndex !== null
                            ? "Edit Team"
                            : "Add Team Manually"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Team Name</Label>
                          <Input
                            placeholder="e.g. Mumbai Indians"
                            value={teamForm.name}
                            onChange={(e) =>
                              setTeamForm({ ...teamForm, name: e.target.value })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Budget (₹)</Label>
                          <Input
                            type="number"
                            value={teamForm.wallet}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                wallet: Number(e.target.value),
                              })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                        {/* NEW FIELD: Captain Name */}
                        <div className="space-y-2">
                          <Label>Captain Name</Label>
                          <Input
                            placeholder="e.g. Rohit Sharma"
                            value={teamForm.captain}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                captain: e.target.value,
                              })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                        {/* CRITICAL: Captain Email for Auth */}
                        <div className="space-y-2">
                          <Label>Captain Email (For Login)</Label>
                          <Input
                            type="email"
                            placeholder="captain@example.com"
                            value={teamForm.captainEmail}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                captainEmail: e.target.value,
                              })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label>Owner Name</Label>
                          <Input
                            placeholder="Owner Name"
                            value={teamForm.owner}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                owner: e.target.value,
                              })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full bg-amber-500 text-black font-bold"
                        disabled={!teamForm.name || !teamForm.captainEmail}
                        onClick={() => {
                          if (!teamForm.name.trim()) {
                            toast({
                              title: "Team Name Required",
                              description: "Please enter a team name.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (!isValidEmail(teamForm.captainEmail)) {
                            toast({
                              title: "Invalid Captain Email",
                              description:
                                "Enter a valid captain email. It is used to auto-create the captain's login.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (editTeamIndex !== null) {
                            setTeamsData(
                              teamsData.map((t, idx) =>
                                idx === editTeamIndex ? teamForm : t
                              )
                            );
                            toast({
                              title: "Team Updated",
                              description: "Team details saved.",
                            });
                          } else {
                            setTeamsData([...teamsData, teamForm]);
                            toast({
                              title: "Team Added",
                              description:
                                "Team and Captain staged for creation.",
                            });
                          }
                          setTeamForm({ ...emptyTeamForm });
                          setEditTeamIndex(null);
                          setIsTeamDialogOpen(false);
                        }}
                      >
                        {editTeamIndex !== null
                          ? "Save Changes"
                          : "Add to Staging List"}
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center ${
                    teamsData.length > 0
                      ? "border-green-500/30"
                      : "border-white/10"
                  }`}
                >
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleCsvUpload(e, "teams")}
                    className="hidden"
                    id="teams-upload"
                  />
                  <Label
                    htmlFor="teams-upload"
                    className="cursor-pointer text-xs text-gray-400 block mb-2"
                  >
                    Or Upload Teams CSV
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      downloadSampleCSV("teams");
                    }}
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-xs mb-2"
                  >
                    <Download className="w-3 h-3 mr-1" /> Download Sample CSV
                  </Button>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {teamsData.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white/5 p-2 rounded text-[10px] text-gray-300"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{t.name}</span>
                          <span className="opacity-60">
                            {t.captainEmail ||
                              "No Email (No User will be created)"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Pencil
                            className="w-3 h-3 text-amber-400 cursor-pointer"
                            onClick={() => {
                              setTeamForm({ ...emptyTeamForm, ...t });
                              setEditTeamIndex(i);
                              setIsTeamDialogOpen(true);
                            }}
                          />
                          <Trash2
                            className="w-3 h-3 text-red-500 cursor-pointer"
                            onClick={() =>
                              setTeamsData(
                                teamsData.filter((_, idx) => idx !== i)
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PLAYERS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" /> Players (
                    {playersData.length})
                  </h3>
                  <Dialog
                    open={isPlayerDialogOpen}
                    onOpenChange={(open) => {
                      setIsPlayerDialogOpen(open);
                      if (!open) {
                        setEditPlayerIndex(null);
                        setPlayerForm({ ...emptyPlayerForm });
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                        onClick={() => {
                          setEditPlayerIndex(null);
                          setPlayerForm({ ...emptyPlayerForm });
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Manual
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a2332] text-white border-white/10 max-w-xl">
                      <DialogHeader>
                        <DialogTitle>
                          {editPlayerIndex !== null
                            ? "Edit Player"
                            : "Add Player Manually"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2 flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                            {playerForm.photo ? (
                              <img
                                src={playerForm.photo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="text-gray-600" />
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="bg-[#0f1419] border-white/20 text-xs"
                          />
                        </div>
                        <Input
                          placeholder="Player Name"
                          value={playerForm.name}
                          onChange={(e) =>
                            setPlayerForm({
                              ...playerForm,
                              name: e.target.value,
                            })
                          }
                          className="bg-[#0f1419]"
                        />
                        <Input
                          placeholder="Price"
                          type="number"
                          value={playerForm.basePrice}
                          onChange={(e) =>
                            setPlayerForm({
                              ...playerForm,
                              basePrice: Number(e.target.value),
                            })
                          }
                          className="bg-[#0f1419]"
                        />
                        <Input
                          placeholder="Age"
                          type="number"
                          value={playerForm.age}
                          onChange={(e) =>
                            setPlayerForm({
                              ...playerForm,
                              age: Number(e.target.value),
                            })
                          }
                          className="bg-[#0f1419]"
                        />
                        <Input
                          placeholder="Mobile (optional)"
                          value={playerForm.mobile}
                          onChange={(e) =>
                            setPlayerForm({
                              ...playerForm,
                              mobile: e.target.value,
                            })
                          }
                          className="bg-[#0f1419]"
                        />
                        <Input
                          placeholder="Email (required for login)"
                          type="email"
                          value={playerForm.email}
                          onChange={(e) =>
                            setPlayerForm({
                              ...playerForm,
                              email: e.target.value,
                            })
                          }
                          className="bg-[#0f1419]"
                        />
                        <Select
                          value={playerForm.role}
                          onValueChange={(v) =>
                            setPlayerForm({
                              ...playerForm,
                              role: v,
                              batsmanType: needsBattingType(v)
                                ? playerForm.batsmanType || "Right-Hand Batsman"
                                : "",
                              bowlerType: needsBowlingType(v)
                                ? playerForm.bowlerType === "None"
                                  ? "Right Arm Medium Fast"
                                  : playerForm.bowlerType
                                : "None",
                            })
                          }
                        >
                          <SelectTrigger className="bg-[#0f1419]">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLAYER_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {needsBattingType(playerForm.role) && (
                          <Select
                            value={playerForm.batsmanType}
                            onValueChange={(v) =>
                              setPlayerForm({ ...playerForm, batsmanType: v })
                            }
                          >
                            <SelectTrigger className="bg-[#0f1419]">
                              <SelectValue placeholder="Batting type" />
                            </SelectTrigger>
                            <SelectContent>
                              {BATTING_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {needsBowlingType(playerForm.role) && (
                          <Select
                            value={playerForm.bowlerType}
                            onValueChange={(v) =>
                              setPlayerForm({ ...playerForm, bowlerType: v })
                            }
                          >
                            <SelectTrigger className="bg-[#0f1419]">
                              <SelectValue placeholder="Bowling type" />
                            </SelectTrigger>
                            <SelectContent>
                              {BOWLING_TYPES.filter((type) => type !== "None").map(
                                (type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <Button
                        className="w-full bg-amber-500 text-black font-bold"
                        disabled={
                          !playerForm.name.trim() ||
                          !playerForm.role ||
                          (needsBattingType(playerForm.role) &&
                            !playerForm.batsmanType) ||
                          (needsBowlingType(playerForm.role) &&
                            (!playerForm.bowlerType ||
                              playerForm.bowlerType === "None"))
                        }
                        onClick={() => {
                          if (!playerForm.name.trim()) {
                            toast({
                              title: "Player Name Required",
                              description: "Please enter the player's name.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (!isValidEmail(playerForm.email)) {
                            toast({
                              title: "Invalid Player Email",
                              description:
                                "Enter a valid email. It is used to auto-create the player's login.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (
                            playerForm.mobile &&
                            !isValidPhone(playerForm.mobile)
                          ) {
                            toast({
                              title: "Invalid Mobile Number",
                              description:
                                "Enter a valid mobile number, or leave it blank.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (editPlayerIndex !== null) {
                            setPlayersData(
                              playersData.map((p, idx) =>
                                idx === editPlayerIndex ? playerForm : p
                              )
                            );
                            toast({
                              title: "Player Updated",
                              description: "Player details saved.",
                            });
                          } else {
                            setPlayersData([...playersData, playerForm]);
                          }
                          setPlayerForm({ ...emptyPlayerForm });
                          setEditPlayerIndex(null);
                          setIsPlayerDialogOpen(false);
                        }}
                      >
                        {editPlayerIndex !== null ? "Save Changes" : "Add to List"}
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center ${
                    playersData.length > 0
                      ? "border-green-500/30"
                      : "border-white/10"
                  }`}
                >
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleCsvUpload(e, "players")}
                    className="hidden"
                    id="players-upload"
                  />
                  <Label
                    htmlFor="players-upload"
                    className="cursor-pointer text-xs text-gray-400 block mb-2"
                  >
                    Or Upload Players CSV
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      downloadSampleCSV("players");
                    }}
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-xs mb-2"
                  >
                    <Download className="w-3 h-3 mr-1" /> Download Sample CSV
                  </Button>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {playersData.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white/5 p-2 rounded text-[10px] text-gray-300"
                      >
                        <span>
                          {p.name} <span className="text-amber-400">({p.role})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <Pencil
                            className="w-3 h-3 text-amber-400 cursor-pointer"
                            onClick={() => {
                              setPlayerForm({ ...emptyPlayerForm, ...p });
                              setEditPlayerIndex(i);
                              setIsPlayerDialogOpen(true);
                            }}
                          />
                          <Trash2
                            className="w-3 h-3 text-red-500 cursor-pointer"
                            onClick={() =>
                              setPlayersData(
                                playersData.filter((_, idx) => idx !== i)
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={createAndStartAuction}
              disabled={
                !auctionName ||
                teamsData.length === 0 ||
                playersData.length === 0 ||
                loading
              }
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 text-lg shadow-lg shadow-amber-900/20"
            >
              {loading ? "Initializing..." : "Create Auction Room"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        // ACTIVE AUCTION CONTROL UI (THIS WAS MISSING BEFORE)
        <>
        <Card className="border-green-500/30 bg-[#1a2332]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-6">
            <div>
              <CardTitle className="text-white text-2xl">
                {currentAuction.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    currentAuction.state === "active"
                      ? "bg-green-500 animate-pulse"
                      : "bg-yellow-500"
                  }`}
                />
                <span className="text-sm text-gray-300 capitalize">
                  {currentAuction.state}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase mb-1 tracking-wider">
                Room Code
              </p>
              <div className="flex items-center gap-2 bg-[#0f1419] px-3 py-1.5 rounded border border-white/10">
                <span className="text-2xl font-mono text-amber-500 font-bold">
                  {currentAuction.roomCode}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white"
                  onClick={copyRoomCode}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentAuction.state === "draft" ? (
                <Button
                  onClick={startAuction}
                  className="bg-green-600 hover:bg-green-700 h-16 text-xl font-bold"
                >
                  <Play className="mr-3 fill-current" /> Start Auction
                </Button>
              ) : currentAuction.state === "paused" ? (
                <Button
                  onClick={resumeAuction}
                  className="bg-green-600 hover:bg-green-700 h-16 text-xl font-bold"
                >
                  <Play className="mr-3 fill-current" /> Resume
                </Button>
              ) : (
                <Button
                  onClick={pauseAuction}
                  className="bg-yellow-600 hover:bg-yellow-700 h-16 text-xl font-bold text-black"
                >
                  <Pause className="mr-3 fill-current" /> Pause
                </Button>
              )}
              <Button
                onClick={() => setShowEndConfirm(true)}
                variant="destructive"
                className="h-16 text-xl border-2 border-red-900/50 bg-transparent text-red-500 font-bold"
              >
                <StopCircle className="mr-2" /> End Auction
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={downloadCSV}
                disabled={loading}
                variant="outline"
                className="h-12 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 font-semibold"
              >
                <FileSpreadsheet className="mr-2 w-5 h-5" /> Download CSV
              </Button>
              <Button
                onClick={downloadPDF}
                disabled={loading}
                variant="outline"
                className="h-12 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 font-semibold"
              >
                <FileText className="mr-2 w-5 h-5" /> Download PDF Report
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-3xl font-bold text-green-500">
                  {(currentAuction.sales || []).length}
                </div>
                <div className="text-[10px] text-gray-400 uppercase">Sold</div>
              </div>
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-3xl font-bold text-amber-500">
                  {(currentAuction.unsoldPlayers || []).length}
                </div>
                <div className="text-[10px] text-gray-400 uppercase">
                  Unsold
                </div>
              </div>
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-xl font-bold text-blue-500 mt-2">
                  ₹
                  {(currentAuction.sales || [])
                    .reduce((acc: any, s: any) => acc + s.price, 0)
                    .toLocaleString("en-IN")}
                </div>
                <div className="text-[10px] text-gray-400 uppercase">Spent</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="overflow-hidden rounded-lg border border-amber-500/30">
          <AuctionRoom
            role="admin"
            roomCode={currentAuction.roomCode}
            onExit={noop}
          />
        </div>
        </>
      )}

      {/* END AUCTION CONFIRMATION */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent className="bg-[#1a2332] border-red-500/50 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle /> End Auction?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              This will save the results as PDF & CSV, then permanently close
              the room and wipe all auction data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={closeAndWipe}
              className="bg-red-600 font-bold"
            >
              End & Save Reports
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuctionTab;
