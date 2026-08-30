import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import AuctionTab from "@/components/admin/AuctionTab";
import StaticAuctionTab from "@/components/admin/StaticAuctionTab";
import InviteCodesPanel from "@/components/admin/InviteCodesPanel";
import TestAuctionPanel from "@/components/admin/TestAuctionPanel";
import UserManagementPanel from "@/components/admin/UserManagementPanel";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isStatic = user?.auctionMode === "static";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419] flex flex-col">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-4 py-3 lg:py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="ClashBid Logo"
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="text-white">
              <h1 className="text-lg lg:text-xl font-bold">
                {isStatic ? "Single Bidder Mode" : "Auction Control Center"}
              </h1>
              {!isStatic && (
                <p className="text-sm opacity-90">
                  Welcome, {user?.name || "Admin"}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleLogout}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main
        className={`container mx-auto px-3 lg:px-4 flex-1 min-h-0 flex flex-col ${
          isStatic ? "py-2 lg:py-3" : "py-8"
        }`}
      >
        <div
          className={`mx-auto w-full flex-1 min-h-0 flex flex-col ${
            isStatic ? "max-w-[1400px]" : "max-w-5xl"
          }`}
        >
          {isStatic ? <StaticAuctionTab /> : <AuctionTab />}
          {!isStatic && <TestAuctionPanel />}
          {!isStatic && <UserManagementPanel />}
          {!isStatic && <InviteCodesPanel />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
