"use strict";

const mysql = require("mysql2/promise");

function requireEnv(name, value) {
	if (value == null || String(value).trim() === "") {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

function createPool(cfg) {
	const host = requireEnv("DB_HOST", cfg.host);
	const user = requireEnv("DB_USER", cfg.user);
	const database = requireEnv("DB_NAME", cfg.database);

	return mysql.createPool({
		host,
		port: cfg.port || 3306,
		user,
		password: cfg.password || "",
		database,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0,
		namedPlaceholders: true,
		dateStrings: true,
	});
}

module.exports = {
	createPool,
};
