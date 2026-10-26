export function validateCreateDocument(req, res, next) {
    const { title } = req.body ?? {};

    if (
        typeof title !== "string" ||
        title.trim().length < 1 ||
        title.trim().length > 100
    ) {
        return res.status(400).json({
            error: "Title must be a string containing 1-100 characters"
        });
    }

    if (Object.keys(req.body).some(
        key => key !== "title"
    )) {
        return res.status(400).json({
            error: "Only the title field is allowed"
        });
    }

    next();
}

export function validateRenameDocument(req, res, next) {
    if (
        !req.body ||
        Object.keys(req.body).length !== 1 ||
        !Object.hasOwn(req.body, "title")
    ) {
        return res.status(400).json({
            error: "Request body must contain only title"
        });
    }

    const { title } = req.body;

    if (
        typeof title !== "string" ||
        title.trim().length < 1 ||
        title.trim().length > 100
    ) {
        return res.status(400).json({
            error: "Title must be a string containing 1-100 characters"
        });
    }

    next();
}

