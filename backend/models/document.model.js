import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxLength: 100
        },
        ownerId: {
            type: String,
            required: true,
            immutable: true,
            index: true
        }
    },
    {
        timestamps: true
    }
);

const Document = mongoose.model("Document", documentSchema);

export default Document;