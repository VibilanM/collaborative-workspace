import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

import app from "../backend/app.js";
import Document from "../backend/models/document.model.js";

let mongoServer;

before(async () => {
    mongoServer = await MongoMemoryServer.create();

    await mongoose.connect(mongoServer.getUri(), {
        dbName: "workspace_test"
    });
});

beforeEach(async () => {
    await Document.deleteMany({});
});

after(async () => {
    await mongoose.disconnect();

    if (mongoServer) {
        await mongoServer.stop();
    }
});

test("POST /documents creates a document", async () => {
    const response = await request(app)
        .post("/documents")
        .send({ title: "My Whiteboard" });

    assert.equal(response.status, 201);
    assert.equal(response.body.title, "My Whiteboard");
    assert.equal(response.body.ownerId, "user-123");
    assert.ok(response.body._id);
});

test("POST /documents rejects an empty title", async () => {
    const response = await request(app)
        .post("/documents")
        .send({ title: "   " });

    assert.equal(response.status, 400);
});

test("GET /documents lists only the current user's documents", async () => {
    await Document.create([
        { title: "User 123 board", ownerId: "user-123" },
        { title: "User 456 board", ownerId: "user-456" }
    ]);

    const response = await request(app)
        .get("/documents");

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].title, "User 123 board");
});

test("GET /documents/:id retrieves an owned document", async () => {
    const document = await Document.create({
        title: "Board",
        ownerId: "user-123"
    });

    const response = await request(app)
        .get(`/documents/${document._id}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.title, "Board");
});

test("GET /documents/:id denies access to another user's document", async () => {
    const document = await Document.create({
        title: "Private board",
        ownerId: "user-456"
    });

    const response = await request(app)
        .get(`/documents/${document._id}`);

    assert.equal(response.status, 404);
});

test("PATCH /documents/:id renames an owned document", async () => {
    const document = await Document.create({
        title: "Old title",
        ownerId: "user-123"
    });

    const response = await request(app)
        .patch(`/documents/${document._id}`)
        .send({ title: "New title" });

    assert.equal(response.status, 200);
    assert.equal(response.body.title, "New title");
});

test("PATCH /documents/:id rejects an attempted ownership change", async () => {
    const document = await Document.create({
        title: "My board",
        ownerId: "user-123"
    });

    const response = await request(app)
        .patch(`/documents/${document._id}`)
        .send({
            title: "Hijacked board",
            ownerId: "user-456"
        });

    assert.equal(response.status, 400);

    const unchanged = await Document.findById(document._id);
    assert.equal(unchanged.ownerId, "user-123");
    assert.equal(unchanged.title, "My board");
});

test("DELETE /documents/:id deletes an owned document", async () => {
    const document = await Document.create({
        title: "Disposable board",
        ownerId: "user-123"
    });

    const response = await request(app)
        .delete(`/documents/${document._id}`);

    assert.equal(response.status, 204);

    const deleted = await Document.findById(document._id);
    assert.equal(deleted, null);
});

test("DELETE /documents/:id cannot delete another user's document", async () => {
    const document = await Document.create({
        title: "Not my board",
        ownerId: "user-456"
    });

    const response = await request(app)
        .delete(`/documents/${document._id}`);

    assert.equal(response.status, 404);

    const stillExists = await Document.findById(document._id);
    assert.ok(stillExists);
});

test("GET /documents/:id rejects malformed IDs", async () => {
    const response = await request(app)
        .get("/documents/not-a-valid-id");

    assert.equal(response.status, 400);
});