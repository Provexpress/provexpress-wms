import React, { useState } from "react";
import { 
  X, CheckCircle2, ArrowRight, ArrowDownLeft, ArrowUpRight, 
  ShieldCheck, Package, ClipboardCheck, Sparkles, Truck, Play
} from "lucide-react";
import { storageService } from "../services/storage";
import { bcService } from "../services/bc-api";
import { audioService } from "../services/audio";

export function GuidedDemoModal({ isOpen, onClose, onFinishDemo, onGoToOutbound, onGoToZebra }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [demoLog, setDemoLog] = useState("");

  if (!isOpen) return null;

  // STEP 1: Execute Controlled Inbound (Entrada)
  const handleExecuteStep1 = async () => {
    setIsProcessing(true);
    setDemoLog("Procesando Entrada de 2 unidades de TEC-ZEB-001 (SN: SN-CTRL-01, SN-CTRL-02)...");

    const movementData = {
      type: "ENTRADA",
      sku: "TEC-ZEB-001",
      productName: "Handheld Zebra TC22 Android (Bodega COTA)",
      quantity: 2,
      serialNo: "SN-CTRL-01, SN-CTRL-02",
      serialList: ["SN-CTRL-01", "SN-CTRL-02"],
      location: "COTA",
      bin: "COTA-A01-N1-P01",
      user: "Operario Prueba Controlada",
      note: "Entrada de Prueba Controlada"
    };

    await bcService.postMovement(movementData);
    audioService.playSuccess();
    setStep1Done(true);
    setIsProcessing(false);
    setDemoLog("✓ Paso 1 Completado: 2 unidades ingresadas con seriales registrados en bodega COTA.");
    setTimeout(() => setCurrentStep(2), 1200);
  };

  // STEP 2: Execute Controlled Picking (Alistamiento)
  const handleExecuteStep2 = () => {
    setIsProcessing(true);
    setDemoLog("Creando pedido #PED-CTRL-01 y alistando serial SN-CTRL-01...");

    const newOrder = storageService.createOrder({
      customer: "Cliente Prueba Controlada S.A.S.",
      destination: "Sede Norte Bogotá",
      notes: "Pedido demo de flujo de salida",
      items: [
        {
          sku: "TEC-ZEB-001",
          productName: "Handheld Zebra TC22 Android (Bodega COTA)",
          requestedQty: 1,
          pickedQty: 1,
          serials: ["SN-CTRL-01"],
          isSerialized: true
        }
      ]
    });

    storageService.sendOrderToReview(newOrder.id, newOrder.items, "Alistamiento completado con serial verificado.");
    audioService.playSuccess();
    setStep2Done(true);
    setIsProcessing(false);
    setDemoLog(`✓ Paso 2 Completado: Pedido #${newOrder.id} alistado y enviado a bandeja de REVISIÓN.`);
    setTimeout(() => setCurrentStep(3), 1200);
  };

  // STEP 3: Execute Controlled Review & Dispatch
  const handleExecuteStep3 = async () => {
    setIsProcessing(true);
    setDemoLog("Auditor verificando seriales y aprobando salida oficial hacia Business Central...");

    const orders = storageService.getOrders();
    const ctrlOrder = orders.find(o => o.status === "EN_REVISION" && o.customer.includes("Prueba Controlada")) || orders.find(o => o.status === "EN_REVISION");

    if (ctrlOrder) {
      await storageService.approveAndDispatchOrder(ctrlOrder.id, "Aprobado por Auditor de Calidad en Prueba Controlada");
      audioService.playSuccess();
      setStep3Done(true);
      setIsProcessing(false);
      setDemoLog("🚀 ¡Paso 3 Completado! Salida oficial registrada, stock descontado e insertado en Business Central Cloud.");
    } else {
      setIsProcessing(false);
      setDemoLog("No se encontró pedido pendiente de revisión.");
    }
  };

  const handleResetDemo = () => {
    setCurrentStep(1);
    setStep1Done(false);
    setStep2Done(false);
    setStep3Done(false);
    setDemoLog("");
  };

  return (
    <div className="px-drawer-overlay" onClick={onClose}>
      <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
              <span className="px-chip px-chip--active" style={{ fontSize: "0.68rem", background: "rgba(106, 63, 160, 0.12)", color: "var(--px-purple)" }}>
                <Sparkles size={11} /> Demostración Interactiva
              </span>
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "800", margin: 0, color: "var(--px-text)" }}>
              🧪 Prueba Controlada de Inventario y Despachos
            </h2>
            <p style={{ margin: "0.2rem 0 0 0", color: "var(--px-muted)", fontSize: "0.78rem" }}>
              Ejecuta y visualiza en tiempo real el ciclo completo: Entrada ➔ Alistamiento ➔ Revisión ➔ Business Central
            </p>
          </div>
          <button className="px-btn px-btn--sm px-btn--icon" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* 3 Interactive Stepper Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
          
          {/* STEP 1 */}
          <div style={{ 
            padding: "0.85rem", 
            borderRadius: "12px", 
            border: `1.5px solid ${step1Done ? "rgba(22, 163, 74, 0.4)" : currentStep === 1 ? "var(--px-blue)" : "rgba(215, 224, 240, 0.7)"}`,
            background: step1Done ? "rgba(22, 163, 74, 0.05)" : currentStep === 1 ? "rgba(21, 101, 192, 0.05)" : "rgba(255, 255, 255, 0.7)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ 
                  width: "28px", height: "28px", borderRadius: "50%", 
                  background: step1Done ? "var(--px-green)" : currentStep === 1 ? "var(--px-blue)" : "rgba(215, 224, 240, 0.8)", 
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "0.8rem" 
                }}>
                  {step1Done ? <Check size={16} /> : "1"}
                </div>
                <div>
                  <div style={{ fontWeight: "800", fontSize: "0.85rem", color: "var(--px-text-strong)" }}>
                    Entrada Directa de Mercancía
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>
                    Recepciona 2 unidades de TEC-ZEB-001 con seriales en bodega COTA.
                  </div>
                </div>
              </div>

              {currentStep === 1 && !step1Done && (
                <button 
                  className="px-btn px-btn--primary px-btn--sm"
                  disabled={isProcessing}
                  onClick={handleExecuteStep1}
                  style={{ background: "var(--px-green)", fontSize: "0.75rem", padding: "0.4rem 0.75rem" }}
                >
                  <Play size={12} /> Ejecutar Entrada
                </button>
              )}
              {step1Done && <span className="px-badge px-badge--success">✓ Recepcionado</span>}
            </div>
          </div>

          {/* STEP 2 */}
          <div style={{ 
            padding: "0.85rem", 
            borderRadius: "12px", 
            border: `1.5px solid ${step2Done ? "rgba(22, 163, 74, 0.4)" : currentStep === 2 ? "var(--px-purple)" : "rgba(215, 224, 240, 0.7)"}`,
            background: step2Done ? "rgba(22, 163, 74, 0.05)" : currentStep === 2 ? "rgba(106, 63, 160, 0.05)" : "rgba(255, 255, 255, 0.7)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ 
                  width: "28px", height: "28px", borderRadius: "50%", 
                  background: step2Done ? "var(--px-green)" : currentStep === 2 ? "var(--px-purple)" : "rgba(215, 224, 240, 0.8)", 
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "0.8rem" 
                }}>
                  {step2Done ? <Check size={16} /> : "2"}
                </div>
                <div>
                  <div style={{ fontWeight: "800", fontSize: "0.85rem", color: "var(--px-text-strong)" }}>
                    Fase 1: Alistamiento de Pedido (Picking)
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>
                    El operario escanea 1 serial y envía el pedido a la bandeja de revisión.
                  </div>
                </div>
              </div>

              {currentStep === 2 && !step2Done && (
                <button 
                  className="px-btn px-btn--primary px-btn--sm"
                  disabled={isProcessing}
                  onClick={handleExecuteStep2}
                  style={{ background: "var(--px-purple)", fontSize: "0.75rem", padding: "0.4rem 0.75rem" }}
                >
                  <Play size={12} /> Alistar y Enviar
                </button>
              )}
              {step2Done && <span className="px-badge px-badge--success">✓ Alistado</span>}
            </div>
          </div>

          {/* STEP 3 */}
          <div style={{ 
            padding: "0.85rem", 
            borderRadius: "12px", 
            border: `1.5px solid ${step3Done ? "rgba(22, 163, 74, 0.4)" : currentStep === 3 ? "var(--px-green)" : "rgba(215, 224, 240, 0.7)"}`,
            background: step3Done ? "rgba(22, 163, 74, 0.05)" : currentStep === 3 ? "rgba(22, 163, 74, 0.05)" : "rgba(255, 255, 255, 0.7)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ 
                  width: "28px", height: "28px", borderRadius: "50%", 
                  background: step3Done ? "var(--px-green)" : currentStep === 3 ? "var(--px-green)" : "rgba(215, 224, 240, 0.8)", 
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "0.8rem" 
                }}>
                  {step3Done ? <Check size={16} /> : "3"}
                </div>
                <div>
                  <div style={{ fontWeight: "800", fontSize: "0.85rem", color: "var(--px-text-strong)" }}>
                    Fase 2: Revisión, Aprobación y Salida
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>
                    El auditor da visto bueno y transmite la salida a Business Central.
                  </div>
                </div>
              </div>

              {currentStep === 3 && !step3Done && (
                <button 
                  className="px-btn px-btn--primary px-btn--sm"
                  disabled={isProcessing}
                  onClick={handleExecuteStep3}
                  style={{ background: "var(--px-green)", fontSize: "0.75rem", padding: "0.4rem 0.75rem" }}
                >
                  <Play size={12} /> Aprobar Salida
                </button>
              )}
              {step3Done && <span className="px-badge px-badge--success">🚀 Salida Registrada</span>}
            </div>
          </div>

        </div>

        {/* Live Demo Output Console */}
        {demoLog && (
          <div style={{ padding: "0.75rem 0.85rem", background: "rgba(26, 43, 107, 0.06)", border: "1px solid rgba(26, 43, 107, 0.15)", borderRadius: "10px", marginBottom: "1rem", fontSize: "0.8rem", color: "var(--px-text-strong)", fontWeight: "600" }}>
            {demoLog}
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(215, 224, 240, 0.7)", paddingTop: "0.85rem" }}>
          <button 
            type="button" 
            className="px-btn px-btn--ghost px-btn--sm"
            onClick={handleResetDemo}
            style={{ fontSize: "0.75rem" }}
          >
            Reiniciar Prueba
          </button>

          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button 
              type="button" 
              className="px-btn px-btn--secondary"
              onClick={() => { onClose(); if (onGoToOutbound) onGoToOutbound(); }}
              style={{ fontSize: "0.78rem" }}
            >
              Ir a Despachos →
            </button>
            <button 
              type="button" 
              className="px-btn px-btn--primary"
              onClick={() => { onClose(); if (onFinishDemo) onFinishDemo(); }}
              style={{ background: "var(--px-gradient-brand)", fontSize: "0.78rem" }}
            >
              Cerrar y Ver Resultados
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}