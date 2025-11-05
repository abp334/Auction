import mongoose from "mongoose";

export async function connectToDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI not set");
  }

  mongoose.set("strictQuery", true);

  // Optimize connection with pooling and timeouts for production
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || "bidarena",
    maxPoolSize: 50, // Increased for production (more concurrent requests)
    minPoolSize: 10, // Increased for production
    serverSelectionTimeoutMS: 30000, // Increased for remote connections
    socketTimeoutMS: 45000, // Keep same
    connectTimeoutMS: 30000, // Increased for remote connections
    retryWrites: true, // Enable retry writes for better reliability
    retryReads: true, // Enable retry reads
    w: "majority", // Write concern for better consistency
  });

  // Disable mongoose buffering (set globally)
  mongoose.set("bufferCommands", false);

  // Connection event handlers
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected successfully");
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected");
  });
}
