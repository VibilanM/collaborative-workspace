import { Router } from "express";

import {
    createDocument,
    listDocuments,
    getDocument,
    renameDocument,
    deleteDocument
} from "../controllers/documentControllers.js";

import {
    validateCreateDocument,
    validateRenameDocument
} from "../middleware/validate.middleware.js";

const router = Router();

router.post("/", validateCreateDocument, createDocument);

router.get("/", listDocuments);
router.get("/:id", getDocument);

router.patch("/:id", validateRenameDocument, renameDocument);

router.delete("/:id", deleteDocument);

export default router;