"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function requireEnv(name) {
	const v = process.env[name];
	if (v == null || String(v).trim() === "") {
		throw new Error(`Missing required env var: ${name}`);
	}
	return v;
}

async function main() {
	const host = requireEnv("DB_HOST");
	const user = requireEnv("DB_USER");
	const password = process.env.DB_PASSWORD || "";
	const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;

	const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
	const sql = fs.readFileSync(schemaPath, "utf8");

	const conn = await mysql.createConnection({
		host,
		port,
		user,
		password,
		multipleStatements: true,
	});
	try {
		await conn.query(sql);
		// eslint-disable-next-line no-console
		console.log("Database schema applied successfully.");
	} finally {
		await conn.end();
	}
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error("DB setup failed:", err?.message || err);
	process.exit(1);
});
