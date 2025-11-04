import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Trophy, Gavel, Settings, LogOut } from "lucide-react";
import TeamsTab from "@/components/admin/TeamsTab";
import PlayersTab from "@/components/admin/PlayersTab";
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
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gavel className="w-8 h-8 text-amber-500" />
            <div className="text-white">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="teams" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="teams">
              <Trophy className="w-4 h-4 mr-2" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="players">
              <Users className="w-4 h-4 mr-2" />
              Players
            </TabsTrigger>
            <TabsTrigger value="auction">
              <Gavel className="w-4 h-4 mr-2" />
              Auction
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="space-y-4">
            <TeamsTab />
          </TabsContent>

          <TabsContent value="players" className="space-y-4">
            <PlayersTab />
          </TabsContent>

          <TabsContent value="auction" className="space-y-4">
            <AuctionTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
