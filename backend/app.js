import express from "express";
import healthRoutes from "./routes/healthRoutes.js";
import errorHandler from "./middleware/error.middleware.js";

const app = express();

app.use(express.json());

app.use("/health", healthRoutes);

app.use(errorHandler);

app.get("/", (req, res) => {
    res.status(200).json({ message: "Welcome to the Collaborative Workspace API" });
});

export default app;