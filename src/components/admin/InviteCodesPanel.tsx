import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Copy, Trash2, Plus, KeyRound } from "lucide-react";

type InviteCode = {
  id: string;
  code: string;
  email: string | null;
  used: boolean;
  usedAt: string | null;
  usedBy: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const InviteCodesPanel = () => {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [creating, setCreating] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    const res = await apiFetch("/invites");
    if (res.ok) {
      setIsSuperAdmin(true);
      const data = await res.json();
      setCodes(data);
    } else if (res.status === 403) {
      setIsSuperAdmin(false);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    const body: Record<string, unknown> = {};
    if (email.trim()) body.email = email.trim();
    if (expiresInDays) body.expiresInDays = parseInt(expiresInDays);

    const res = await apiFetch("/invites", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const newCode = await res.json();
      toast({
        title: "Invite Code Created",
        description: `Code: ${newCode.code}`,
      });
      setEmail("");
      fetchCodes();
    } else {
      toast({
        title: "Error",
        description: "Failed to create invite code.",
        variant: "destructive",
      });
    }
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    const res = await apiFetch(`/invites/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Revoked", description: "Invite code deleted." });
      setCodes((prev) => prev.filter((c) => c.id !== id));
    } else {
      toast({
        title: "Error",
        description: "Failed to revoke code.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `${code} copied to clipboard.` });
  };

  if (loading) return null;
  if (!isSuperAdmin) return null;

  return (
    <Card className="border-amber-500/20 bg-white/5 backdrop-blur-sm mt-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-white">Invite Codes</CardTitle>
        </div>
        <CardDescription className="text-gray-400">
          Generate invite codes for clients who have paid. Only you can see this
          section.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Generate new code */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex-1 space-y-1">
            <Label className="text-gray-300 text-xs">
              Client Email (optional)
            </Label>
            <Input
              placeholder="client@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="w-32 space-y-1">
            <Label className="text-gray-300 text-xs">Expires (days)</Label>
            <Input
              type="number"
              placeholder="30"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Plus className="w-4 h-4 mr-1" />
              Generate
            </Button>
          </div>
        </div>

        {/* List of codes */}
        {codes.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No invite codes yet. Generate one above.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {codes.map((invite) => (
              <div
                key={invite.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  invite.used
                    ? "bg-white/5 border-white/5 opacity-60"
                    : "bg-white/5 border-amber-500/20"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-amber-400 font-mono font-bold text-sm">
                      {invite.code}
                    </code>
                    {invite.used && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        Used
                      </span>
                    )}
                    {!invite.used &&
                      invite.expiresAt &&
                      new Date(invite.expiresAt) < new Date() && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                          Expired
                        </span>
                      )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {invite.email && <span>For: {invite.email} · </span>}
                    {invite.used && invite.usedBy && (
                      <span>Used by: {invite.usedBy} · </span>
                    )}
                    {invite.expiresAt && (
                      <span>
                        Expires:{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {!invite.used && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(invite.code)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(invite.id)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InviteCodesPanel;
