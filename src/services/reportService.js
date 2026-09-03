import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const reportService = {
  
  // =========================================================================
  // 1. GENERADOR DE ARCHIVO EXCEL (.XLSX) PARA INVENTARIO
  // =========================================================================
  exportToExcel(products, reportType = "ALL") {
    const dateStr = new Date().toLocaleDateString("es-CO");
    const timeStr = new Date().toLocaleTimeString("es-CO");

    let filtered = products;
    let titleType = "INVENTARIO COMPLETO";
    if (reportType === "LOW_STOCK") {
      filtered = products.filter(p => p.stock <= 3);
      titleType = "ALERTA DE STOCK CRÍTICO (≤ 3 UNIDADES)";
    } else if (reportType === "IN_STOCK") {
      filtered = products.filter(p => p.stock > 0);
      titleType = "PRODUCTOS CON EXISTENCIAS DISPONIBLES";
    }

    const totalUnits = filtered.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const totalValuation = filtered.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.unitCost) || 120000)), 0);

    const dataRows = [
      ["PROVEXPRESS SAS - SISTEMA DE GESTIÓN DE ALMACÉN (WMS ENTERPRISE)"],
      [`INFORME OFICIAL DE AUDITORÍA Y VALUACIÓN DE INVENTARIO - ${titleType}`],
      [`Bodega: Cota Suministros | Fecha: ${dateStr} ${timeStr} | Método Valuación: FIFO | Sincronizado: Dynamics 365 BC Cloud`],
      [],
      ["RESUMEN EJECUTIVO"],
      ["Total Referencias", filtered.length, "Total Unidades Físicas", totalUnits, "Valuación Total (COP)", totalValuation],
      [],
      [
        "Item",
        "Código SKU",
        "Descripción del Producto",
        "Marca",
        "Categoría",
        "Ubicación",
        "Existencias",
        "U.M.",
        "Costo Unitario (COP)",
        "Valuación Total (COP)",
        "Estado",
        "Serializado"
      ]
    ];

    filtered.forEach((p, idx) => {
      const stock = Number(p.stock) || 0;
      const cost = Number(p.unitCost) || 120000;
      const total = stock * cost;
      const isLow = stock > 0 && stock <= 3;
      const isOut = stock === 0;
      const estado = isOut ? "AGOTADO" : isLow ? "BAJO STOCK" : "DISPONIBLE";

      dataRows.push([
        idx + 1,
        p.sku,
        p.name,
        p.brand || "Genérico",
        p.category,
        p.bin || "COTA-SUM-01",
        stock,
        p.uom || "PCS",
        cost,
        total,
        estado,
        p.isSerialized ? "SI" : "NO"
      ]);
    });

    dataRows.push([
      "TOTAL",
      `Total: ${filtered.length} SKUs`,
      "",
      "",
      "",
      "",
      totalUnits,
      "UNIDADES",
      "",
      totalValuation,
      "",
      ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet(dataRows);

    ws["!cols"] = [
      { wch: 6 },  // Item
      { wch: 22 }, // SKU
      { wch: 38 }, // Descripción
      { wch: 16 }, // Marca
      { wch: 24 }, // Categoría
      { wch: 16 }, // Ubicación
      { wch: 14 }, // Existencias
      { wch: 8 },  // UOM
      { wch: 20 }, // Costo Unit
      { wch: 22 }, // Valuación
      { wch: 14 }, // Estado
      { wch: 12 }  // Serializado
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario_Cota");

    const filename = `Informe_Inventario_Provexpress_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  },

  // =========================================================================
  // 2. GENERADOR DE ARCHIVO PDF PARA INVENTARIO
  // =========================================================================
  exportToPdf(products, reportType = "ALL") {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const dateStr = new Date().toLocaleDateString("es-CO");
    const timeStr = new Date().toLocaleTimeString("es-CO");

    let filtered = products;
    let titleType = "INVENTARIO CONSOLIDADO MAESTRO";
    if (reportType === "LOW_STOCK") {
      filtered = products.filter(p => p.stock <= 3);
      titleType = "ALERTA DE EXISTENCIAS CRÍTICAS (≤ 3 UNIDADES)";
    } else if (reportType === "IN_STOCK") {
      filtered = products.filter(p => p.stock > 0);
      titleType = "REFERENCIAS CON EXISTENCIAS DISPONIBLES";
    }

    const totalUnits = filtered.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const totalValuation = filtered.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.unitCost) || 120000)), 0);
    const inStockCount = filtered.filter(p => p.stock > 0).length;
    const lowStockCount = filtered.filter(p => p.stock > 0 && p.stock <= 3).length;
    const outStockCount = filtered.filter(p => p.stock === 0).length;

    const formatCurrency = (num) => `$ ${new Intl.NumberFormat("es-CO").format(num)} COP`;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 792, 50, "F");

    doc.setFillColor(37, 99, 235);
    doc.roundedRect(24, 10, 30, 30, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PX", 32, 30);

    doc.setFontSize(13);
    doc.text("PROVEXPRESS SAS", 64, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text("WMS Enterprise Edition • Auditoría y Control de Inventario", 64, 38);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text(`Fecha: ${dateStr} ${timeStr}`, 630, 23);
    doc.text("Bodega: Cota Suministros", 630, 37);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`INFORME DE INVENTARIO Y VALUACIÓN: ${titleType}`, 24, 72);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(209, 220, 232);
    doc.roundedRect(24, 82, 232, 40, 4, 4, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("VALUACIÓN TOTAL (FIFO)", 34, 96);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(formatCurrency(totalValuation), 34, 113);

    doc.roundedRect(268, 82, 232, 40, 4, 4, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text("TOTAL UNIDADES FÍSICAS", 278, 96);
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(11);
    doc.text(`${new Intl.NumberFormat("es-CO").format(totalUnits)} Unidades`, 278, 113);

    doc.roundedRect(512, 82, 256, 40, 4, 4, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text("DESGLOSE DE REFERENCIAS", 522, 96);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9.5);
    doc.text(`${filtered.length} SKUs (${inStockCount} Disp. | ${lowStockCount} Bajo Stock | ${outStockCount} Agot.)`, 522, 113);

    const tableHeaders = [
      ["SKU", "Descripción del Producto", "Marca", "Ubicación", "Stock", "Costo Unit.", "Valuación Total", "Estado"]
    ];

    const tableData = filtered.map(p => {
      const stock = Number(p.stock) || 0;
      const cost = Number(p.unitCost) || 120000;
      const total = stock * cost;
      const isLow = stock > 0 && stock <= 3;
      const isOut = stock === 0;
      const estado = isOut ? "Agotado" : isLow ? "Bajo Stock" : "Disponible";

      return [
        p.sku,
        p.name,
        p.brand || "Genérico",
        p.bin || "COTA-SUM-01",
        `${stock} ${p.uom || "PCS"}`,
        formatCurrency(cost),
        formatCurrency(total),
        estado
      ];
    });

    autoTable(doc, {
      head: tableHeaders,
      body: tableData,
      startY: 132,
      margin: { left: 24, right: 24, top: 45, bottom: 40 },
      pageBreak: "auto",
      showHead: "everyPage",
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        font: "helvetica",
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        overflow: "linebreak"
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.8,
        halign: "left"
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 95 },
        1: { cellWidth: 190 },
        2: { cellWidth: 65 },
        3: { cellWidth: 74 },
        4: { halign: "right", fontStyle: "bold", cellWidth: 55 },
        5: { halign: "right", cellWidth: 85 },
        6: { halign: "right", fontStyle: "bold", cellWidth: 95 },
        7: { halign: "center", fontStyle: "bold", cellWidth: 85 }
      },
      didParseCell: function(data) {
        if (data.section === "body" && data.column.index === 7) {
          const val = data.cell.raw;
          if (val === "Agotado") data.cell.styles.textColor = [239, 68, 68];
          else if (val === "Bajo Stock") data.cell.styles.textColor = [217, 119, 6];
          else data.cell.styles.textColor = [16, 185, 129];
        }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 25;
    if (finalY > 480) {
      doc.addPage();
      finalY = 50;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("FIRMAS DE CONFORMIDAD Y AUDITORÍA DE INVENTARIO", 24, finalY);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    
    doc.line(24, finalY + 45, 230, finalY + 45);
    doc.text("Responsable de Inventario / Bodega", 24, finalY + 57);
    doc.text("Nombre y Cédula: ______________________", 24, finalY + 68);

    doc.line(280, finalY + 45, 490, finalY + 45);
    doc.text("Supervisor de Operaciones / Logística", 280, finalY + 57);
    doc.text("Nombre y Cédula: ______________________", 280, finalY + 68);

    doc.line(540, finalY + 45, 768, finalY + 45);
    doc.text("Auditoría Contable / Revisoría", 540, finalY + 57);
    doc.text("Nombre y Cédula: ______________________", 540, finalY + 68);

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      if (i > 1) {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 792, 28, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("PROVEXPRESS SAS • INFORME DE INVENTARIO (Continuación)", 24, 18);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha: ${dateStr}`, 680, 18);
      }
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${i} de ${totalPages} • Provexpress WMS Enterprise • Sincronizado con Microsoft Dynamics 365 Business Central`,
        24,
        596
      );
    }

    const filename = `Informe_Inventario_Provexpress_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  },

  // =========================================================================
  // 3. GENERADOR DE ARCHIVO EXCEL (.XLSX) PROFESIONAL PARA KARDEX
  // =========================================================================
  exportKardexToExcel(movements, filterType = "ALL") {
    const dateStr = new Date().toLocaleDateString("es-CO");
    const timeStr = new Date().toLocaleTimeString("es-CO");

    let filtered = movements;
    if (filterType !== "ALL") {
      filtered = movements.filter(m => m.type === filterType);
    }

    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalConteos = 0;

    filtered.forEach(m => {
      const q = Number(m.quantity) || 0;
      if (m.type === "ENTRADA") totalEntradas += q;
      else if (m.type === "SALIDA") totalSalidas += q;
      else if (m.type === "CONTEO") totalConteos += q;
    });

    const dataRows = [
      ["PROVEXPRESS SAS - LIBRO OFICIAL DE KARDEX Y TRAZABILIDAD"],
      [`HISTORIAL DE MOVIMIENTOS EN BODEGA - FILTRO: ${filterType}`],
      [`Bodega: Cota Suministros | Fecha de Emisión: ${dateStr} ${timeStr} | Total Movimientos: ${filtered.length}`],
      [],
      ["RESUMEN DE OPERACIONES"],
      ["Total Entradas", totalEntradas, "Total Salidas", totalSalidas, "Total Conteos Físicos", totalConteos, "Balance Neto (Ent - Sal)", totalEntradas - totalSalidas],
      [],
      [
        "Item",
        "ID Movimiento",
        "Fecha y Hora",
        "Tipo de Movimiento",
        "Código SKU",
        "Descripción del Producto",
        "Cantidad",
        "Seriales / Lote",
        "Ubicación",
        "Operador / Usuario",
        "Observaciones / Motivo",
        "Estado Business Central"
      ]
    ];

    filtered.forEach((m, idx) => {
      const serials = m.serialList && m.serialList.length > 0 
        ? m.serialList.join(", ") 
        : (m.serialNo && m.serialNo !== "N/A" ? m.serialNo : "N/A");

      dataRows.push([
        idx + 1,
        m.id,
        m.timestamp,
        m.type,
        m.sku,
        m.productName || "Suministro",
        Number(m.quantity) || 0,
        serials,
        m.bin || m.location || "COTA-SUM-01",
        m.user || "Terminal Zebra",
        m.note || "Movimiento registrado",
        m.bcStatus || m.syncStatus || "SINCRONIZADO"
      ]);
    });

    // Fila de Totales
    dataRows.push([
      "TOTAL",
      `Total: ${filtered.length} Registros`,
      "",
      "",
      "",
      "",
      totalEntradas - totalSalidas,
      "BALANCE NETO",
      "",
      "",
      "",
      ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet(dataRows);

    ws["!cols"] = [
      { wch: 6 },  // Item
      { wch: 16 }, // ID
      { wch: 24 }, // Fecha
      { wch: 16 }, // Tipo
      { wch: 20 }, // SKU
      { wch: 34 }, // Producto
      { wch: 12 }, // Cantidad
      { wch: 24 }, // Seriales
      { wch: 16 }, // Ubicación
      { wch: 20 }, // Usuario
      { wch: 34 }, // Nota
      { wch: 18 }  // Estado BC
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kardex_Auditoria");

    const filename = `Kardex_Provexpress_${filterType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  },

  // =========================================================================
  // 4. GENERADOR DE ARCHIVO PDF VECTORIAL PARA KARDEX
  // =========================================================================
  exportKardexToPdf(movements, filterType = "ALL") {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const dateStr = new Date().toLocaleDateString("es-CO");
    const timeStr = new Date().toLocaleTimeString("es-CO");

    let filtered = movements;
    if (filterType !== "ALL") {
      filtered = movements.filter(m => m.type === filterType);
    }

    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalConteos = 0;

    filtered.forEach(m => {
      const q = Number(m.quantity) || 0;
      if (m.type === "ENTRADA") totalEntradas += q;
      else if (m.type === "SALIDA") totalSalidas += q;
      else if (m.type === "CONTEO") totalConteos += q;
    });

    // Membrete Superior
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 792, 50, "F");

    doc.setFillColor(37, 99, 235);
    doc.roundedRect(24, 10, 30, 30, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PX", 32, 30);

    doc.setFontSize(13);
    doc.text("PROVEXPRESS SAS", 64, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Libro Oficial de Kardex y Trazabilidad • Auditoría de Almacén", 64, 38);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text(`Fecha: ${dateStr} ${timeStr}`, 630, 23);
    doc.text("Bodega: Cota Suministros", 630, 37);

    // Título
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`LIBRO DE KARDEX: MOVIMIENTOS (${filterType})`, 24, 72);

    // Cajas de resumen (3 cajas)
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(209, 220, 232);
    doc.roundedRect(24, 82, 232, 40, 4, 4, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL RECEPCIONES (ENTRADAS)", 34, 96);
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(11);
    doc.text(`+${new Intl.NumberFormat("es-CO").format(totalEntradas)} Unidades`, 34, 113);

    doc.roundedRect(268, 82, 232, 40, 4, 4, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text("TOTAL DESPACHOS (SALIDAS)", 278, 96);
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(11);
    doc.text(`-${new Intl.NumberFormat("es-CO").format(totalSalidas)} Unidades`, 278, 113);

    doc.roundedRect(512, 82, 256, 40, 4, 4, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text("REGISTROS AUDITADOS", 522, 96);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`${filtered.length} Movimientos (${totalConteos} Conteos físicos)`, 522, 113);

    // Tabla Kardex
    const tableHeaders = [
      ["ID", "Fecha / Hora", "Tipo", "SKU", "Producto", "Cant.", "Ubicación", "Operador", "Observaciones"]
    ];

    const tableData = filtered.map(m => [
      m.id,
      m.timestamp,
      m.type,
      m.sku,
      m.productName || "Suministro",
      m.type === "SALIDA" ? `-${m.quantity}` : `+${m.quantity}`,
      m.bin || m.location || "COTA",
      m.user || "Terminal Zebra",
      m.note || "Sin notas"
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableData,
      startY: 132,
      margin: { left: 24, right: 24, top: 45, bottom: 40 },
      pageBreak: "auto",
      showHead: "everyPage",
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        font: "helvetica",
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        overflow: "linebreak"
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.8,
        halign: "left"
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      // Sum = 70 + 110 + 60 + 90 + 150 + 40 + 74 + 70 + 80 = 744 pt
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 70 },
        1: { cellWidth: 110 },
        2: { halign: "center", fontStyle: "bold", cellWidth: 60 },
        3: { fontStyle: "bold", cellWidth: 90 },
        4: { cellWidth: 150 },
        5: { halign: "right", fontStyle: "bold", cellWidth: 40 },
        6: { cellWidth: 74 },
        7: { cellWidth: 70 },
        8: { cellWidth: 80 }
      },
      didParseCell: function(data) {
        if (data.section === "body" && data.column.index === 2) {
          const val = data.cell.raw;
          if (val === "SALIDA") data.cell.styles.textColor = [239, 68, 68];
          else if (val === "ENTRADA") data.cell.styles.textColor = [16, 185, 129];
          else data.cell.styles.textColor = [217, 119, 6];
        }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 25;
    if (finalY > 480) {
      doc.addPage();
      finalY = 50;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("FIRMAS DE CONFORMIDAD Y AUDITORÍA DE KARDEX", 24, finalY);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    
    doc.line(24, finalY + 45, 230, finalY + 45);
    doc.text("Responsable de Inventario / Bodega", 24, finalY + 57);
    doc.text("Nombre y Cédula: ______________________", 24, finalY + 68);

    doc.line(280, finalY + 45, 490, finalY + 45);
    doc.text("Supervisor de Operaciones / Logística", 280, finalY + 57);
    doc.text("Nombre y Cédula: ______________________", 280, finalY + 68);

    doc.line(540, finalY + 45, 768, finalY + 45);
    doc.text("Auditoría Contable / Revisoría", 540, finalY + 57);
    doc.text("Nombre y Cédula: ______________________", 540, finalY + 68);

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      if (i > 1) {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 792, 28, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("PROVEXPRESS SAS • LIBRO DE KARDEX (Continuación)", 24, 18);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha: ${dateStr}`, 680, 18);
      }
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${i} de ${totalPages} • Provexpress WMS Enterprise • Sincronizado con Microsoft Dynamics 365 Business Central`,
        24,
        596
      );
    }

    const filename = `Kardex_Provexpress_${filterType}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  }
};
