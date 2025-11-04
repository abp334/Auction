import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, User, ArrowRight } from "lucide-react";

const Blog = () => {
  const navigate = useNavigate();

  const posts = [
    {
      title: "10 Tips for Running a Successful Sports Auction",
      excerpt: "Learn the best practices for organizing and managing professional sports auctions that keep everyone engaged.",
      author: "Sarah Johnson",
      date: "Jan 15, 2025",
      category: "Best Practices",
      readTime: "5 min read"
    },
    {
      title: "How Real-Time Bidding Transforms Auction Experiences",
      excerpt: "Discover how modern technology is revolutionizing the way leagues conduct player auctions.",
      author: "Mike Chen",
      date: "Jan 10, 2025",
      category: "Technology",
      readTime: "4 min read"
    },
    {
      title: "Managing Team Purses: A Complete Guide",
      excerpt: "Master the art of budget management during auctions with our comprehensive guide for team captains.",
      author: "Lisa Rodriguez",
      date: "Jan 5, 2025",
      category: "Strategy",
      readTime: "7 min read"
    },
    {
      title: "The Evolution of Sports Auctions",
      excerpt: "From paper and pen to digital platforms - explore the fascinating history of sports player auctions.",
      author: "David Kumar",
      date: "Dec 28, 2024",
      category: "Industry Insights",
      readTime: "6 min read"
    },
    {
      title: "Creating Engaging Auction Commentary",
      excerpt: "Tips and tricks for admins to provide live commentary that keeps spectators engaged throughout the auction.",
      author: "Emma Thompson",
      date: "Dec 20, 2024",
      category: "Best Practices",
      readTime: "5 min read"
    },
    {
      title: "Security Best Practices for Online Auctions",
      excerpt: "Ensure your auction data stays safe with these essential security guidelines and features.",
      author: "Alex Martinez",
      date: "Dec 15, 2024",
      category: "Security",
      readTime: "8 min read"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419]">
      <header className="border-b border-amber-500/30 bg-[#0f1419]/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-white hover:text-amber-500"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">AuctionPro Blog</h1>
            <p className="text-xl text-gray-300">
              Insights, tips, and news from the world of sports auctions
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, index) => (
              <Card key={index} className="bg-[#1a2332] border-amber-500/30 hover:border-amber-500 transition-all group">
                <CardContent className="pt-6">
                  <Badge className="mb-4 bg-amber-500/20 text-amber-500 border-amber-500/30">
                    {post.category}
                  </Badge>
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-amber-500 transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-gray-300 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {post.author}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {post.date}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{post.readTime}</span>
                    <Button
                      variant="ghost"
                      className="text-amber-500 hover:text-amber-400 p-0 h-auto"
                    >
                      Read More <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Card className="bg-amber-500/10 border-amber-500/30 inline-block">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold text-white mb-2">Want to contribute?</h3>
                <p className="text-gray-300 mb-4">
                  Share your auction expertise with our community
                </p>
                <Button
                  onClick={() => navigate("/contact")}
                  className="bg-amber-500 hover:bg-amber-600 text-primary font-bold"
                >
                  Contact Us
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Blog;
