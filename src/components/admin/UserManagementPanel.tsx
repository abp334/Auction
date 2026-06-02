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
import { Trash2, Users, ShieldCheck, ShieldX } from "lucide-react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
};

const UserManagementPanel = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    const res = await apiFetch("/users/admins");
    if (res.ok) {
      setIsSuperAdmin(true);
      const data = await res.json();
      setUsers(data.users);
    } else if (res.status === 403) {
      setIsSuperAdmin(false);
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
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
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
          {users.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No admin users found.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.map((u) => {
                const isYou = u.id === currentUser?.id;
                return (
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
                        <span className="text-xs text-gray-400 truncate">
                          {u.email}
                        </span>
                        {u.emailVerified ? (
                          <ShieldCheck className="w-3 h-3 text-green-400 flex-shrink-0" />
                        ) : (
                          <ShieldX className="w-3 h-3 text-red-400 flex-shrink-0" />
                        )}
                      </div>
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
              })}
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
              Delete Admin User?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              This will permanently remove{" "}
              <strong className="text-white">{deleteTarget?.email}</strong> and
              any auctions they created. They will no longer be able to sign in.
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
