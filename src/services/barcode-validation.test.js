import test from "node:test";
import assert from "node:assert/strict";
import { validateLocalBarcode } from "./barcode-validation.js";

const products = [
  { sku: "SIM-TON-CF258A", gtin: "1234567890123", name: "Toner HP 58A" },
  { sku: "SIM-TON-W1105A", gtin: "9876543210123", name: "Toner HP 105A" }
];

test("valida un SKU exacto", () => {
  const result = validateLocalBarcode(products, "sim-ton-cf258a");
  assert.equal(result.found, true);
  assert.equal(result.matchType, "SKU_EXACT");
  assert.equal(result.product.sku, "SIM-TON-CF258A");
});

test("valida un GTIN exacto", () => {
  const result = validateLocalBarcode(products, "1234567890123");
  assert.equal(result.found, true);
  assert.equal(result.matchType, "GTIN_EXACT");
});

test("resuelve una referencia corta al SKU SIM-TON", () => {
  const result = validateLocalBarcode(products, "CF258A");
  assert.equal(result.found, true);
  assert.equal(result.matchType, "SIM_TON_REFERENCE");
  assert.equal(result.localSku, "SIM-TON-CF258A");
});

test("no acepta coincidencias parciales", () => {
  const result = validateLocalBarcode(products, "CF258");
  assert.equal(result.found, false);
  assert.equal(result.reason, "NOT_FOUND");
});

test("rechaza un barcode asociado a varios productos", () => {
  const duplicated = [
    ...products,
    { sku: "SIM-TON-OTRO", gtin: "1234567890123", name: "Duplicado" }
  ];
  const result = validateLocalBarcode(duplicated, "1234567890123");
  assert.equal(result.found, false);
  assert.equal(result.ambiguous, true);
  assert.equal(result.matches.length, 2);
});
