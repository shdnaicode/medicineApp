"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");

const { createPool } = require("./src/db/pool");
const { createOrdersRouter } = require("./src/routes/orders");

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = createPool({
	host: process.env.DB_HOST,
	port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
	try {
		const [rows] = await pool.query("SELECT 1 AS ok");
		res.json({ ok: true, db: true, rows });
	} catch (err) {
		res.status(500).json({ ok: false, db: false, error: String(err?.message || err) });
	}
});

app.use("/api/orders", createOrdersRouter({ pool }));

// Serve the existing static front-end from the repo root
app.use(express.static(path.join(__dirname)));

app.listen(port, () => {
	// eslint-disable-next-line no-console
	console.log(`MedicineApp server running: http://localhost:${port}`);
});
