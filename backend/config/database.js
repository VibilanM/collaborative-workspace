import mongoose from "mongoose";

export default async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to database successfully");
    } catch (error) {
        console.error("Error connecting to database:", error);
        process.exit(1);
    }
}