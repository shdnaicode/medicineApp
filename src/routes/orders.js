"use strict";

const express = require("express");

function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function safeTrim(value) {
	return String(value ?? "").trim();
}

function generateOrderCode() {
	return `ord_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function parseOrderedMedicines(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((m) => ({
			name: safeTrim(m?.name),
			weight: Number(m?.weight),
			unit: safeTrim(m?.unit),
		}))
		.filter((m) => isNonEmptyString(m.name) && Number.isFinite(m.weight) && m.weight > 0 && isNonEmptyString(m.unit));
}

function parseBoilingMethods(value) {
	if (!Array.isArray(value)) return [];
	return value.map((v) => safeTrim(v)).filter((v) => v.length > 0);
}

function createOrdersRouter({ pool }) {
	const router = express.Router();

	// Create a new draft order
	router.post("/draft", async (req, res) => {
		try {
			const body = req.body || {};
			const orderDate = safeTrim(body.date);
			const doctorName = safeTrim(body.doctorName);
			const patientName = safeTrim(body.patientName);
			const hn = safeTrim(body.hn);
			const boilingMethods = parseBoilingMethods(body.boilingMethods);
			const items = parseOrderedMedicines(body.orderedMedicines);

			if (!isNonEmptyString(orderDate)) return res.status(400).json({ ok: false, error: "Missing date" });
			if (!isNonEmptyString(doctorName)) return res.status(400).json({ ok: false, error: "Missing doctorName" });
			if (!isNonEmptyString(patientName)) return res.status(400).json({ ok: false, error: "Missing patientName" });
			if (!isNonEmptyString(hn)) return res.status(400).json({ ok: false, error: "Missing hn" });
			if (items.length === 0) return res.status(400).json({ ok: false, error: "No ordered medicines" });
			if (boilingMethods.length === 0) return res.status(400).json({ ok: false, error: "No boiling methods" });

			const orderCode = generateOrderCode();
			const conn = await pool.getConnection();
			try {
				await conn.beginTransaction();
				const [result] = await conn.execute(
					`INSERT INTO orders (order_code, order_date, doctor_name, patient_name, hn, boiling_methods_json, status)
					 VALUES (:order_code, :order_date, :doctor_name, :patient_name, :hn, CAST(:methods AS JSON), 'draft')`,
					{
						order_code: orderCode,
						order_date: orderDate,
						doctor_name: doctorName,
						patient_name: patientName,
						hn,
						methods: JSON.stringify(boilingMethods),
					},
				);

				const orderId = result.insertId;
				for (const item of items) {
					await conn.execute(
						`INSERT INTO order_items (order_id, medicine_name, medicine_weight, medicine_unit)
						 VALUES (:order_id, :medicine_name, :medicine_weight, :medicine_unit)`,
						{
							order_id: orderId,
							medicine_name: item.name,
							medicine_weight: item.weight,
							medicine_unit: item.unit,
						},
					);
				}
				await conn.commit();
				res.json({ ok: true, orderId, orderCode });
			} catch (err) {
				await conn.rollback();
				throw err;
			} finally {
				conn.release();
			}
		} catch (err) {
			res.status(500).json({ ok: false, error: String(err?.message || err) });
		}
	});

	// Fetch an order (draft/confirmed)
	router.get("/:id", async (req, res) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" });

			const [orderRows] = await pool.execute(
				`SELECT id, order_code, order_date, doctor_name, patient_name, hn,
				        JSON_EXTRACT(boiling_methods_json, '$') AS boiling_methods,
				        status, created_at, confirmed_at
				   FROM orders
				  WHERE id = :id`,
				{ id },
			);

			if (!Array.isArray(orderRows) || orderRows.length === 0) {
				return res.status(404).json({ ok: false, error: "Order not found" });
			}
			const order = orderRows[0];

			const [itemRows] = await pool.execute(
				`SELECT medicine_name, medicine_weight, medicine_unit
				   FROM order_items
				  WHERE order_id = :id
				  ORDER BY id ASC`,
				{ id },
			);

			let boilingMethods = [];
			try {
				boilingMethods = JSON.parse(order.boiling_methods || "[]");
			} catch {
				boilingMethods = [];
			}

			res.json({
				ok: true,
				order: {
					id: order.id,
					orderCode: order.order_code,
					date: order.order_date,
					doctorName: order.doctor_name,
					patientName: order.patient_name,
					hn: order.hn,
					boilingMethods,
					orderedMedicines: Array.isArray(itemRows)
						? itemRows.map((r) => ({ name: r.medicine_name, weight: Number(r.medicine_weight), unit: r.medicine_unit }))
						: [],
					status: order.status,
					createdAt: order.created_at,
					confirmedAt: order.confirmed_at,
				},
			});
		} catch (err) {
			res.status(500).json({ ok: false, error: String(err?.message || err) });
		}
	});

	// Confirm an order (moves to the next "channel")
	router.post("/:id/confirm", async (req, res) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" });

			const [result] = await pool.execute(
				`UPDATE orders
				   SET status = 'confirmed', confirmed_at = NOW()
				 WHERE id = :id AND status = 'draft'`,
				{ id },
			);

			if (result.affectedRows === 0) {
				return res.status(409).json({ ok: false, error: "Order is not in draft state" });
			}

			res.json({ ok: true });
		} catch (err) {
			res.status(500).json({ ok: false, error: String(err?.message || err) });
		}
	});

	// List orders (history channel)
	router.get("/", async (req, res) => {
		try {
			const status = String(req.query.status || "confirmed");
			if (!['draft','confirmed'].includes(status)) return res.status(400).json({ ok: false, error: "Invalid status" });

			// Optional filters (used by history page)
			const date = safeTrim(req.query.date);
			const doctor = safeTrim(req.query.doctor);
			const hn = safeTrim(req.query.hn);
			const patient = safeTrim(req.query.patient);

			let where = "WHERE status = :status";
			const params = { status };
			if (date) {
				where += " AND order_date = :date";
				params.date = date;
			}
			if (doctor) {
				where += " AND doctor_name LIKE :doctor";
				params.doctor = `%${doctor}%`;
			}
			if (hn) {
				where += " AND hn LIKE :hn";
				params.hn = `%${hn}%`;
			}
			if (patient) {
				where += " AND patient_name LIKE :patient";
				params.patient = `%${patient}%`;
			}

			const [rows] = await pool.execute(
				`SELECT id, order_date, doctor_name, patient_name, hn,
				        JSON_EXTRACT(boiling_methods_json, '$') AS boiling_methods,
				        status, created_at, confirmed_at
				   FROM orders
				   ${where}
				   ORDER BY COALESCE(confirmed_at, created_at) DESC
				   LIMIT 500`,
				params,
			);
			const baseOrders = Array.isArray(rows) ? rows : [];
			const orderIds = baseOrders.map((r) => r.id);

			let itemsByOrderId = new Map();
			if (orderIds.length > 0) {
				const [itemRows] = await pool.query(
					`SELECT order_id, medicine_name, medicine_weight, medicine_unit
					   FROM order_items
					  WHERE order_id IN (${orderIds.map(() => "?").join(",")})
					  ORDER BY order_id ASC, id ASC`,
					orderIds,
				);
				itemsByOrderId = new Map();
				(Array.isArray(itemRows) ? itemRows : []).forEach((r) => {
					if (!itemsByOrderId.has(r.order_id)) itemsByOrderId.set(r.order_id, []);
					itemsByOrderId.get(r.order_id).push({
						name: r.medicine_name,
						weight: Number(r.medicine_weight),
						unit: r.medicine_unit,
					});
				});
			}

			const orders = baseOrders.map((r) => {
				let methods = [];
				try {
					methods = JSON.parse(r.boiling_methods || "[]");
				} catch {
					methods = [];
				}
				return {
					id: r.id,
					date: r.order_date,
					doctorName: r.doctor_name,
					patientName: r.patient_name,
					hn: r.hn,
					boilingMethods: methods,
					orderedMedicines: itemsByOrderId.get(r.id) || [],
					status: r.status,
					createdAt: r.created_at,
					confirmedAt: r.confirmed_at,
				};
			});

			res.json({ ok: true, orders });
		} catch (err) {
			res.status(500).json({ ok: false, error: String(err?.message || err) });
		}
	});

	return router;
}

module.exports = {
	createOrdersRouter,
};
