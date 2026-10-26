import mongoose from "mongoose";

export default function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({
            error: "Document validation failed"
        });
    }

    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({
            error: "Invalid value"
        });
    }

    console.error(err);

    return res.status(500).json({
        error: "Internal server error"
    });
}