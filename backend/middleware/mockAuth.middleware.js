const MOCK_USERS = new Set([
    "user-123",
    "user-456"
]);

export function mockAuth(req, res, next) {
    const userId = req.get("x-user-id") || "user-123";

    if (!MOCK_USERS.has(userId)) {
        return res.status(401).json({
            error: "Unknown user"
        });
    }

    req.user = { id: userId };

    next();
}