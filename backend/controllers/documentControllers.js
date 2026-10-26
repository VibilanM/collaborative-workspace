import mongoose from "mongoose";
import Document from "../models/document.model.js";

function validId(id) {
    return mongoose.isValidObjectId(id);
}

function notFound(res) {
    return res.status(404).json({
        error: "Document not found"
    });
}

async function createDocument(req, res) {
    const document = await Document.create({
        title: req.body.title,
        ownerId: req.user.id
    });

    return res.status(201).json(document);
}

async function listDocuments(req, res) {
    const documents = await Document.find({
        ownerId: req.user.id
    }).sort({ updatedAt: -1 });

    return res.status(200).json(documents);
}

async function getDocument(req, res) {
    if (!validId(req.params.id)) {
        return res.status(400).json({
            error: "Invalid document ID"
        });
    }

    const document = await Document.findOne({
        _id: req.params.id,
        ownerId: req.user.id
    });

    if (!document) {
        return notFound(res);
    }

    return res.status(200).json(document);
}

async function renameDocument(req, res) {
    if (!validId(req.params.id)) {
        return res.status(400).json({
            error: "Invalid document ID"
        });
    }

    const document = await Document.findOneAndUpdate(
        {
            _id: req.params.id,
            ownerId: req.user.id
        },
        {
            $set: {
                title: req.body.title.trim()
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!document) {
        return notFound(res);
    }

    return res.status(200).json(document);
}

async function deleteDocument(req, res) {
    if (!validId(req.params.id)) {
        return res.status(400).json({
            error: "Invalid document ID"
        });
    }

    const document = await Document.findOneAndDelete({
        _id: req.params.id,
        ownerId: req.user.id
    });

    if (!document) {
        return notFound(res);
    }

    return res.status(204).end();
}

export {
    createDocument,
    listDocuments,
    getDocument,
    renameDocument,
    deleteDocument
};