import express from "express";
import connectDB from "../config/database.js";

const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({ message: "OK" });
});

router.get("/database", async (req, res) => {
    try {
        await connectDB();
        res.status(200).json({ message: "Database connected successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Database connection failed" });
    }
});

export default router;