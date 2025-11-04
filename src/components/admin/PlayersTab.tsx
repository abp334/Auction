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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Player {
  id: string;
  name: string;
  mobile: string;
  email: string;
  photo: string;
  bidAmount: number;
  batsmanType: string;
  bowlerType: string;
  age: number;
}

const PlayersTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    photo: "",
    bidAmount: 5000,
    batsmanType: "Right-handed",
    bowlerType: "Not a Bowler",
    age: 20,
  });

  // Fetch players from backend on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiFetch("/players");
      if (res.ok) {
        const { players } = await res.json();
        setPlayers(
          players.map((p: any) => ({
            id: p._id,
            name: p.name,
            mobile: p.mobile || "",
            email: p.email || "",
            photo: p.photo || "",
            bidAmount: p.basePrice || 0,
            batsmanType: p.role || "",
            bowlerType: p.bowlerType || "Not a Bowler",
            age: p.age || 20,
          }))
        );
      } else {
        toast({ title: "Error", description: "Failed to load players" });
      }
      setLoading(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingPlayer) {
        // Edit (PUT /players/:id)
        const res = await apiFetch(`/players/${editingPlayer.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: formData.name,
            basePrice: formData.bidAmount,
            role: formData.batsmanType,
            bowlerType: formData.bowlerType,
            age: formData.age,
            photo: formData.photo,
            mobile: formData.mobile,
            email: formData.email,
          }),
        });
        if (res.ok) {
          const { player } = await res.json();
          setPlayers((ps) =>
            ps.map((p) =>
              p.id === editingPlayer.id ? { ...p, ...formData } : p
            )
          );
          toast({
            title: "Success",
            description: "Player updated successfully",
          });
        } else {
          toast({ title: "Error", description: "Failed to update player" });
        }
      } else {
        // Add (POST /players)
        const res = await apiFetch("/players", {
          method: "POST",
          body: JSON.stringify({
            name: formData.name,
            basePrice: formData.bidAmount,
            role: formData.batsmanType,
            bowlerType: formData.bowlerType,
            age: formData.age,
            photo: formData.photo,
            mobile: formData.mobile,
            email: formData.email,
          }),
        });
        if (res.ok) {
          const { player } = await res.json();
          setPlayers((ps) => [
            ...ps,
            {
              ...formData,
              id: player._id,
              bidAmount: player.basePrice,
            },
          ]);
          toast({ title: "Success", description: "Player added successfully" });
        } else {
          toast({ title: "Error", description: "Failed to add player" });
        }
      }
      setIsOpen(false);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
    setFormData(player);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    const res = await apiFetch(`/players/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlayers((ps) => ps.filter((p) => p.id !== id));
      toast({ title: "Success", description: "Player deleted successfully" });
    } else {
      toast({ title: "Error", description: "Failed to delete player" });
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingPlayer(null);
    setFormData({
      name: "",
      mobile: "",
      email: "",
      photo: "",
      bidAmount: 5000,
      batsmanType: "Right-handed",
      bowlerType: "Not a Bowler",
      age: 20,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-white text-2xl font-bold">Player Management</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlayer ? "Edit Player" : "Add New Player"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Player Name</Label>
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
                  <Label htmlFor="photo">Photo URL</Label>
                  <Input
                    id="photo"
                    value={formData.photo}
                    onChange={(e) =>
                      setFormData({ ...formData, photo: e.target.value })
                    }
                    placeholder="https://example.com/photo.jpg"
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
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={(e) =>
                      setFormData({ ...formData, age: Number(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batsmanType">Batting Hand</Label>
                  <Select
                    value={formData.batsmanType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, batsmanType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Right-handed">Right-handed</SelectItem>
                      <SelectItem value="Left-handed">Left-handed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bowlerType">Bowler Type</Label>
                  <Select
                    value={formData.bowlerType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, bowlerType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fast Bowler">Fast Bowler</SelectItem>
                      <SelectItem value="Medium Pacer">Medium Pacer</SelectItem>
                      <SelectItem value="Off-Spin Bowler">
                        Off-Spin Bowler
                      </SelectItem>
                      <SelectItem value="Leg-Spin Bowler">
                        Leg-Spin Bowler
                      </SelectItem>
                      <SelectItem value="All-rounder">All-rounder</SelectItem>
                      <SelectItem value="Not a Bowler">Not a Bowler</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="bidAmount">Starting Bid Amount ($)</Label>
                  <Input
                    id="bidAmount"
                    type="number"
                    value={formData.bidAmount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bidAmount: Number(e.target.value),
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
                  {editingPlayer ? "Update" : "Add"} Player
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div>Loading...</div>
        ) : players.length === 0 ? (
          <div className="text-gray-400 p-8">No players found.</div>
        ) : (
          players.map((player) => (
            <Card
              key={player.id}
              className="hover:border-accent transition-colors"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {player.photo ? (
                      <img
                        src={player.photo}
                        alt={player.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-2xl">👤</span>
                      </div>
                    )}
                    <CardTitle className="text-lg">{player.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(player)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(player.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Age:</span> {player.age}
                </p>
                <p>
                  <span className="font-semibold">Email:</span> {player.email}
                </p>
                <p>
                  <span className="font-semibold">Mobile:</span> {player.mobile}
                </p>
                <p>
                  <span className="font-semibold">Batting Hand:</span>{" "}
                  {player.batsmanType}
                </p>
                <p>
                  <span className="font-semibold">Bowler:</span>{" "}
                  {player.bowlerType}
                </p>
                <p className="text-accent font-semibold">
                  Base Price: ${player.bidAmount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default PlayersTab;
