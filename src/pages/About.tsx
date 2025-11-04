import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Gavel, Users, Target, Heart, ArrowLeft } from "lucide-react";

const About = () => {
  const navigate = useNavigate();

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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="bg-amber-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-amber-500">
              <Gavel className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">About AuctionPro</h1>
            <p className="text-xl text-gray-300">
              Revolutionizing sports auctions with cutting-edge technology
            </p>
          </div>

          <Card className="mb-8 bg-[#1a2332] border-amber-500/30">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">Our Story</h2>
              <p className="text-gray-300 mb-4">
                Founded in 2020, AuctionPro was born from the frustration of managing sports auctions
                using spreadsheets and manual processes. We believed there had to be a better way.
              </p>
              <p className="text-gray-300 mb-4">
                Today, we're proud to serve over 500 leagues worldwide, powering seamless auction
                experiences for thousands of teams and players. Our platform combines real-time
                technology with intuitive design to make auction management effortless.
              </p>
              <p className="text-gray-300">
                We're committed to continuous innovation, listening to our users, and building the
                best auction platform in the industry.
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-[#1a2332] border-amber-500/30 text-center">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Our Mission</h3>
                <p className="text-gray-300">
                  Simplify and elevate auction experiences for sports leagues everywhere
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-amber-500/30 text-center">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Our Team</h3>
                <p className="text-gray-300">
                  A passionate group of engineers and sports enthusiasts dedicated to excellence
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-amber-500/30 text-center">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Our Values</h3>
                <p className="text-gray-300">
                  Innovation, reliability, and customer success are at the heart of everything we do
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="pt-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Join Us on Our Journey</h2>
              <p className="text-gray-300 mb-6">
                Interested in partnering with us or joining our team? We'd love to hear from you.
              </p>
              <Button
                onClick={() => navigate("/contact")}
                className="bg-amber-500 hover:bg-amber-600 text-primary font-bold"
              >
                Get in Touch
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default About;
