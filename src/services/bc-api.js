
function detectBrand(sku, name) {
  const t = `${sku} ${name}`.toUpperCase();
  if (t.includes("DELL")) return "DELL";
  if (["LENOVO", "THINKPAD", "THINKCENTRE", "IDEAPAD", "YOGA", "LEGION"].some(k => t.includes(k))) return "Lenovo";
  if (["HP ", "HP-", "HEWLETT", "PROBOOK", "ELITEBOOK", "PAVILION", "OMEN", "LASERJET", "DESKJET", "JETINTELLIGENCE", "OFFICEJET"].some(k => t.includes(k))) return "HP";
  if (["ZEBRA", "TC22", "TC21", "TC26", "TC52", "TC57", "ZT230", "ZT410", "GK420"].some(k => t.includes(k))) return "Zebra";
  if (t.includes("EPSON")) return "Epson";
  if (["APPLE", "MACBOOK", "IPHONE", "IPAD", "IMAC", "AIRPODS"].some(k => t.includes(k))) return "Apple";
  if (t.includes("SAMSUNG") || t.includes("GALAXY")) return "Samsung";
  if (t.includes("LOGITECH") || t.includes("MK250") || t.includes("MK270") || t.includes("MK295")) return "Logitech";
  if (t.includes("JABRA")) return "Jabra";
  if (t.includes("JBL")) return "JBL";
  if (t.includes("CHALLENGER")) return "Challenger";
  if (t.includes("LG ") || t.includes(" LG")) return "LG";
  if (t.includes("XIAOMI")) return "Xiaomi";
  if (t.includes("TARGUS")) return "Targus";
  if (t.includes("FORTIGATE") || t.includes("FORTINET")) return "Fortinet";
  if (t.includes("ARUBA") || t.includes("HPE")) return "Aruba / HPE";
  if (t.includes("REPROGRAF")) return "Reprograf";
  if (t.includes("BIC ") || t.includes("BIC")) return "Bic";
  if (t.includes("SHARPIE")) return "Sharpie";
  if (t.includes("MIRADO")) return "Mirado";
  if (t.includes("NORMA")) return "Norma";
  if (t.includes("3M ") || t.includes(" 3M")) return "3M";
  if (t.includes("TESA")) return "Tesa";
  if (t.includes("OMA")) return "Café Oma";
  if (t.includes("SELLO ROJO")) return "Sello Rojo";
  if (t.includes("AGUILA ROJA")) return "Águila Roja";
  if (t.includes("TERESITA")) return "Teresita";
  if (t.includes("SPLENDA")) return "Splenda";
  if (t.includes("AXION")) return "Axion";
  if (t.includes("FABULOSO")) return "Fabuloso";
  if (t.includes("DERSA")) return "Dersa";
  if (t.includes("LUKER")) return "Luker";
  if (t.includes("WHIRLPOOL")) return "Whirlpool";
  if (t.includes("DATALOGIC")) return "Datalogic";
  if (t.includes("NEWLAND") || t.includes("NLS-")) return "Newland";
  if (t.includes("MICROSOFT")) return "Microsoft";
  if (t.includes("VMWARE")) return "VMware";
  if (t.includes("ADOBE") || t.includes("CREATIVE CLOUD") || t.includes("ACROBAT") || t.includes("ILUSTRATOR")) return "Adobe";
  if (t.includes("KASPERSKY")) return "Kaspersky";
  if (t.includes("ACRONIS")) return "Acronis";
  if (t.includes("KINGSTON")) return "Kingston";
  if (t.includes("KYOCERA") || t.includes("TASKALFA")) return "Kyocera";
  if (t.includes("BROTHER")) return "Brother";
  if (t.includes("LEXMARK")) return "Lexmark";
  if (t.includes("CANON")) return "Canon";
  if (t.includes("RICOH")) return "Ricoh";
  if (t.includes("XEROX")) return "Xerox";
  if (["DAHUA", "HIKVISION"].some(k => t.includes(k))) return "Dahua / Hikvision";
  if (t.includes("ASUS")) return "Asus";
  if (t.includes("ACER")) return "Acer";
  if (t.includes("TOSHIBA")) return "Toshiba";
  if (t.includes("SONY") || t.includes("PLAYSTATION")) return "Sony";
  if (t.includes("CISCO") || t.includes("LINKSYS")) return "Cisco";
  if (["TP-LINK", "TPLINK", "MIKROTIK", "UBIQUITI", "UAP-"].some(k => t.includes(k))) return "TP-Link / Ubiquiti";
  if (["APC", "TRIPP LITE", "FORZA", "UNITEC"].some(k => t.includes(k))) return "APC / Forza";
  if (t.includes("MOTOROLA")) return "Motorola";
  if (["SANDISK", "CRUCIAL", "SEAGATE", "WESTERN DIGITAL", "WD ", "ADATA"].some(k => t.includes(k))) return "SanDisk / Crucial / WD";
  if (["PANDUIT", "NEXXT", "SIEMON"].some(k => t.includes(k))) return "Nexxt / Panduit";
  if (["KLIP XTREME", "GENIUS", "BELKIN"].some(k => t.includes(k))) return "Klip Xtreme / Genius";
  if (t.includes("PROVEXPRESS") || t.includes("TEST-PROV")) return "Provexpress";
  return "Genérico / Otras";
}

