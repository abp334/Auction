import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { jsonToCSV } from "@/lib/utils";

/** UI formatting — rupee symbol is fine in the browser. */
export const formatINR = (amount: number) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

/**
 * PDF-safe money formatting.
 * Helvetica cannot render ₹ and en-IN can inject narrow spaces that look broken.
 */
export const formatINRPdf = (amount: number) =>
  `Rs. ${Math.round(Number(amount || 0)).toLocaleString("en-IN").replace(/\u00a0|\u202f/g, ",")}`;

export type AuctionReport = {
  auctionName?: string;
  date?: string | Date;
  state?: string;
  summary?: {
    totalPlayers?: number;
    totalSold?: number;
    totalUnsold?: number;
    totalBids?: number;
    totalSpent?: number;
    highestSale?: {
      playerName: string;
      teamName: string;
      price: number;
    } | null;
  };
  teams: Array<{
    TeamName: string;
    Captain?: string;
    PlayersCount?: number;
    TotalSpent?: number;
    RemainingPurse?: number;
    InitialPurse?: number;
    Roster?: Array<{
      Name: string;
      Role?: string;
      BasePrice?: number;
      SoldPrice?: number;
      Price?: number;
    }>;
  }>;
  unsold?: Array<{
    Name: string;
    Role?: string;
    BasePrice?: number;
  }>;
};

function drawPieSlice(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const steps = 50;
  const angleStep = (endAngle - startAngle) / steps;
  const points: [number, number][] = [[cx, cy]];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + i * angleStep - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  points.push([cx, cy]);

  const pageH = doc.internal.pageSize.getHeight();
  const k = 72 / 25.4;
  const pdfPoints = points.map(
    (p) => [p[0] * k, (pageH - p[1]) * k] as [number, number]
  );
  const pathOps = pdfPoints
    .map((p, i) => `${p[0].toFixed(2)} ${p[1].toFixed(2)} ${i === 0 ? "m" : "l"}`)
    .join(" ");
  (doc as any).internal.out(pathOps + " f");
}

