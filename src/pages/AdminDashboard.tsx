import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Gavel, LogOut } from "lucide-react";
import AuctionTab from "@/components/admin/AuctionTab";
import { useAuth } from "@/hooks/use-auth";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419]">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gavel className="w-8 h-8 text-amber-500" />
            <div className="text-white">
              <h1 className="text-2xl font-bold">Auction Control Center</h1>
              <p className="text-sm opacity-90">
                Welcome, {user?.name || "Admin"}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleLogout}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Single Unified Tab for the Auction Lifecycle */}
          <AuctionTab />
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
