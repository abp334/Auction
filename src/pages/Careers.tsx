import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Briefcase, Clock } from "lucide-react";

const Careers = () => {
  const navigate = useNavigate();

  const openings = [
    {
      title: "Senior Full Stack Engineer",
      department: "Engineering",
      location: "San Francisco, CA / Remote",
      type: "Full-time",
      description: "Build and scale our real-time auction platform using React, Node.js, and modern cloud technologies."
    },
    {
      title: "Product Designer",
      department: "Design",
      location: "Remote",
      type: "Full-time",
      description: "Create beautiful, intuitive interfaces for our auction management platform with a focus on user experience."
    },
    {
      title: "Customer Success Manager",
      department: "Customer Success",
      location: "New York, NY / Remote",
      type: "Full-time",
      description: "Help our league customers succeed with AuctionPro and ensure they have amazing experiences."
    },
    {
      title: "DevOps Engineer",
      department: "Engineering",
      location: "Remote",
      type: "Full-time",
      description: "Ensure our platform scales reliably for thousands of concurrent users during live auctions."
    }
  ];

  const benefits = [
    "Competitive salary and equity",
    "Comprehensive health insurance",
    "Flexible work arrangements",
    "Professional development budget",
    "Unlimited PTO",
    "Latest tech equipment",
    "Team building events",
    "Wellness programs"
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
            <h1 className="text-5xl font-bold text-white mb-4">Join Our Team</h1>
            <p className="text-xl text-gray-300">
              Help us revolutionize sports auctions worldwide
            </p>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-12">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">Why AuctionPro?</h2>
              <p className="text-gray-300 mb-6">
                At AuctionPro, we're building the future of sports auctions. We're a passionate team of engineers,
                designers, and sports enthusiasts working to make auction management effortless for leagues around the world.
                Join us in creating technology that brings people together and makes sports more exciting.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    {benefit}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Open Positions</h2>
            <div className="space-y-4">
              {openings.map((job, index) => (
                <Card key={index} className="bg-[#1a2332] border-amber-500/30 hover:border-amber-500 transition-all">
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{job.title}</h3>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {job.department}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {job.type}
                          </div>
                        </div>
                      </div>
                      <Button className="bg-amber-500 hover:bg-amber-600 text-primary font-bold shrink-0">
                        Apply Now
                      </Button>
                    </div>
                    <p className="text-gray-300">{job.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="bg-amber-500/10 border-amber-500/30 text-center">
            <CardContent className="pt-6">
              <h3 className="text-2xl font-bold text-white mb-4">Don't see the right role?</h3>
              <p className="text-gray-300 mb-6">
                We're always looking for talented people to join our team. Send us your resume and let us know what you're passionate about.
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

export default Careers;