function classifyCategory(name, sku) {
  const n = `${name} ${sku}`.toUpperCase();

  if (["MONITOR", "PANTALLA", "DISPLAY", "SCREEN", "PANEL LCD", "PANEL LED", "OLED", "QLED", "TFT", "TELEVISOR", "TV ", "TV 4K", "CRYSTAL UHD", "ULTRA HD", "FULL HD SMART", "65KG290", "LH50", "LH55", "LH65"].some(k => n.includes(k))) return "Monitores y Pantallas";

  if (["TONER", "TÓNER", "CARTUCHO", "CARTRIDGE", "IMPRESORA", "PRINTER", "TINTA", "CABEZAL", "FUSOR", "FUSER", "FOTOCONDUCTOR", "TAMBOR", "DRUM", "CINTA RIBBON", "LASERJET", "JETINTELLIGENCE", "MFP", "PAPER FEED", "MLT-", "W1510", "TK-", "TN-", "#58A", "#414A", "#80X", "#55A", "#150A", "#36A", "#330A", "#330X", "#78A", "#72", "#712", "#964XL", "#950XL", "#951XL", "#662XL", "3JA", "CN045", "CN046", "CN048", "CZ106", "C9371", "C9372", "3ED71", "1VV22", "GT51", "GT53", "T664", "T544", "T44H", "C13S", "OFFICEJET", "DESKJET", "INKTANK", "INK TANK", "ECOTANK", "PLOTER", "PLOTTER", "MAINTENANCE KIT", "ULTRA CHROME", "L110", "L200", "L210", "L350", "L355", "L555", "L1110", "L3110", "L3150", "L5190", "RICOH IM", "RICOH MP", "GPR-", "CANON GPR", "XEROX FUSER", "PHOTO 700ML", "MAGENTA", "CYAN", "YELLOW"].some(k => n.includes(k))) return "Impresión y Suministros";

  if (["TECLADO", "KEYBOARD", "MOUSE", "RATON", "RATÓN", "TOUCHPAD", "TRACKPAD", "NUMPAD", "COMBO LOGITECH", "COMBO", "MK250", "MK270", "MK295", "MK120", "920-013"].some(k => n.includes(k))) return "Teclados y Periféricos";

  if (["TABLET", "IPAD", "CELULAR", "SMARTPHONE", "GALAXY A", "GALAXY S", "GALAXY TAB", "TAB A", "SM-X", "SM-T", "SM-A", "TV BOX", "APPLE TV", "ROBOT VACCUN", "WATCH", "SMARTWATCH", "RADIO TELÉFONO", "RADIO TELEFONO", "RVA50"].some(k => n.includes(k))) return "Móviles y Tablets";

  if (["LICENCIA", "VMWARE", "VSPHERE", "POWER BI", "ANTIVIRUS", "KASPERSKY", "ACRONIS", "CREATIVE CLOUD", "WINDOWS SERV", "WINDOWS SERVER", "WINDOWS SVR", "OFFICE HOME", "OFFICE LTSC", "MICROSOFT 365", "M365", "ADOBE", "ACROBAT", "ILUSTRATOR", "ILLUSTRATOR", "CAL 2025", "STANDALONE LICENSE", "YEAR UNIFIED", "1 YEAR", "WIN PRO 11", "PREMIER SUPPORT", "GARANTIA", "GARANTÍA", "SUBSCRIPTION", "ADV ELEC LIC", "ILO ADV", "3YR SUPOORT"].some(k => n.includes(k))) return "Licencias y Software";

  if (["PORTATIL", "PORTÁTIL", "LAPTOP", "NOTEBOOK", "COMPUTADOR", "DESKTOP", "ALL IN ONE", "TODO EN UNO", "WORKSTATION", "THINKPAD", "THINKCENTRE", "DELL PRO 14", "PC14250", "LATITUDE", "VOSTRO", "OPTIPLEX", "PROBOOK", "ELITEBOOK", "PAVILION", "CI3", "CI5", "CI7", "CI9", "CORE I3", "CORE I5", "CORE I7", "CORE I9", "ULTRA5", "ULTRA7", "ULTRA 5", "ULTRA 7", "RYZEN", "W11P", "W11 PRO", "WINDOWS 11 PRO", "MACBOOK", "IMAC"].some(k => n.includes(k))) return "Computadores y Portátiles";

  if (["RESMA", "PAPEL BOND", "PAPEL CARTA", "PAPEL OFICIO", "REPROGRAF", "ESFERO", "BOLIGRAFO", "BIC ", "BIC", "MARCADOR", "SHARPIE", "RESALTADOR", "LAPIZ", "LÁPIZ", "MIRADO", "NORMA", "BORRADOR", "CUADERNO", "FOLDER", "CINTA PEGANTE", "CINTA ENMASCARAR", "CINTA EMPAQUE", "TESA", "3M", "PEGASTICK", "SOBRE MANILA", "POST-IT", "NOTAS ADHESIVAS", "TIJERA", "GRAPADORA", "PROTECTOR DE VINILO", "BISTURI", "BISTURÍ", "ROLLO ETIQUETA", "ETIQUETA ADHESIVA", "ETIQUETAS SAT"].some(k => n.includes(k))) return "Papelería y Útiles";

  if (["CAFÉ", "CAFE ", "OMA", "SELLO ROJO", "AGUILA ROJA", "INFUSION", "INFUSIÓN", "TERESITA", "TE CHAI", "TE VERDE", "MARACUYA", "SPLENDA", "ENDULZANTE", "AZUCAR", "AZÚCAR", "AROMATICA", "AROMÁTICA", "LUKER", "CHOCOLATE", "AGUA", "MANANTIAL", "MEZCLADOR BAMBU", "SERVILLETAS", "SERVILLETA", "FAMI", "DETERGENTE", "DERSA", "LAVALOZA", "AXION", "FABULOSO", "TRAPERO", "MICROFIBRA", "FULLER", "JABON", "JABÓN", "TOALLA", "LIMPIADOR", "DESINFECTANTE", "PAPEL HIG", "HIGIENICO", "HIGIÉNICO", "ASPIRADORA", "POLIESTRECH", "ESTRECH", "BOLSA BASURA", "BOLSA ROJA", "BOLSA NEGRA", "VASO", "ALCOHOL", "TAPABOCAS", "HORNO MICROONDAS", "WHIRLPOOL", "COMPRESOR PORTABLE", "TAPA YUTE"].some(k => n.includes(k))) return "Cafetería y Aseo";

  if (["MORRAL", "MALETIN", "MALETÍN", "MALETA", "SENDERISMO", "FUNDA", "TARGUS", "B210", "BACKPACK", "ESTUCHE", "BOLSO", "SLEEVE"].some(k => n.includes(k))) return "Morrales y Estuches";

  if (["JBL", "HEADPHONE", "JABRA", "EVOLVE", "DIADEMA", "AURICULAR", "HEADSET", "MICROFONO", "MICRÓFONO", "PARLANTE", "SPEAKER", "AUDIFONO", "AUDÍFONO", "AIRPODS"].some(k => n.includes(k))) return "Audio y Diademas";

  if (["ANTI THEFT", "SECURITY", "GUAYA", "CANDADO", "CAMARA", "CÁMARA", "DOMO", "DVR", "NVR", "XVR", "VIDEOGRABADOR", "BIOMETRICO", "SENSOR", "CAJA FUERTE"].some(k => n.includes(k))) return "Seguridad y Cámaras";

  if (["ZEBRA", "TC22", "TC21", "TC26", "TC52", "HANDHELD", "LECTOR", "SCANNER", "ESCANER", "ESCÁNER", "DATALOGIC", "QW2120", "NEWLAND", "NLS-", "TERMINAL", "COLECTOR"].some(k => n.includes(k))) return "Terminales y Scanners";

  if (["ARUBA", "AP-505", "FORTIGATE", "FORTINET", "SWITCH", "ROUTER", "CISCO", "TRANSCEIVER", "PATCH CORD", "PATCHCORD", "RJ45", "FIBRA OPTICA", "ACCESS POINT", "UAP-", "MIKROTIK", "UBIQUITI", "TP-LINK", "RACK", "CONVERTIDOR USB RS232", "FTDI", "BASE DE CARGA DUAL", "HD22Q"].some(k => n.includes(k))) return "Redes y Servidores";

  if (["DISCO DURO", "DISCO", "SSD", "HDD", "NVME", "M.2", "MEMORIA RAM", "RAM ", "DDR3", "DDR4", "DDR5", "RDIMM", "UDIMM", "SODIMM", "2666MHZ", "3200MHZ", "PENDRIVE", "MICROSD", "FLASH DRIVE", "USB MEMORY", "USB3", "SAS", "1500RPM", "900GB", "1TB", "2TB", "512GB", "32GB METALLIC"].some(k => n.includes(k))) return "Almacenamiento y Memorias";

  if (["BATERIA", "BATTERY", "BATERÍA", "PILA", "UPS", "REGULADOR", "POWERBANK"].some(k => n.includes(k))) return "Baterías y Energía";

  if (["CARGADOR", "ADAPTADOR", "ADAPTER", "CHARGER", "FUENTE DE PODER", "POWER SUPPLY", "FUENTE PODER", "PLUG USB-C"].some(k => n.includes(k))) return "Cargadores y Fuentes";

  if (["DESCANSAPIES", "MESA GRADUABLE", "SILLA", "ESCRITORIO", "SOPORTE ELEVADOR"].some(k => n.includes(k))) return "Mobiliario y Ergonomía";

  if (["CABLE", "HDMI", "VGA", "DISPLAYPORT", "CONECTOR", "SPLITTER"].some(k => n.includes(k))) return "Cables y Conectividad";

  if (["TARJETA", "BOARD", "MOTHERBOARD", "PLACA", "MAINBOARD", "VENTILADOR", "FAN", "COOLER", "DISIPADOR", "BISAGRA", "CARCASA", "COVER", "FLEX", "JACK", "TERMOHIGROMETRO"].some(k => n.includes(k))) return "Partes y Componentes";

  return "Accesorios y Varios";
}

