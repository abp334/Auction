import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Team {
  id: string;
  name: string;
  logo: string;
  owner: string;
  mobile: string;
  email: string;
  captain: string;
  purse: number;
}

const TeamsTab = () => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    logo: "",
    owner: "",
    mobile: "",
    email: "",
    captain: "",
    purse: 100000,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiFetch("/teams");
      if (res.ok) {
        const { teams } = await res.json();
        setTeams(
          teams.map((t: any) => ({
            id: t._id,
            name: t.name,
            logo: t.logo || "🏆",
            owner: t.owner || "",
            mobile: t.mobile || "",
            email: t.email || "",
            captain: t.captain || "",
            purse: t.wallet || 0,
          }))
        );
      } else {
        toast({ title: "Error", description: "Failed to load teams" });
      }
      setLoading(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingTeam) {
        const res = await apiFetch(`/teams/${editingTeam.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: formData.name,
            wallet: formData.purse,
            logo: formData.logo,
            owner: formData.owner,
            mobile: formData.mobile,
            email: formData.email,
            captain: formData.captain,
          }),
        });
        if (res.ok) {
          const { team } = await res.json();
          setTeams((ts) =>
            ts.map((t) =>
              t.id === editingTeam.id
                ? {
                    ...formData,
                    id: team._id,
                    purse: team.wallet,
                  }
                : t
            )
          );
          toast({ title: "Success", description: "Team updated successfully" });
        } else {
          toast({ title: "Error", description: "Failed to update team" });
        }
      } else {
        const res = await apiFetch("/teams", {
          method: "POST",
          body: JSON.stringify({
            name: formData.name,
            wallet: formData.purse,
            logo: formData.logo,
            owner: formData.owner,
            mobile: formData.mobile,
            email: formData.email,
            captain: formData.captain,
          }),
        });
        if (res.ok) {
          const { team } = await res.json();
          setTeams((ts) => [
            ...ts,
            {
              ...formData,
              id: team._id,
              purse: team.wallet,
            },
          ]);
          toast({ title: "Success", description: "Team added successfully" });
        } else {
          toast({ title: "Error", description: "Failed to add team" });
        }
      }
      setIsOpen(false);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData(team);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    const res = await apiFetch(`/teams/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTeams((ts) => ts.filter((t) => t.id !== id));
      toast({ title: "Success", description: "Team deleted successfully" });
    } else {
      toast({ title: "Error", description: "Failed to delete team" });
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingTeam(null);
    setFormData({
      name: "",
      logo: "",
      owner: "",
      mobile: "",
      email: "",
      captain: "",
      purse: 100000,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-white text-2xl font-bold">Team Management</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTeam ? "Edit Team" : "Add New Team"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo">Team Logo (Emoji)</Label>
                  <Input
                    id="logo"
                    value={formData.logo}
                    onChange={(e) =>
                      setFormData({ ...formData, logo: e.target.value })
                    }
                    placeholder="🏆"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner">Team Owner</Label>
                  <Input
                    id="owner"
                    value={formData.owner}
                    onChange={(e) =>
                      setFormData({ ...formData, owner: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) =>
                      setFormData({ ...formData, mobile: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="captain">Captain Name</Label>
                  <Input
                    id="captain"
                    value={formData.captain}
                    onChange={(e) =>
                      setFormData({ ...formData, captain: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="purse">Starting Purse ($)</Label>
                  <Input
                    id="purse"
                    type="number"
                    value={formData.purse}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purse: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTeam ? "Update" : "Add"} Team
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="text-gray-400 p-8">Loading teams...</div>
        ) : teams.length === 0 ? (
          <div className="text-gray-400 p-8">No teams found.</div>
        ) : (
          teams.map((team) => (
            <Card
              key={team.id}
              className="hover:border-accent transition-colors"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{team.logo}</span>
                    <CardTitle>{team.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(team)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(team.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Owner:</span> {team.owner}
                </p>
                <p>
                  <span className="font-semibold">Captain:</span> {team.captain}
                </p>
                <p>
                  <span className="font-semibold">Email:</span> {team.email}
                </p>
                <p>
                  <span className="font-semibold">Mobile:</span> {team.mobile}
                </p>
                <p className="text-accent font-semibold">
                  Purse: ${team.purse.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TeamsTab;
