import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  ArrowDownLeft, ClipboardList, Plus, Minus, PlusCircle,
  X, Check, Barcode, ShieldAlert, Search,
  Keyboard, Sparkles, Link2, Printer, Loader2
} from "lucide-react";
import { audioService } from "../services/audio";
import { storageService } from "../services/storage";
import { bcService } from "../services/bc-api";
import { validateLocalBarcode } from "../services/barcode-validation";
import { BarcodeGenerator } from "./BarcodeGenerator";

export function ZebraScanner({ products, onMovementRegistered, initialProduct, onClearInitialProduct }) {
  const [mode, setMode] = useState("ENTRADA"); // 'ENTRADA' | 'CONTEO'
  const [laserInput, setLaserInput] = useState("");
  const [matchedProduct, setMatchedProduct] = useState(initialProduct || null);
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const [lastScanValidation, setLastScanValidation] = useState(null);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [isVirtualKeyboardActive, setIsVirtualKeyboardActive] = useState(false);

  // Link barcode to existing product modal
  const [showLinkBarcodeModal, setShowLinkBarcodeModal] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");

  // Barcode Label Print Modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Serial list for serialized products & quantity
  const [quantity, setQuantity] = useState(1);
  const [serialLaserInput, setSerialLaserInput] = useState("");
  const [scannedSerials, setScannedSerials] = useState([]);
  
  const location = "COTA-A01-N1-P01";
  const [notes, setNotes] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [laserFlash, setLaserFlash] = useState(false);

  // New Product Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProdData, setNewProdData] = useState({
    sku: "",
    name: "",
    brand: "Genérico / Otras",
    category: "Impresión y Suministros",
    uom: "PCS",
    stock: 0,
    unitCost: 0,
    unitPrice: 0,
    gtin: "",
    isSerialized: false
  });

  const skuReceiverRef = useRef(null);
  const serialReceiverRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const serialDebounceTimerRef = useRef(null);

  // Set initial product if passed from catalog
  useEffect(() => {
    if (initialProduct) {
      setMatchedProduct(initialProduct);
      setLastScanValidation(null);
      setScannedSerials([]);
      setQuantity(mode === "CONTEO" ? (initialProduct.stock || 1) : 1);
      if (onClearInitialProduct) onClearInitialProduct();
    }
  }, [initialProduct, mode, onClearInitialProduct]);

  // Keep laser receiver focused when waiting for scan
  const maintainFocus = useCallback(() => {
    if (showCreateModal || showCatalogPicker || showLinkBarcodeModal || showPrintModal) return;
    if (!matchedProduct) {
      if (skuReceiverRef.current && document.activeElement !== skuReceiverRef.current) {
        skuReceiverRef.current.focus({ preventScroll: true });
      }
    } else if (matchedProduct && matchedProduct.isSerialized) {
      if (serialReceiverRef.current && document.activeElement !== serialReceiverRef.current) {
        serialReceiverRef.current.focus({ preventScroll: true });
      }
    }
  }, [matchedProduct, showCreateModal, showCatalogPicker, showLinkBarcodeModal, showPrintModal]);

  useEffect(() => {
    maintainFocus();
    const interval = setInterval(maintainFocus, 1000);
    return () => clearInterval(interval);
  }, [maintainFocus]);

  // Trigger brief visual green laser flash on scan
  const triggerLaserFlash = () => {
    setLaserFlash(true);
    setTimeout(() => setLaserFlash(false), 250);
  };

  const selectProduct = useCallback((prod, validation = null) => {
    setMatchedProduct(prod);
    setUnknownBarcode(null);
    setLastScanValidation(validation);
    setScannedSerials([]);
    setQuantity(mode === "CONTEO" ? (prod.stock || 1) : 1);
    setLaserInput("");
    setSerialLaserInput("");
    setShowCatalogPicker(false);
    setShowLinkBarcodeModal(false);
    audioService.playSuccess();

    if (validation?.found) {
      setSuccessMsg(`✓ Validado localmente por ${validation.matchLabel}: ${validation.scannedCode} → ${prod.sku}`);
    } else {
      setSuccessMsg(`✓ Producto cargado: ${prod.sku}`);
    }
    setTimeout(() => setSuccessMsg(""), 3000);
  }, [mode]);

  // =========================================================================
  // AUTOMATIC SKU & GLOBAL BARCODE SCAN ENGINE
  // =========================================================================
  const processSkuScan = useCallback((rawCode) => {
    const validation = validateLocalBarcode(products, rawCode);
    const clean = validation.scannedCode;
    if (!clean || validation.reason === "INVALID_CODE") return;

    triggerLaserFlash();

    if (validation.found) {
      setLaserInput("");
      selectProduct(validation.product, validation);
    } else {
      setLaserInput("");
      setMatchedProduct(null);
      setUnknownBarcode(clean);
      setLastScanValidation(validation);
      audioService.playError();
      setErrorMsg(validation.ambiguous
        ? `⚠️ El código "${clean}" está repetido en ${validation.matches.length} productos locales.`
        : `⚠️ El código "${clean}" no existe en el catálogo local (${validation.catalogSize} productos revisados).`
      );
      setTimeout(() => setErrorMsg(""), 4500);
    }
  }, [products, selectProduct]);

  const handleSkuInputChange = (e) => {
    const val = e.target.value;
    setLaserInput(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const clean = val.trim().toUpperCase();

    // Immediate exact or smart-pairing match trigger
    const exactProd = products.find(p => 
      p.sku.toUpperCase() === clean || 
      (p.gtin && p.gtin.toUpperCase() === clean) ||
      p.sku.toUpperCase() === `SIM-TON-${clean}` ||
      p.sku.toUpperCase().replace(/^SIM-TON-/, "") === clean
    );
    if (exactProd) {
      processSkuScan(clean);
      return;
    }

    // Fast burst debouncer for hardware laser scanner (50ms)
    if (clean.length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        processSkuScan(clean);
      }, 60);
    }
  };

  // Toggle serialization dynamically for current product
  const toggleSerialization = () => {
    if (!matchedProduct) return;
    const updated = {
      ...matchedProduct,
      isSerialized: !matchedProduct.isSerialized
    };
    setMatchedProduct(updated);
    if (!updated.isSerialized) {
      setQuantity(Math.max(1, scannedSerials.length || quantity));
    }
  };

  // =========================================================================
  // LINK GLOBAL BARCODE TO EXISTING PRODUCT
  // =========================================================================
  const handleLinkBarcodeToProduct = (prod) => {
    if (!unknownBarcode) return;
    const updated = storageService.linkProductBarcode(prod.sku, unknownBarcode);
    audioService.playSuccess();
    onMovementRegistered();
    setShowLinkBarcodeModal(false);
    const barcodeSaved = unknownBarcode;
    setUnknownBarcode(null);

    if (updated) {
      selectProduct(updated, {
        found: true,
        scannedCode: barcodeSaved,
        matchLabel: "barcode vinculado",
        localSku: updated.sku,
        localGtin: updated.gtin,
        catalogSize: products.length
      });
      setSuccessMsg(`✓ ¡Código "${barcodeSaved}" vinculado permanentemente a "${updated.sku}"!`);
      setTimeout(() => setSuccessMsg(""), 5000);
    }
  };

  // =========================================================================
  // AUTOMATIC SERIAL NUMBER BURST SCAN ENGINE
  // =========================================================================
  const processSerialScan = useCallback((rawSerial) => {
    const s = (rawSerial || "").trim().toUpperCase();
    if (!s || s.length < 2) return;

    triggerLaserFlash();

    if (scannedSerials.includes(s)) {
      setSerialLaserInput("");
      audioService.playError();
      setErrorMsg(`⚠️ El serial "${s}" ya está en la lista.`);
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    const updated = [...scannedSerials, s];
    setScannedSerials(updated);
    setQuantity(updated.length);
    setSerialLaserInput("");
    audioService.playSuccess();
    setSuccessMsg(`✓ Serial #${updated.length} registrado: ${s}`);
    setTimeout(() => setSuccessMsg(""), 2000);
  }, [scannedSerials]);

  const handleSerialInputChange = (e) => {
    const val = e.target.value;
    setSerialLaserInput(val);

    if (serialDebounceTimerRef.current) clearTimeout(serialDebounceTimerRef.current);

    const clean = val.trim().toUpperCase();
    if (clean.length >= 2) {
      serialDebounceTimerRef.current = setTimeout(() => {
        processSerialScan(clean);
      }, 60);
    }
  };

  const removeSerial = (indexToRemove) => {
    const updated = scannedSerials.filter((_, i) => i !== indexToRemove);
    setScannedSerials(updated);
    setQuantity(Math.max(1, updated.length));
  };

  // Process transaction to Business Central Cloud
  const handleProcessTransaction = async () => {
    if (!matchedProduct) return;
    setIsProcessing(true);

    const finalQty = matchedProduct.isSerialized ? scannedSerials.length : Number(quantity);
    if (finalQty <= 0) {
      setErrorMsg("La cantidad debe ser mayor a 0.");
      setIsProcessing(false);
      return;
    }

    const movementData = {
      type: mode,
      sku: matchedProduct.sku,
      productName: matchedProduct.name,
      quantity: finalQty,
      serialNo: scannedSerials.length > 0 ? scannedSerials.join(", ") : "N/A",
      serialList: scannedSerials,
      location: "COTA",
      bin: location || "COTA-A01-N1-P01",
      user: storageService.getUserRole(),
      note: notes || `${mode === "ENTRADA" ? "Recepción" : "Toma Física / Conteo"} desde Zebra TC22 (Piloto)`
    };

    try {
      const bcRes = await bcService.postMovement(movementData);
      onMovementRegistered();

      if (bcRes && bcRes.success) {
        audioService.playSuccess();
        setSuccessMsg(
          `✓ ${mode === "ENTRADA" ? "¡Entrada registrada!" : "¡Conteo Físico Guardado!"} ${finalQty} ${matchedProduct.uom} de ${matchedProduct.sku} (Asentado en BC Cloud)`
        );
      } else {
        audioService.playError();
        setErrorMsg(bcRes?.message || "⚠️ Guardado en Kardex local pero pendiente en Business Central.");
        setTimeout(() => setErrorMsg(""), 6000);
      }

      // Reset to be ready for next product immediately
      setMatchedProduct(null);
      setScannedSerials([]);
      setQuantity(1);
      setNotes("");
      setLaserInput("");
      setSerialLaserInput("");
    } catch (e) {
      audioService.playError();
      setErrorMsg("Error al procesar: " + (e.message || "Error de conexión"));
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSuccessMsg(""), 6000);
    }
  };

  // Open Create Product Modal
  const handleOpenCreateModal = (skuOrBarcodePrefill = "") => {
    setNewProdData({
      sku: skuOrBarcodePrefill || "",
      name: "",
      brand: "Genérico / Otras",
      category: "Impresión y Suministros",
      uom: "PCS",
      stock: 0,
      unitCost: 0,
      unitPrice: 0,
      gtin: skuOrBarcodePrefill || "",
      isSerialized: false
    });
    setShowCreateModal(true);
  };

  const handleSaveNewProduct = async (e) => {
    e.preventDefault();
    if (!newProdData.sku || !newProdData.name) {
      alert("SKU y Nombre son obligatorios");
      return;
    }

    try {
      const result = await bcService.createProduct(newProdData);
      if (!result.success) throw new Error(result.error || "No se pudo crear el producto");
      audioService.playSuccess();
      onMovementRegistered();
      setShowCreateModal(false);
      setUnknownBarcode(null);

      const created = {
        ...result.product,
        stock: Number(result.product.stock) || 0,
        unitCost: Number(result.product.unitCost) || 0,
        unitPrice: Number(result.product.unitPrice) || Math.round((Number(result.product.unitCost) || 0) * 1.30)
      };
      selectProduct(created);
      setSuccessMsg(`✓ Producto "${created.sku}" creado en Business Central`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Error al crear producto: " + err.message);
    }
  };

  // Quick delta calculation for physical inventory audit
  const stockDelta = matchedProduct ? (quantity - (matchedProduct.stock || 0)) : 0;

  return (
    <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto", padding: "0.65rem 0.55rem", boxSizing: "border-box", overflowX: "hidden" }}>
      
      {/* Top Mode Selector Neumorphic (Entrada vs Conteo) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.85rem" }}>
        <button 
          type="button"
          className={`px-btn ${mode === "ENTRADA" ? "px-btn--primary" : "px-btn--secondary"}`}
          onClick={() => { setMode("ENTRADA"); setMatchedProduct(null); setScannedSerials([]); setQuantity(1); }}
          style={{ 
            background: mode === "ENTRADA" ? "var(--px-gradient-green)" : undefined, 
            color: mode === "ENTRADA" ? "#ffffff" : "var(--px-text-strong)", 
            minHeight: "48px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.9rem", borderRadius: "var(--px-radius-md)"
          }}
        >
          <ArrowDownLeft size={18} /> Entrada (Recepción)
        </button>

        <button 
          type="button"
          className={`px-btn ${mode === "CONTEO" ? "px-btn--primary" : "px-btn--secondary"}`}
          onClick={() => { setMode("CONTEO"); setMatchedProduct(null); setScannedSerials([]); setQuantity(1); }}
          style={{ 
            background: mode === "CONTEO" ? "var(--px-gradient-purple)" : undefined, 
            color: mode === "CONTEO" ? "#ffffff" : "var(--px-text-strong)", 
            minHeight: "48px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.9rem", borderRadius: "var(--px-radius-md)"
          }}
        >
          <ClipboardList size={18} /> Conteo Físico
        </button>
      </div>

      {/* Pilot Inventory Active Notice */}
      <div style={{ marginBottom: "0.65rem", padding: "0.45rem 0.75rem", background: "rgba(106, 63, 160, 0.08)", border: "1px solid rgba(106, 63, 160, 0.2)", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem" }}>
        <span style={{ color: "var(--px-text-strong)", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
          <Sparkles size={14} color="var(--px-purple)" />
          <span>Prueba Piloto: <strong>Suministros y Tecnología</strong></span>
        </span>
        <span className="px-chip" style={{ fontSize: "0.68rem", background: "#fff" }}>
          Código Global / GTIN Activo
        </span>
      </div>

      {/* Status Alerts */}
      {successMsg && (
        <div className="px-badge px-badge--success" style={{ width: "100%", padding: "0.75rem", fontSize: "0.85rem", marginBottom: "0.65rem", textAlign: "center", display: "block", boxSizing: "border-box" }}>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="px-badge px-badge--danger" style={{ width: "100%", padding: "0.75rem", fontSize: "0.85rem", marginBottom: "0.65rem", textAlign: "center", display: "block", boxSizing: "border-box" }}>
          {errorMsg}
        </div>
      )}

      {/* =========================================================================
          SCREEN STATE 1: WAITING FOR PRODUCT SCAN (AUTO-TRIGGER POINT & SHOOT)
          ========================================================================= */}
      {!matchedProduct && (
        <div className="px-glass-panel" style={{ padding: "1rem", textAlign: "center", position: "relative", marginBottom: "0.75rem" }}>
          
          {/* Laser Receiver Box with Auto-Trigger & Flash */}
          <div style={{ 
            padding: "0.85rem", 
            background: laserFlash ? "rgba(22, 163, 74, 0.25)" : "rgba(22, 163, 74, 0.06)", 
            border: `2px solid ${laserFlash ? "var(--px-green)" : "var(--px-green)"}`, 
            borderRadius: "14px", 
            marginBottom: "0.85rem",
            transition: "background 0.2s ease"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", color: "var(--px-green)", fontWeight: "800", fontSize: "0.95rem", marginBottom: "0.4rem" }}>
              <span className="px-live-dot" style={{ width: "10px", height: "10px" }}></span>
              <span>Láser Zebra Listo: Código de Barras o SKU</span>
            </div>

            {/* DIRECT HARDWARE SCAN RECEIVER INPUT WITH AUTO-SUBMIT */}
            <form onSubmit={(e) => { e.preventDefault(); processSkuScan(laserInput); }} style={{ display: "flex", gap: "0.45rem", alignItems: "stretch", width: "100%" }}>
              <div style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
                <input 
                  ref={skuReceiverRef}
                  type="text"
                  inputMode={isVirtualKeyboardActive ? "text" : "none"}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  autoCapitalize="characters"
                  placeholder={isVirtualKeyboardActive ? "Escribe SKU o código..." : "Apunta el láser al código..."}
                  value={laserInput}
                  onChange={handleSkuInputChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      processSkuScan(e.target.value);
                    }
                  }}
                  className="px-input"
                  style={{ 
                    height: "48px", 
                    fontSize: "0.92rem", 
                    fontWeight: "800", 
                    borderRadius: "12px", 
                    textAlign: "left",
                    paddingLeft: "2.3rem",
                    paddingRight: "0.75rem",
                    border: `1.5px solid ${isVirtualKeyboardActive ? "var(--px-blue)" : "var(--px-green)"}`,
                    background: "var(--px-surface-sunken)",
                    boxSizing: "border-box",
                    width: "100%"
                  }}
                />
                <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <span className="px-live-dot" style={{ width: "8px", height: "8px" }}></span>
                </span>
              </div>

              <button 
                type="submit" 
                className="px-btn px-btn--primary"
                style={{ 
                  background: "var(--px-gradient-brand)", 
                  minWidth: "80px", 
                  borderRadius: "12px", 
                  fontWeight: "800",
                  fontSize: "0.85rem",
                  flexShrink: 0
                }}
              >
                <Search size={15} /> Buscar
              </button>
            </form>

            <div style={{ fontSize: "0.74rem", color: "var(--px-muted)", marginTop: "0.4rem" }}>
              ⚡ Reconoce códigos de fábrica EAN-13, UPC, GTIN y SKU interno
            </div>
          </div>

          {/* Action Row: Toggle Soft Keyboard, Search Catalog & Create New Product */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.45rem", marginBottom: "0.85rem" }}>
            <button 
              type="button" 
              className={`px-btn ${isVirtualKeyboardActive ? "px-btn--primary" : "px-btn--secondary"}`}
              onClick={() => {
                const next = !isVirtualKeyboardActive;
                setIsVirtualKeyboardActive(next);
                setTimeout(() => {
                  if (skuReceiverRef.current) skuReceiverRef.current.focus();
                }, 100);
              }}
              style={{ minHeight: "42px", borderRadius: "12px", fontSize: "0.76rem", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
            >
              <Keyboard size={15} /> {isVirtualKeyboardActive ? "Ocultar Teclado" : "Teclado"}
            </button>

            <button 
              type="button" 
              className="px-btn px-btn--secondary"
              onClick={() => setShowCatalogPicker(true)}
              style={{ minHeight: "42px", borderRadius: "12px", fontSize: "0.76rem", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
            >
              <Search size={15} /> Catálogo
            </button>

            <button 
              type="button" 
              className="px-btn px-btn--primary"
              onClick={() => handleOpenCreateModal("")}
              style={{ minHeight: "42px", borderRadius: "12px", fontSize: "0.76rem", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", background: "var(--px-gradient-green)" }}
            >
              <PlusCircle size={15} /> Nuevo SKU
            </button>
          </div>

          {/* Top Real Inventory Toners for Fast Access */}
          <div style={{ borderTop: "1px solid var(--px-border)", paddingTop: "0.65rem" }}>
            <div style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--px-muted)", marginBottom: "0.45rem" }}>
              Tóners más frecuentes en bodega:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", justifyContent: "center" }}>
              {[
                { label: "HP CF258A (58A)", sku: "SIM-TON-CF258A" },
                { label: "HP W1500A (150A)", sku: "SIM-TON-W1500A" },
                { label: "HP W1105A (105A)", sku: "SIM-TON-W1105A" },
                { label: "HP W1510A (151A)", sku: "SIM-TON-W1510A" },
                { label: "Kyocera TK-3162", sku: "SIM-TON-TK3162" },
                { label: "Samsung MLT-D111S", sku: "SIM-TON-MLTD111S" }
              ].map(item => (
                <button 
                  key={item.sku} 
                  type="button"
                  className="px-chip" 
                  onClick={() => { 
                    const prod = products.find(p => p.sku.toUpperCase() === item.sku.toUpperCase()); 
                    if (prod) selectProduct(prod); 
                  }}
                  style={{ fontSize: "0.74rem", padding: "5px 10px", cursor: "pointer", borderRadius: "var(--px-radius-pill)", fontWeight: "700" }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unknown Barcode Alert with 2 Options: 1) Link to existing product OR 2) Create new */}
          {unknownBarcode && (
            <div style={{ marginTop: "0.85rem", padding: "0.85rem", background: "rgba(239, 68, 68, 0.08)", border: "1.5px solid rgba(239, 68, 68, 0.25)", borderRadius: "14px", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--px-red)", fontWeight: "800", fontSize: "0.88rem", marginBottom: "0.3rem" }}>
                <ShieldAlert size={17} /> Código Escaneado: "{unknownBarcode}"
              </div>
              <p style={{ fontSize: "0.76rem", color: "var(--px-muted)", margin: "0 0 0.65rem 0" }}>
                {lastScanValidation?.ambiguous
                  ? "Este código está asociado a más de un producto local. Debes corregir la asociación antes de continuar."
                  : `No existe una coincidencia exacta por SKU, GTIN o referencia SIM-TON en los ${lastScanValidation?.catalogSize || products.length} productos del catálogo local.`}
              </p>

              {lastScanValidation?.ambiguous && (
                <div style={{ marginBottom: "0.65rem", fontSize: "0.76rem", color: "var(--px-text-strong)" }}>
                  Coincidencias locales: {lastScanValidation.matches.map(match => match.localSku).join(", ")}
                </div>
              )}

              {!lastScanValidation?.ambiguous && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                <button 
                  type="button" 
                  className="px-btn px-btn--primary" 
                  onClick={() => setShowLinkBarcodeModal(true)}
                  style={{ background: "var(--px-blue)", fontSize: "0.8rem", minHeight: "44px", borderRadius: "10px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}
                >
                  <Link2 size={15} /> 🔗 Vincular a Producto Existente
                </button>

                <button 
                  type="button" 
                  className="px-btn px-btn--secondary" 
                  onClick={() => handleOpenCreateModal(unknownBarcode)}
                  style={{ fontSize: "0.8rem", minHeight: "44px", borderRadius: "10px", fontWeight: "800", background: "var(--px-green)", color: "#fff" }}
                >
                  + Dar de Alta Nuevo
                </button>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          SCREEN STATE 2: PRODUCT MATCHED (CONFIRMATION & EASY QUANTITY / SERIALS)
          ========================================================================= */}
      {matchedProduct && (
        <div className="px-glass-panel" style={{ border: "2px solid var(--px-blue)", padding: "1.1rem", marginBottom: "0.85rem" }}>
          
          {/* Matched Product Card Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem", borderBottom: "1px solid rgba(215, 224, 240, 0.8)", paddingBottom: "0.65rem" }}>
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                <span className="px-mono" style={{ fontSize: "1.15rem", fontWeight: "800", color: "var(--px-blue)" }}>
                  {matchedProduct.sku}
                </span>
                <span className="px-chip" style={{ fontSize: "0.68rem", padding: "1px 6px", fontWeight: "800" }}>
                  {matchedProduct.brand || "Genérico"}
                </span>
                {matchedProduct.gtin && (
                  <span className="px-chip" style={{ fontSize: "0.65rem", padding: "1px 5px", background: "rgba(22, 163, 74, 0.1)", color: "var(--px-green)", borderColor: "var(--px-green)" }}>
                    GTIN: {matchedProduct.gtin}
                  </span>
                )}
              </div>

              <div style={{ fontWeight: "800", fontSize: "0.95rem", color: "var(--px-text-strong)", marginTop: "2px" }}>
                {matchedProduct.name}
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--px-muted)", marginTop: "2px" }}>
                Categoría: <strong>{matchedProduct.category}</strong> • Ubicación: <strong>{matchedProduct.bin || "Bodega Cota"}</strong>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-end" }}>
              <button 
                type="button" 
                className="px-btn px-btn--sm px-btn--ghost"
                onClick={() => { setMatchedProduct(null); setLastScanValidation(null); setScannedSerials([]); setQuantity(1); }}
                style={{ color: "var(--px-blue)", fontWeight: "800", fontSize: "0.75rem", padding: "2px 6px" }}
              >
                Cambiar
              </button>

              <button 
                type="button"
                className="px-btn px-btn--sm px-btn--secondary"
                onClick={() => setShowPrintModal(true)}
                title="Ver / Imprimir Etiqueta con Código de Barras"
                style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "2px" }}
              >
                <Barcode size={13} /> Etiqueta
              </button>
            </div>
          </div>

          {lastScanValidation?.found && (
            <div style={{ marginBottom: "0.85rem", padding: "0.65rem 0.75rem", background: "rgba(22, 163, 74, 0.08)", border: "1px solid rgba(22, 163, 74, 0.3)", borderRadius: "10px", fontSize: "0.76rem", color: "var(--px-text-strong)" }}>
              <div style={{ color: "var(--px-green)", fontWeight: "800", marginBottom: "0.2rem" }}>
                ✓ Barcode validado contra el catálogo local
              </div>
              <div>
                Leído: <strong className="px-mono">{lastScanValidation.scannedCode}</strong>
                {" • "}Coincidencia: <strong>{lastScanValidation.matchLabel}</strong>
              </div>
              <div>
                SKU local: <strong className="px-mono">{lastScanValidation.localSku}</strong>
                {" • "}GTIN local: <strong className="px-mono">{lastScanValidation.localGtin || "SIN GTIN"}</strong>
                {" • "}Catálogo revisado: <strong>{lastScanValidation.catalogSize}</strong>
              </div>
            </div>
          )}

          {/* PHYSICAL AUDIT METRICS (INVENTARIO EN BC VS CONTEO FÍSICO REAL) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.85rem", background: "rgba(244, 247, 255, 0.9)", padding: "0.65rem", borderRadius: "12px", border: "1px solid rgba(215, 224, 240, 0.8)", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: "0.68rem", color: "var(--px-muted)", textTransform: "uppercase" }}>Stock en BC</div>
              <div className="px-mono" style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--px-text-strong)" }}>
                {matchedProduct.stock || 0} {matchedProduct.uom || "PCS"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.68rem", color: "var(--px-muted)", textTransform: "uppercase" }}>{mode === "CONTEO" ? "Conteo Físico" : "Cantidad Entrada"}</div>
              <div className="px-mono" style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--px-blue)" }}>
                {matchedProduct.isSerialized ? scannedSerials.length : quantity} {matchedProduct.uom || "PCS"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.68rem", color: "var(--px-muted)", textTransform: "uppercase" }}>Diferencia</div>
              <div className="px-mono" style={{ fontSize: "1.1rem", fontWeight: "800", color: stockDelta === 0 ? "var(--px-green)" : stockDelta > 0 ? "var(--px-blue)" : "var(--px-red)" }}>
                {stockDelta > 0 ? `+${stockDelta}` : stockDelta}
              </div>
            </div>
          </div>

          {/* Serialization toggle button if needed */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem", padding: "0.35rem 0.65rem", background: "rgba(21, 101, 192, 0.05)", borderRadius: "8px", fontSize: "0.74rem" }}>
            <span style={{ color: "var(--px-muted)", fontWeight: "600" }}>
              ¿Este ítem usa seriales individuales por unidad?
            </span>
            <button 
              type="button"
              className="px-btn px-btn--sm px-btn--ghost"
              onClick={toggleSerialization}
              style={{ fontWeight: "800", color: matchedProduct.isSerialized ? "var(--px-blue)" : "var(--px-muted)" }}
            >
              {matchedProduct.isSerialized ? "🏷️ SÍ (Con Seriales)" : "📦 NO (Por Cantidad)"}
            </button>
          </div>

          {/* WORKFLOW A: SERIALIZED PRODUCT (BURST LASER SERIAL CAPTURE) */}
          {matchedProduct.isSerialized ? (
            <div style={{ background: "rgba(21, 101, 192, 0.05)", border: "1.5px solid rgba(21, 101, 192, 0.25)", borderRadius: "14px", padding: "0.85rem", marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "var(--px-blue)" }}>
                  🔫 Dispara a los Seriales (Se agregan solos):
                </span>
                <span className="px-badge px-badge--success" style={{ fontSize: "0.75rem", fontWeight: "800" }}>
                  {scannedSerials.length} Seriales
                </span>
              </div>

              {/* Serial Laser Input Receiver with Auto-Submit */}
              <form onSubmit={(e) => { e.preventDefault(); processSerialScan(serialLaserInput); }} style={{ display: "flex", gap: "0.3rem", marginBottom: "0.5rem" }}>
                <input 
                  ref={serialReceiverRef}
                  type="text"
                  inputMode={isVirtualKeyboardActive ? "text" : "none"}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  autoCapitalize="characters"
                  placeholder="🟢 Dispara al código de serie..."
                  value={serialLaserInput}
                  onChange={handleSerialInputChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      processSerialScan(e.target.value);
                    }
                  }}
                  style={{ height: "44px", fontSize: "0.95rem", fontWeight: "800", borderRadius: "10px", textAlign: "center", background: "#fff" }}
                />
                <button 
                  type="submit" 
                  className="px-btn px-btn--primary"
                  style={{ background: "var(--px-blue)", padding: "0 0.85rem", borderRadius: "10px", fontWeight: "700" }}
                >
                  + Serial
                </button>
              </form>

              {/* Scanned serials chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", maxHeight: "120px", overflowY: "auto", padding: "0.35rem", background: "#fff", borderRadius: "10px", border: "1px solid rgba(215, 224, 240, 0.8)" }}>
                {scannedSerials.map((sn, sIdx) => (
                  <span key={sn} className="px-chip px-chip--active" style={{ fontSize: "0.78rem", padding: "3px 8px", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span>#{sIdx + 1}: {sn}</span>
                    <X size={13} style={{ cursor: "pointer", color: "var(--px-red)" }} onClick={() => removeSerial(sIdx)} />
                  </span>
                ))}
                {scannedSerials.length === 0 && (
                  <span style={{ fontSize: "0.75rem", color: "var(--px-muted)", fontStyle: "italic", padding: "4px" }}>
                    Apunta el láser al serial de cada unidad...
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* WORKFLOW B: NON-SERIALIZED PRODUCT (DIRECT NUMBER INPUT + TOUCH CONTROLS) */
            <div style={{ background: "rgba(244, 247, 255, 0.8)", borderRadius: "14px", padding: "0.85rem", marginBottom: "0.85rem", border: "1px solid rgba(215, 224, 240, 0.8)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase" }}>
                  {mode === "ENTRADA" ? "Unidades a Ingresar:" : "Unidades Contadas:"}
                </span>

                {mode === "CONTEO" && (
                  <button 
                    type="button" 
                    className="px-chip px-chip--active"
                    onClick={() => setQuantity(matchedProduct.stock || 0)}
                    style={{ fontSize: "0.7rem", cursor: "pointer", fontWeight: "700" }}
                  >
                    ✓ Igualar a Stock ({matchedProduct.stock || 0})
                  </button>
                )}
              </div>

              {/* Direct Numeric Input with Touch Plus/Minus */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <button 
                  type="button"
                  className="px-btn px-btn--secondary"
                  onClick={() => setQuantity(prev => Math.max(1, (parseInt(prev, 10) || 1) - 1))}
                  style={{ width: "52px", height: "52px", padding: 0, fontSize: "1.4rem", fontWeight: "800", borderRadius: "12px" }}
                >
                  <Minus size={20} />
                </button>

                {/* DIRECT EDITABLE NUMBER INPUT FOR TC22 / PC */}
                <input 
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") setQuantity("");
                    else setQuantity(Math.max(1, parseInt(val, 10) || 1));
                  }}
                  onBlur={() => {
                    if (!quantity || quantity < 1) setQuantity(1);
                  }}
                  className="px-input"
                  style={{ 
                    width: "120px", 
                    height: "52px", 
                    fontSize: "1.7rem", 
                    fontWeight: "800", 
                    textAlign: "center", 
                    color: "var(--px-blue)", 
                    borderRadius: "12px",
                    background: "#ffffff",
                    borderColor: "var(--px-blue)"
                  }}
                />

                <button 
                  type="button"
                  className="px-btn px-btn--secondary"
                  onClick={() => setQuantity(prev => (parseInt(prev, 10) || 0) + 1)}
                  style={{ width: "52px", height: "52px", padding: 0, fontSize: "1.4rem", fontWeight: "800", borderRadius: "12px" }}
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Quick increment buttons */}
              <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center", marginTop: "0.65rem", flexWrap: "wrap" }}>
                {[+5, +10, +25, +50, +100].map(inc => (
                  <button 
                    key={inc}
                    type="button" 
                    className="px-chip" 
                    onClick={() => setQuantity(prev => (parseInt(prev, 10) || 0) + inc)}
                    style={{ fontSize: "0.78rem", padding: "4px 10px", fontWeight: "800", cursor: "pointer" }}
                  >
                    +{inc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Giant Bottom Confirm Button */}
          <button 
            type="button"
            className="px-btn px-btn--primary"
            disabled={isProcessing || (matchedProduct.isSerialized && scannedSerials.length === 0)}
            onClick={handleProcessTransaction}
            style={{ 
              width: "100%", minHeight: "54px", fontSize: "1rem", fontWeight: "800", 
              background: mode === "ENTRADA" ? "var(--px-green)" : "var(--px-purple)", 
              borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              boxShadow: "0 4px 14px rgba(22, 163, 74, 0.3)"
            }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={20} className="px-spin" />
                <span>Asentando en Business Central Cloud...</span>
              </>
            ) : (
              <>
                <Check size={20} />
                <span>
                  {mode === "ENTRADA" 
                    ? `✅ CONFIRMAR ENTRADA (${matchedProduct.isSerialized ? scannedSerials.length : (quantity || 1)} ${matchedProduct.uom || "PCS"})` 
                    : `🟣 ASENTAR CONTEO (${quantity || 1} ${matchedProduct.uom || "PCS"})`}
                </span>
              </>
            )}
          </button>

        </div>
      )}

      {/* =========================================================================
          MODAL 1: LINK SCANNED BARCODE TO EXISTING PRODUCT
          ========================================================================= */}
      {showLinkBarcodeModal && (
        <div className="px-drawer-overlay" onClick={() => setShowLinkBarcodeModal(false)}>
          <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", borderBottom: "1px solid rgba(215, 224, 240, 0.8)", paddingBottom: "0.65rem" }}>
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: "800", margin: 0, color: "var(--px-blue)" }}>
                  🔗 Vincular Código de Barras
                </h2>
                <div style={{ fontSize: "0.78rem", color: "var(--px-muted)", marginTop: "2px" }}>
                  Código escaneado: <strong className="px-mono" style={{ color: "var(--px-text-strong)" }}>{unknownBarcode}</strong>
                </div>
              </div>
              <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setShowLinkBarcodeModal(false)}>
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--px-muted)", margin: "0 0 0.75rem 0" }}>
              Busca el producto de Business Central al que le pertenece este código de barras físico:
            </p>

            <input 
              type="text" 
              className="px-input" 
              placeholder="Escribe el nombre o SKU (ej. Resma, Toner 58A, MK250, Latitude)..."
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              style={{ height: "44px", fontSize: "0.92rem", marginBottom: "0.75rem", borderRadius: "10px" }}
              autoFocus
            />

            <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {products.filter(p => {
                const q = linkSearch.toLowerCase().trim();
                if (!q) return true;
                return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q));
              }).slice(0, 25).map(p => (
                <div 
                  key={p.sku}
                  onClick={() => handleLinkBarcodeToProduct(p)}
                  style={{ padding: "0.6rem 0.75rem", background: "rgba(244, 247, 255, 0.8)", borderRadius: "10px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(215, 224, 240, 0.8)" }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-blue)", fontSize: "0.85rem" }}>{p.sku}</span>
                      <span className="px-chip" style={{ fontSize: "0.62rem" }}>{p.brand || "Genérico"}</span>
                      <span className="px-chip" style={{ fontSize: "0.62rem" }}>{p.category}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--px-text-strong)", marginTop: "2px" }}>{p.name}</div>
                  </div>
                  <button 
                    type="button" 
                    className="px-btn px-btn--sm px-btn--primary"
                    style={{ fontSize: "0.75rem", padding: "4px 8px", background: "var(--px-blue)", borderRadius: "8px", flexShrink: 0, marginLeft: "0.5rem" }}
                  >
                    Vincular →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: BARCODE LABEL & STICKER PREVIEW
          ========================================================================= */}
      {showPrintModal && matchedProduct && (
        <div className="px-drawer-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "800", margin: 0 }}>
                🏷️ Etiqueta de Código de Barras
              </h2>
              <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setShowPrintModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: "1.2rem", background: "#ffffff", borderRadius: "14px", border: "2px dashed var(--px-blue)", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--px-text-strong)", marginBottom: "0.2rem" }}>
                PROVEXPRESS SAS • BODEGA COTA
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--px-blue)", marginBottom: "0.6rem" }}>
                {matchedProduct.name}
              </div>

              {/* Render Standard Code128 / GTIN Barcode */}
              <BarcodeGenerator value={matchedProduct.gtin || matchedProduct.sku} width={2.2} height={60} />

              <div style={{ fontSize: "0.74rem", color: "var(--px-muted)", marginTop: "0.6rem" }}>
                SKU: <strong>{matchedProduct.sku}</strong> • Ubicación: <strong>{matchedProduct.bin || "Bodega Cota"}</strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
              <button type="button" className="px-btn px-btn--secondary" onClick={() => setShowPrintModal(false)}>
                Cerrar
              </button>
              <button 
                type="button" 
                className="px-btn px-btn--primary" 
                onClick={() => window.print()}
                style={{ background: "var(--px-gradient-brand)", display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                <Printer size={15} /> Imprimir Etiqueta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: CATALOG PICKER
          ========================================================================= */}
      {showCatalogPicker && (
        <div className="px-drawer-overlay" onClick={() => setShowCatalogPicker(false)}>
          <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "800", margin: 0 }}>
                🔍 Seleccionar Producto del Catálogo
              </h2>
              <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setShowCatalogPicker(false)}>
                <X size={15} />
              </button>
            </div>

            <input 
              type="text" 
              className="px-input" 
              placeholder="Buscar por SKU, Nombre o Marca..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              style={{ height: "42px", fontSize: "0.9rem", marginBottom: "0.75rem", borderRadius: "10px" }}
            />

            <div style={{ maxHeight: "240px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {products.filter(p => {
                const q = pickerSearch.toLowerCase().trim();
                if (!q) return true;
                return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q));
              }).slice(0, 30).map(p => (
                <div 
                  key={p.sku}
                  onClick={() => selectProduct(p)}
                  style={{ padding: "0.55rem 0.75rem", background: "rgba(244, 247, 255, 0.7)", borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(215, 224, 240, 0.7)" }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-blue)", fontSize: "0.85rem" }}>{p.sku}</span>
                      <span className="px-chip" style={{ fontSize: "0.62rem" }}>{p.brand || "Genérico"}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--px-text-strong)" }}>{p.name}</div>
                  </div>
                  <span className="px-badge px-badge--success" style={{ fontSize: "0.7rem" }}>Stock: {p.stock || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: CREATE NEW PRODUCT IN BC
          ========================================================================= */}
      {showCreateModal && (
        <div className="px-drawer-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "800", margin: 0, color: "var(--px-blue)" }}>
                + Dar de Alta Producto en Business Central
              </h2>
              <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setShowCreateModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveNewProduct} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <div>
                <label className="px-label" style={{ fontSize: "0.72rem" }}>Código SKU *</label>
                <input 
                  type="text" 
                  className="px-input" 
                  required
                  value={newProdData.sku}
                  onChange={(e) => setNewProdData({ ...newProdData, sku: e.target.value.toUpperCase() })}
                  style={{ height: "40px", fontSize: "0.9rem", fontWeight: "700" }}
                />
              </div>

              <div>
                <label className="px-label" style={{ fontSize: "0.72rem" }}>Descripción del Producto *</label>
                <input 
                  type="text" 
                  className="px-input" 
                  required
                  placeholder="Ej. Resma Reprograf, Tóner HP..."
                  value={newProdData.name}
                  onChange={(e) => setNewProdData({ ...newProdData, name: e.target.value })}
                  style={{ height: "40px", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label className="px-label" style={{ fontSize: "0.72rem" }}>Código de Barras Global (GTIN / EAN)</label>
                  <input 
                    type="text" 
                    className="px-input" 
                    placeholder="Ej. 7705191046334"
                    value={newProdData.gtin}
                    onChange={(e) => setNewProdData({ ...newProdData, gtin: e.target.value })}
                    style={{ height: "40px", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label className="px-label" style={{ fontSize: "0.72rem" }}>Marca</label>
                  <select 
                    className="px-select"
                    value={newProdData.brand}
                    onChange={(e) => setNewProdData({ ...newProdData, brand: e.target.value })}
                    style={{ height: "40px", fontSize: "0.82rem" }}
                  >
                    <option value="HP">HP</option>
                    <option value="DELL">DELL</option>
                    <option value="Lenovo">Lenovo</option>
                    <option value="Reprograf">Reprograf</option>
                    <option value="Logitech">Logitech</option>
                    <option value="Epson">Epson</option>
                    <option value="Zebra">Zebra</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Bic">Bic</option>
                    <option value="Café Oma">Café Oma</option>
                    <option value="Genérico / Otras">Genérico / Otras</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="px-label" style={{ fontSize: "0.72rem" }}>Categoría</label>
                <select 
                  className="px-select"
                  value={newProdData.category}
                  onChange={(e) => setNewProdData({ ...newProdData, category: e.target.value })}
                  style={{ height: "40px", fontSize: "0.82rem" }}
                >
                  <option value="Impresión y Suministros">Impresión y Suministros (Tóners, Tintas)</option>
                  <option value="Papelería y Útiles">Papelería y Útiles (Resmas, Bolígrafos)</option>
                  <option value="Computadores y Portátiles">Computadores y Portátiles</option>
                  <option value="Teclados y Periféricos">Teclados y Periféricos</option>
                  <option value="Almacenamiento y Memorias">Almacenamiento y Memorias</option>
                  <option value="Redes y Servidores">Redes y Servidores</option>
                  <option value="Cafetería y Aseo">Cafetería y Aseo</option>
                  <option value="Accesorios y Varios">Accesorios y Varios</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.4rem" }}>
                <button type="button" className="px-btn px-btn--secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="px-btn px-btn--primary" style={{ background: "var(--px-gradient-brand)" }}>
                  + Crear en Business Central
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
