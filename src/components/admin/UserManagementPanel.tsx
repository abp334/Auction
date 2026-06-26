import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";
import { Trash2, Users, ShieldCheck, ShieldX, Crown } from "lucide-react";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  team?: { id: string; name: string } | null;
  auction?: {
    id: string;
    name: string;
    roomCode: string;
    state: string;
  } | null;
};

const UserManagementPanel = () => {
  const [admins, setAdmins] = useState<ManagedUser[]>([]);
  const [captains, setCaptains] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const [adminsRes, captainsRes] = await Promise.all([
      apiFetch("/users/admins"),
      apiFetch("/users/captains"),
    ]);

    if (adminsRes.status === 403 || captainsRes.status === 403) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    setIsSuperAdmin(true);

    if (adminsRes.ok) {
      const data = await adminsRes.json();
      setAdmins(data.users);
    }
    if (captainsRes.ok) {
      const data = await captainsRes.json();
      setCaptains(data.users);
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await apiFetch(`/users/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast({
        title: "User Deleted",
        description: `${deleteTarget.email} has been removed.`,
      });
      if (deleteTarget.role === "captain") {
        setCaptains((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      } else {
        setAdmins((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      }
    } else {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      toast({
        title: "Error",
        description: err.error || "Failed to delete user.",
        variant: "destructive",
      });
    }
    setDeleteTarget(null);
  };

  const renderUserRow = (u: ManagedUser, isYou: boolean) => (
    <div
      key={u.id}
      className={`flex items-center justify-between p-3 rounded-lg border ${
        isYou
          ? "bg-amber-500/5 border-amber-500/30"
          : "bg-white/5 border-white/10"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm truncate">
            {u.name}
          </span>
          {isYou && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400 truncate">{u.email}</span>
          {u.emailVerified ? (
            <ShieldCheck className="w-3 h-3 text-green-400 flex-shrink-0" />
          ) : (
            <ShieldX className="w-3 h-3 text-red-400 flex-shrink-0" />
          )}
        </div>
        {u.role === "captain" && (
          <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
            {u.team?.name && <p>Team: {u.team.name}</p>}
            {u.auction && (
              <p>
                Auction: {u.auction.name} ({u.auction.roomCode}) ·{" "}
                {u.auction.state}
              </p>
            )}
          </div>
        )}
        <span className="text-[10px] text-gray-500">
          Joined{" "}
          {new Date(u.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
      {!isYou && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteTarget(u)}
          className="text-gray-400 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  if (loading) return null;
  if (!isSuperAdmin) return null;

  return (
    <>
      <Card className="border-amber-500/20 bg-white/5 backdrop-blur-sm mt-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-white">Admin Users</CardTitle>
          </div>
          <CardDescription className="text-gray-400">
            All registered admin accounts. Remove clients whose auctions are
            complete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No admin users found.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {admins.map((u) =>
                renderUserRow(u, u.id === currentUser?.id)
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-white/5 backdrop-blur-sm mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-white">Captain Accounts</CardTitle>
          </div>
          <CardDescription className="text-gray-400">
            Auto-created captain logins from auctions. Delete to revoke access
            after an event — team and auction data stay intact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {captains.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No captain accounts found.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {captains.map((u) => renderUserRow(u, false))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-[#1a2332] border-red-500/50 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">
              {deleteTarget?.role === "captain"
                ? "Delete Captain Account?"
                : "Delete Admin User?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              {deleteTarget?.role === "captain" ? (
                <>
                  This will permanently remove captain login{" "}
                  <strong className="text-white">{deleteTarget?.email}</strong>
                  . They will no longer be able to sign in or bid. The team and
                  auction data are not deleted.
                </>
              ) : (
                <>
                  This will permanently remove{" "}
                  <strong className="text-white">{deleteTarget?.email}</strong>{" "}
                  and any auctions they created. They will no longer be able to
                  sign in.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 font-bold"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagementPanel;