import { storageService } from "./storage";

export const bcService = {
  async testConnection() {
    try {
      const res = await fetch("/api/bc/ping");
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          status: 200,
          message: "✓ Conectado en vivo a Business Central Cloud",
          serverTime: new Date().toISOString(),
          entities: ["Item", "Company", "ItemJournalLine"]
        };
      }
      throw new Error(data.error || "Error al conectar");
    } catch (e) {
      return {
        success: false,
        status: 500,
        message: "Error de conexión: " + e.message
      };
    }
  },

  async syncItems() {
    try {
      const res = await fetch("/api/bc/items");
      const data = await res.json();
      
      if (data.value && Array.isArray(data.value)) {
        const currentLocalProds = storageService.getProducts();
        const liveItems = data.value.filter(item =>
          String(item.number || "").trim().toUpperCase().startsWith("SIM-TON-") && !item.blocked
        ).map((item, idx) => {
          const sku = item.number || "";
          const desc = item.displayName || item.description || "";
          const cost = Number(item.unitCost) || 0;
          const price = Number(item.unitPrice) || Math.round(cost * 1.30);
          // Preserve existing counted stock from local kardex if BC inventory is 0
          const existingProd = currentLocalProds.find(p => p.sku.toUpperCase() === sku.toUpperCase());
          const countedStock = existingProd ? Number(existingProd.stock) || 0 : 0;
          const bcInventory = Number(item.inventory) || 0;
          const stock = bcInventory > 0 ? bcInventory : countedStock;
          const uom = item.baseUnitOfMeasureCode || "PCS";
          
          const brand = detectBrand(sku, desc);
          const cat = classifyCategory(desc, sku);
          const descUpper = desc.toUpperCase();

          return {
            id: idx + 1,
            sku: sku,
            name: desc,
            brand: brand,
            category: cat,
            uom: uom,
            stock: stock,
            unitCost: cost,
            unitPrice: price,
            totalValue: Math.round(stock * cost),
            location: "COTA",
            bin: "COTA-A01-N1-P01",
            gtin: item.gtin || sku,
            isSerialized: sku.includes("TEC-ZEB") || descUpper.includes("PORTATIL") || descUpper.includes("CELULAR") || descUpper.includes("IMPRESORA")
          };
        });

        storageService.saveProducts(liveItems);
        const cfg = storageService.getConfig();
        cfg.lastSync = new Date().toLocaleString("es-CO");
        cfg.isConnected = true;
        storageService.saveConfig(cfg);

        return {
          success: true,
          syncedCount: liveItems.length,
          timestamp: cfg.lastSync
        };
      }
      throw new Error("Formato de respuesta inválido");
    } catch (e) {
      console.error("Error sincronizando catálogo:", e);
      return {
        success: false,
        error: e.message
      };
    }
  },

  async createProduct(productData) {
    try {
      const rawSku = String(productData.sku || "").trim().toUpperCase();
      const normalizedSku = rawSku.startsWith("SIM-TON-") ? rawSku : `SIM-TON-${rawSku}`;
      const normalizedProduct = { ...productData, sku: normalizedSku };
      storageService.addProduct(normalizedProduct);
      
      try {
        await fetch("/api/bc/create-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: normalizedProduct.sku,
            displayName: normalizedProduct.name,
            type: "Inventory",
            unitCost: Number(normalizedProduct.unitCost) || 0,
            unitPrice: Number(normalizedProduct.unitPrice) || 0,
            baseUnitOfMeasureCode: normalizedProduct.uom || "PCS"
          })
        });
      } catch (apiErr) {
        console.warn("Syncing new item to BC in background:", apiErr);
      }

      return {
        success: true,
        product: normalizedProduct
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async postMovement(movement) {
    try {
      const res = await fetch("/api/bc/post-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movement)
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        // Honest Error Reporting: Notify operator if BC rejected or failed
        return {
          success: false,
          syncStatus: data.syncStatus || "ERROR",
          entry: data.entry,
          message: data.message || data.error || "Error al procesar movimiento",
          error: data.error || data.message
        };
      }

      return {
        success: true,
        syncStatus: "SUCCESS",
        bcDocumentNo: data.entry?.id,
        entry: data.entry,
        cloudStatus: data.message || "✓ Asentado en la Nube de Business Central"
      };
    } catch (e) {
      return {
        success: false,
        syncStatus: "CONNECTION_ERROR",
        message: "Error de red con el servidor backend: " + e.message,
        error: e.message
      };
    }
  }
};