export function downloadAuctionCSV(report: AuctionReport, fallbackName = "Auction") {
  const flatReport: Record<string, string | number>[] = [];
  report.teams.forEach((t) => {
    (t.Roster || []).forEach((p) => {
      flatReport.push({
        Status: "SOLD",
        Team: t.TeamName,
        Captain: t.Captain || "-",
        Player: p.Name,
        Role: p.Role || "-",
        BasePrice: p.BasePrice || 0,
        SoldPrice: p.SoldPrice || p.Price || 0,
      });
    });
  });
  (report.unsold || []).forEach((p) => {
    flatReport.push({
      Status: "UNSOLD",
      Team: "-",
      Captain: "-",
      Player: p.Name,
      Role: p.Role || "-",
      BasePrice: p.BasePrice || 0,
      SoldPrice: 0,
    });
  });

  const csvContent = jsonToCSV(flatReport);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Results_${(report.auctionName || fallbackName).replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Full ClashBid-style auction report PDF (cover, charts, team rosters, unsold). */
export function downloadAuctionPDF(
  report: AuctionReport,
  fallbackName = "Auction",
  options?: { subtitle?: string }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const name = report.auctionName || fallbackName || "Auction";
  const subtitle = options?.subtitle || "AUCTION REPORT";
  const dateStr = new Date(report.date || Date.now()).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalSold =
    report.summary?.totalSold ??
    report.teams.reduce((s, t) => s + (t.Roster?.length || 0), 0);
  const totalUnsold = report.summary?.totalUnsold ?? (report.unsold?.length || 0);
  const totalPlayers =
    report.summary?.totalPlayers ?? totalSold + totalUnsold;
  const totalSpent =
    report.summary?.totalSpent ??
    report.teams.reduce((s, t) => s + (t.TotalSpent || 0), 0);
  const totalBids = report.summary?.totalBids ?? 0;
  const highestSale = report.summary?.highestSale;

  const amber: [number, number, number] = [245, 158, 11];
  const dark: [number, number, number] = [15, 20, 25];
  const darkCard: [number, number, number] = [26, 35, 50];
  const green: [number, number, number] = [34, 197, 94];
  const red: [number, number, number] = [239, 68, 68];
  const blue: [number, number, number] = [59, 130, 246];
  const gray: [number, number, number] = [156, 163, 175];
  const teamColors: [number, number, number][] = [
    [245, 158, 11],
    [59, 130, 246],
    [34, 197, 94],
    [168, 85, 247],
    [236, 72, 153],
    [20, 184, 166],
    [249, 115, 22],
    [99, 102, 241],
  ];

  // Cover header
  doc.setFillColor(dark[0], dark[1], dark[2]);
  doc.rect(0, 0, pageWidth, 55, "F");
  doc.setFillColor(amber[0], amber[1], amber[2]);
  doc.rect(0, 55, pageWidth, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(name, 14, 25);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(amber[0], amber[1], amber[2]);
  doc.text(subtitle, 14, 35);

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(10);
  doc.text(dateStr, 14, 45);

  // Stat cards
  let y = 70;
  const cardW = (pageWidth - 42) / 4;
  const cardH = 28;
  const stats = [
    { label: "Total Players", value: String(totalPlayers), color: amber },
    { label: "Sold", value: String(totalSold), color: green },
    { label: "Unsold", value: String(totalUnsold), color: red },
    {
      label: totalBids > 0 ? "Total Bids" : "Teams",
      value: String(totalBids > 0 ? totalBids : report.teams.length),
      color: blue,
    },
  ];

  stats.forEach((stat, i) => {
    const x = 14 + i * (cardW + 4);
    doc.setFillColor(darkCard[0], darkCard[1], darkCard[2]);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, "F");
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(stat.value, x + cardW / 2, y + 13, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(stat.label.toUpperCase(), x + cardW / 2, y + 22, {
      align: "center",
    });
  });

  y += cardH + 10;
  doc.setFillColor(darkCard[0], darkCard[1], darkCard[2]);
  doc.roundedRect(14, y, pageWidth - 28, 22, 3, 3, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("TOTAL SPENT", 22, y + 9);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(amber[0], amber[1], amber[2]);
  doc.text(formatINRPdf(totalSpent), 22, y + 17);

  if (highestSale) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text("HIGHEST SALE", pageWidth / 2 + 6, y + 9);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(green[0], green[1], green[2]);
    const hs = `${highestSale.playerName} -> ${highestSale.teamName} (${formatINRPdf(highestSale.price)})`;
    doc.text(hs, pageWidth / 2 + 6, y + 17, {
      maxWidth: pageWidth / 2 - 20,
    });
  }

  // Team spending bars
  y += 35;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text("Team Spending Comparison", 14, y);
  y += 8;

  const maxSpent = Math.max(...report.teams.map((t) => t.TotalSpent || 0), 1);
  const barMaxWidth = pageWidth - 80;
  const barH = 10;
  const barGap = 4;

  report.teams.forEach((team, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const color = teamColors[i % teamColors.length];
    const barWidth = Math.max(((team.TotalSpent || 0) / maxSpent) * barMaxWidth, 2);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    const truncatedName =
      team.TeamName.length > 12
        ? team.TeamName.substring(0, 12) + "..."
        : team.TeamName;
    doc.text(truncatedName, 14, y + barH / 2 + 1);

    doc.setFillColor(240, 240, 240);
    doc.roundedRect(55, y, barMaxWidth, barH, 2, 2, "F");
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(55, y, barWidth, barH, 2, 2, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(formatINRPdf(team.TotalSpent || 0), 55 + barMaxWidth + 3, y + barH / 2 + 1);

    y += barH + barGap;
  });

  // Outcome donut
  y += 10;
  if (y > 210) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text("Player Auction Outcome", 14, y);
  y += 5;

  const pieX = 50;
  const pieY = y + 30;
  const pieR = 25;

  if (totalPlayers > 0) {
    const soldAngle = (totalSold / totalPlayers) * 2 * Math.PI;
    doc.setFillColor(green[0], green[1], green[2]);
    drawPieSlice(doc, pieX, pieY, pieR, 0, soldAngle);
    if (totalUnsold > 0) {
      doc.setFillColor(red[0], red[1], red[2]);
      drawPieSlice(doc, pieX, pieY, pieR, soldAngle, 2 * Math.PI);
    }
    doc.setFillColor(255, 255, 255);
    doc.circle(pieX, pieY, pieR * 0.55, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text(`${Math.round((totalSold / totalPlayers) * 100)}%`, pieX, pieY + 2, {
      align: "center",
    });
    doc.setFontSize(6);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text("SOLD", pieX, pieY + 7, { align: "center" });

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

  // Team rosters
  doc.addPage();
  y = 15;
  doc.setFillColor(dark[0], dark[1], dark[2]);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setFillColor(amber[0], amber[1], amber[2]);
  doc.rect(0, 20, pageWidth, 2, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Team Rosters", 14, 14);
  y = 30;

  report.teams.forEach((team, tIdx) => {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    const color = teamColors[tIdx % teamColors.length];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(team.TeamName, 20, y + 7);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Captain: ${team.Captain || "—"}  |  Players: ${team.PlayersCount ?? team.Roster?.length ?? 0}  |  Spent: ${formatINRPdf(team.TotalSpent || 0)}  |  Purse Left: ${formatINRPdf(team.RemainingPurse || 0)}`,
      20,
      y + 13
    );
    y += 20;

    if (team.Roster && team.Roster.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["#", "Player", "Role", "Sold Price"]],
        body: team.Roster.map((p, idx) => [
          String(idx + 1),
          p.Name,
          p.Role || "-",
          formatINRPdf(p.SoldPrice || p.Price || 0),
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [color[0], color[1], color[2]],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8, font: "helvetica" },
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

  if (report.unsold && report.unsold.length > 0) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }
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
      body: report.unsold.map((p, idx) => [
        String(idx + 1),
        p.Name,
        p.Role || "-",
        formatINRPdf(p.BasePrice || 0),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [red[0], red[1], red[2]],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8, font: "helvetica" },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        3: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });
  }

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
}
