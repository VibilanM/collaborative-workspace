import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/database.js";

const PORT = process.env.PORT || 8001;

async function startServer() {
    try {
        await connectDB();

        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        async function shutdown() {
            server.close(async () => {
                try {
                    const mongoose = await import("mongoose");
                    await mongoose.default.disconnect();
                    process.exit(0);
                }
                catch (err) {
                    console.error("Shutdown failed: ", err);
                    process.exit(1);
                }
            });
        }

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }
    catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();