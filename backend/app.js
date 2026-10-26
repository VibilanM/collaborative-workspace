import express from "express";
import healthRoutes from "./routes/healthRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import { mockAuth } from "./middleware/mockAuth.middleware.js";
import errorHandler from "./middleware/error.middleware.js";

const app = express();

app.use(express.json());

app.use("/health", healthRoutes);

app.use("/documents", mockAuth, documentRoutes);

app.use((req, res) => {
    res.status(404).json({
        error: "Route not found"
    });
});

app.use(errorHandler);

export default app;