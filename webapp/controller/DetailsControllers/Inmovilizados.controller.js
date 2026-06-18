sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "zindirect_costs/controller/BaseController",
    "zindirect_costs/model/formatter"
], function (
    JSONModel,
    Column,
    Input,
    Button,
    Label,
    BaseController,
    formatter
) {
    "use strict";

    return BaseController.extend("zindirect_costs.controller.DetailsControllers.Inmovilizados", {

        formatter: formatter,

        /**
         * Formatter function to translate TipoInd values
         * @param {string} sTipoInd - The TipoInd value
         * @returns {string} The translated text
         */
        formatTipoInd: function (sTipoInd) {
            if (!sTipoInd) {
                return "";
            }
            
            var sKey;
            switch (sTipoInd) {
                case "I":
                    sKey = "tipoIndInversion";
                    break;
                case "A":
                    sKey = "tipoIndAmortizacion";
                    break;
                default:
                    return sTipoInd;
            }
            
            return this.getTranslatedText(sKey);
        },

        /**
         * Inicializa la vista de Diferidos definiendo el estado de navegación y visibilidad.
         * Configura la tabla principal y prepara las columnas anuales iniciales.
         */
        getCustomTableId: function () {
            return "TreeTableInmovilizados";
        },
        //      Se sobrescribe el hook para indicar que
        //  en Inmovilizados el campo "Coste pendiente" se mapea
        //  en el modelo como "_Pendiente". Lo utiliza el
        //  onMonthInputChange del BaseController para calcular
        //  porcentajes sobre las celdas mensuales editables.
        _getCostePendienteField: function () {
            return "_Pendiente";
        },
        //    

        onInit: function () {

            this.setInitData();
            this._originalInmovilizadosData = null;
        },
        setInitData: async function () {
            // Configuración de la variante para diferidos 
            this.initVariantConfig({
                tableId: "TreeTableInmovilizados", // ID exacto del XML 
                modelName: "inmovilizadosModel",     // Nombre del modelo de datos 
                storageKey: "Inmovilizados_variants"  // Clave única en localStorage 
            });

            this._initVariantManagement(); // Ahora se llama sin parámetros

            //   Se identifica esta vista como Inmovilizados para los headers de los servicios.
            this._pestana = "Inmovilizados";

            this._initYearsModel();
            //this.initInmovilizadosModel(this._previousTabKey);
            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            // Ejecuta la configuración base para la TreeTable.
            this.setupDynamicTreeTable("TreeTableInmovilizados");

            //  Se crean las columnas dinámicas utilizando el rango Freal → Frealfinobra,
            //  evitando el uso de años fijos basados en la fecha actual.
            this.createDynamicYearColumns("TreeTableInmovilizados");

            //  Se inicializa el modelo de años dinámico desde Freal hasta Frealfinobra,
            //  sustituyendo el rango estático anterior de 10 años fijos.

            this._boundResizeHandler = function () {
                this._calculateDynamicRows();
            }.bind(this);
            $(window).on("resize", this._boundResizeHandler);

            this._boundBrowserClose = this.onBrowserClose.bind(this);
            window.addEventListener("beforeunload", this._boundBrowserClose);
        },

        /**
         * Forza el renderizado de la tabla una vez la vista está disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            let table = this.byId("TreeTableInmovilizados");
            
            // Detach previous handlers to avoid duplicates
            if (this._colorRowsHandler) {
                table.detachEvent("rowsUpdated", this._colorRowsHandler);
                table.detachEvent("firstVisibleRowChanged", this._colorRowsHandler);
            }
            
            // Create bound handler and store reference
            // Se usa una función anónima para no pasar el evento como argumento a colorRows
            this._colorRowsHandler = function() { this.colorRows(); }.bind(this);
            table.attachEvent("rowsUpdated", this._colorRowsHandler);
            table.attachEvent("firstVisibleRowChanged", this._colorRowsHandler);
            
            // Force initial coloring after a short delay to ensure DOM is ready
            setTimeout(function() {
                this.colorRows();
            }.bind(this), 100);
            
            // Adjuntar listener para el botón de colapsar del header después del renderizado
            this._attachHeaderToggleListener();
            
            // Calcular filas dinámicas
            this._calculateDynamicRows();
        },

        /**
         * Gestiona la visibilidad de columnas extendidas al expandir nodos en la TreeTable.
         * Las columnas de meses NO se muestran cuando se expanden nodos de desglose.
         */
        onToggleOpenState: function (oEvent) {
            var oTable = oEvent.getSource();
            var sTableId = oTable.getId();
            var bExpanded = oEvent.getParameter("expanded");
            var iRowIndex = oEvent.getParameter("rowIndex");
            var oUiModel = this.getView().getModel("ui");

            var oColMonths = this.byId("colMonths");
            var oColNew = this.byId("colNew");

            if (!bExpanded) {
                // Si se contrae un nodo, verifica si todavía quedan otros expandidos con columnas de meses.
                var bAnyPlanExpanded = false;
                var oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    for (var i = 0; i < oBinding.getLength(); i++) {
                        if (oTable.isExpanded(i)) {
                            var oCtx = oTable.getContextByIndex(i);
                            var oObj = oCtx && oCtx.getObject();
                            // Solo cuenta si los hijos son filas de plan (tienen months), no desgloses
                            if (oObj && Array.isArray(oObj.children) && oObj.children.length > 0) {
                                var bHasDesgloseChildren = oObj.children.some(function(c) {
                                    return c.__isEditable === true || c.__isSinProveedor === true || c.__isHeader === true;
                                });
                                if (!bHasDesgloseChildren) {
                                    bAnyPlanExpanded = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!bAnyPlanExpanded) {
                    if (oColMonths) oColMonths.setVisible(false);
                    if (oColNew) oColNew.setVisible(false);

                    this._aGroupRanges = [];
                    oUiModel.setProperty("/showStickyAgrupador", false);
                    return;
                }
            } else {
                // Al expandir, solo mostrar colMonths/colNew si NO son hijos de desglose
                var oCtxExpanded = oTable.getContextByIndex(iRowIndex);
                var oObjExpanded = oCtxExpanded && oCtxExpanded.getObject();
                var bIsDesgloseExpansion = oObjExpanded && Array.isArray(oObjExpanded.children) &&
                    oObjExpanded.children.length > 0 &&
                    oObjExpanded.children.some(function(c) {
                        return c.__isEditable === true || c.__isSinProveedor === true || c.__isHeader === true;
                    });

                if (!bIsDesgloseExpansion) {
                    if (oColMonths) oColMonths.setVisible(true);
                    if (oColNew) oColNew.setVisible(true);
                }
            }

            // Refresca la lógica de estilos y scroll de la tabla.
            setTimeout(function () {
                this._refreshAfterToggle(sTableId);
            }.bind(this), 0);
        },
        _createSnapshot: function () {
            var oDefaultModel = this.getView().getModel("inmovilizadosModel");
            if (oDefaultModel) {
                var oData = oDefaultModel.getData();
                this._originalData = JSON.parse(JSON.stringify(oData));
            }
        },

        /**
         * Marca las filas hijas de un desglose con los flags necesarios para la vista.
         * - __isEditable: true para filas con proveedor asignado (editables)
         * - __isSinProveedor: true para la fila "Resto de proveedores" (calculada, solo lectura)
         */
        _markDesgloseChildren: function(aChildren) {
            aChildren.forEach(function(oChild) {
                if (oChild.__isSinProveedor === true) {
                    oChild.__isEditable = false;
                } else {
                    oChild.__isEditable = true;
                    oChild.__isSinProveedor = false;
                }
            });
        },

        /**
         * Handler del botón "+" inline de la columna PhPspnr.
         * Crea una nueva fila de desglose vacía (con proveedor) en el array children
         * de la operación pulsada (tanto Inversión como Amortización).
         */
        onAddDesglosePress: function(oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("inmovilizadosModel");
            if (!oContext) return;

            var oData = oContext.getObject();
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();

            // Validación: solo para operaciones con Estructura='O' (TipoInd I o A)
            if (oData.Estructura !== "O") {
                return;
            }

            // Obtener o inicializar el array de children
            var aChildren = oData.children ? oData.children.slice() : [];

            // Etiquetas para la fila cabecera del desglose (i18n con fallbacks)
            var sLabelAgrup    = this.getTranslatedText("agrupador")        || "Agrupador";
            var sLabelDescrip  = this.getTranslatedText("DESCRIPCION")      || "Descripción";
            var sLabelProv     = this.getTranslatedText("proveedor")        || "Proveedor";
            var sLabelEje      = this.getTranslatedText("ejecutado")        || "Ejecutado";
            var sLabelPend     = this.getTranslatedText("pendiente")        || "Pendiente";
            var sLabelTot      = this.getTranslatedText("total")            || "Total";
            var sLabelReparto  = this.getTranslatedText("dbReparto")        || "Reparto";
            var sLabelPenPlan  = this.getTranslatedText("dbPendPlanificar") || "Pend. planificar";
            var sLabelResto    = this.getTranslatedText("restoProv")        || "Resto de proveedores";

            // Etiquetas adicionales para las columnas de Valor Residual y % Residual
            var sLabelValResid   = this.getTranslatedText("valorResidual")      || "Val. Residual";
            var sLabelPctResid   = this.getTranslatedText("percValorResidual")  || "% Residual";

            // Crear la fila cabecera gris (solo si es el primer desglose)
            var bHasHeader = aChildren.some(function(c) { return c.__isHeader === true; });
            if (!bHasHeader) {
                var oHeaderRow = {
                    __isCustom: true,
                    __isHeader: true,
                    __isEditable: false,
                    __isSinProveedor: false,
                    _headerAgrup:    sLabelAgrup,
                    _headerDescr:    sLabelDescrip,
                    _headerProv:     sLabelProv,
                    _headerEje:      sLabelEje,
                    _headerPend:     sLabelPend,
                    _headerTot:      sLabelTot,
                    _headerValResid: sLabelValResid,
                    _headerPctResid: sLabelPctResid,
                    _headerReparto:  sLabelReparto,
                    _headerPenPlan:  sLabelPenPlan,
                    AGRUP: "", Post1: "", DESCRIP: "", LIFNR: "",
                    INVEJE: "0", INVPEN: "0", INVTOT: "0", PENPLAN: "0",
                    ValResidAmo: "0", PctjResidAmo: "",
                    Tipo: sLabelReparto, PenPlan: sLabelPenPlan,
                    _Ejecutado: "0", _Pendiente: "0", _Total: "0",
                    children: []
                };
                aChildren.unshift(oHeaderRow);
            }

            // Calcular el siguiente número de agrupador (AGRUP) libre
            var iMaxNum = 0;
            aChildren.forEach(function(oChild) {
                if (oChild.__isEditable === true) {
                    var sAgrup = oChild.AGRUP || "";
                    var iNum = parseInt(sAgrup, 10);
                    if (!isNaN(iNum) && iNum > iMaxNum) {
                        iMaxNum = iNum;
                    }
                }
            });
            var sNextAgrup = (iMaxNum + 1).toString().padStart(3, "0");

            // Determinar los items de reparto según el TipoInd del padre
            var aDesgloseRepartoItems;
            if (oData.TipoInd === "A") {
                aDesgloseRepartoItems = [
                    { key: "OEO", text: "OEO" },
                    { key: "LIN", text: "Lineal" },
                    { key: "MAN", text: "Manual" }
                ];
            } else {
                aDesgloseRepartoItems = [
                    { key: "MAN", text: "Manual" }
                ];
            }

            // Crear la nueva fila de desglose editable
            var oNewDesglose = {
                __isCustom: true,
                __isEditable: true,
                __isSinProveedor: false,
                __isHeader: false,
                AGRUP:  "",
                DESCRIP: "",
                LIFNR:  "",
                _headerProv: "",
                INVEJE: "0",
                INVPEN: "0",
                INVTOT: "0",
                PENPLAN: "0",
                //   Campos residuales: se mantienen las cuatro propiedades backend
                //   (Inv/Amo) a cero y un campo unificado _ValResid/_PctjResid que pinta
                //   la celda. onDesgloseValResidChange/PctResidChange escriben en el campo
                //   real correcto segun el TipoInd del padre del desglose.
                ValResidAmo: "0",
                PctjResidAmo: "",
                ValResidInv: "0",
                PctjResidInv: "0",
                _ValResid: "0",
                _PctjResid: "",
                TIPO:   "MAN",
                repartoItems: aDesgloseRepartoItems,
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0",
                Val05a1: "0", Val06a1: "0", Val07a1: "0", Val08a1: "0",
                Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0",
                Totala1: "0",
                children: []
            };

            // Insertar la nueva fila de desglose antes de la fila "Resto de proveedores"
            var iSinProveedorIdx = aChildren.findIndex(function(c) { return c.__isSinProveedor === true; });
            if (iSinProveedorIdx !== -1) {
                aChildren.splice(iSinProveedorIdx, 0, oNewDesglose);
            } else {
                aChildren.push(oNewDesglose);

                // Determinar valores para "Resto" según TipoInd
                var sInvEje = oData.TipoInd === "I" ? (oData.InvEje || "0") : (oData.AmoEje || "0");
                var sInvPen = oData.TipoInd === "I" ? (oData.InvPen || "0") : (oData.AmoPen || "0");
                var sInvTot = oData.TipoInd === "I" ? (oData.InvTot || "0") : (oData.AmoTot || "0");

                var oResto = {
                    __isCustom: true,
                    __isEditable: false,
                    __isSinProveedor: true,
                    __isHeader: false,
                    AGRUP:  "",
                    Post1:  sLabelResto,
                    LIFNR:  "",
                    _headerProv: "",
                    INVEJE: sInvEje,
                    INVPEN: sInvPen,
                    INVTOT: sInvTot,
                    PENPLAN: "0",
                    _ValResid: "0",
                    _PctjResid: "",
                    TIPO:   "MAN",
                    Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0",
                    Val05a1: "0", Val06a1: "0", Val07a1: "0", Val08a1: "0",
                    Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0",
                    Totala1: "0",
                    children: []
                };
                aChildren.push(oResto);
            }

            // Actualizar el array de children en el modelo
            oModel.setProperty(sPath + "/children", aChildren);
            oModel.refresh(true);

            // Expandir el nodo padre para mostrar los hijos recién añadidos
            var oTable = this.byId("TreeTableInmovilizados");
            if (oTable) {
                var oBinding = oTable.getBinding("rows");
                if (oBinding) {
                    var iLength = oBinding.getLength();
                    for (var i = 0; i < iLength; i++) {
                        var oCtx = oTable.getContextByIndex(i);
                        if (oCtx && oCtx.getPath() === sPath) {
                            oBinding.expand(i);
                            break;
                        }
                    }
                }
            }

            this._markVariantDirty();
            sap.m.MessageToast.show(
                this.getTranslatedText("MSG_DESGLOSE_CREADO") || "Línea de desglose añadida correctamente."
            );
        },

        /**
         * Handler del botón de agrupación en la fila cabecera del desglose.
         * Alterna el estado __agrupadorActive en la fila cabecera del bloque.
         */
        onAgrupadorButtonPress: function(oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("inmovilizadosModel");
            if (!oContext) return;

            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();

            var bCurrentActive = oData.__agrupadorActive === true;
            oModel.setProperty(sPath + "/__agrupadorActive", !bCurrentActive);
            oModel.refresh(true);
            this._markVariantDirty();
        },

        /**
         * Handler para cambio de campo AGRUP en filas de desglose.
         */
        onDesglosAGRUPChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            if (oContext) {
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                oModel.setProperty(sPath + "/AGRUP", oSource.getValue());
                this._markVariantDirty();
            }
        },

        /**
         * Handler para cambio del campo Proveedor (LIFNR) en filas de desglose.
         * Valida que el proveedor no esté ya asignado en otra fila del mismo desglose.
         */
        onDesgloseProveedorChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            if (!oContext) return;

            var sNewLifnr = oSource.getValue().trim();
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();

            if (!sNewLifnr) {
                oModel.setProperty(sPath + "/LIFNR", "");
                return;
            }

            // Validación: no duplicados en el mismo bloque
            var sParentPath = sPath.substring(0, sPath.lastIndexOf("/"));
            var aParentData = oModel.getProperty(sParentPath);
            if (Array.isArray(aParentData)) {
                var bDuplicado = aParentData.some(function(oSibling) {
                    return oSibling !== oData &&
                        oSibling.__isEditable === true &&
                        (oSibling.LIFNR || "").trim().toUpperCase() === sNewLifnr.toUpperCase();
                });
                if (bDuplicado) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: [{ text: this.getTranslatedText("ERROR_PROVEEDOR_DUPLICADO_DESGLOSE"), type: "Error" }]
                    });
                    oSource.setValue(oData.LIFNR || "");
                    return;
                }
            }

            oModel.setProperty(sPath + "/LIFNR", sNewLifnr);
            this._markVariantDirty();
        },

        //   Devuelve el TipoInd de la operacion padre de una fila de desglose. El padre
        //   es siempre la operacion inmediata: el path del hijo es ".../children/N", por
        //   lo que se elimina ese ultimo segmento para leer su TipoInd. Sirve para rutar
        //   el residual del desglose al campo backend correcto (Inversion vs Amortizacion).
        _getParentTipoInd: function(oModel, sPath) {
            var sParentPath = sPath.replace(/\/children\/\d+$/, "");
            return oModel.getProperty(sParentPath + "/TipoInd");
        },

        /**
         * Handler para cambio del Valor residual en fila de desglose.
         * Escribe en ValResidInv/ValResidAmo segun el TipoInd del padre.
         */
        onDesgloseValResidChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            if (!oContext) return;

            var sRawValue = oSource.getValue();
            var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
            var sCurrencyFormat = oAppData.CurrencyFormat;
            var sThousandSep = sCurrencyFormat.charAt(0);
            var sDecimalSep = sCurrencyFormat.charAt(1);
            sRawValue = sRawValue.split(sThousandSep).join("").split(sDecimalSep).join(".");

            var fValue = parseFloat(sRawValue) || 0;
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var sCampo = this._getParentTipoInd(oModel, sPath) === "I" ? "ValResidInv" : "ValResidAmo";
            oModel.setProperty(sPath + "/" + sCampo, fValue.toString());
            oModel.setProperty(sPath + "/_ValResid", fValue.toString());
            this._markVariantDirty();
        },

        /**
         * Handler para cambio del % residual en fila de desglose.
         * Escribe en PctjResidInv/PctjResidAmo segun el TipoInd del padre.
         */
        onDesglosePctResidChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            if (!oContext) return;

            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var sCampo = this._getParentTipoInd(oModel, sPath) === "I" ? "PctjResidInv" : "PctjResidAmo";
            oModel.setProperty(sPath + "/" + sCampo, oSource.getValue());
            oModel.setProperty(sPath + "/_PctjResid", oSource.getValue());
            this._markVariantDirty();
        },

        /**
         * Handler para cambio de INVPEN en fila de desglose.
         */
        onDesgloseInvPenChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            if (!oContext) return;

            var sRawValue = oSource.getValue();
            var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
            var sCurrencyFormat = oAppData.CurrencyFormat;
            var sThousandSep = sCurrencyFormat.charAt(0);
            var sDecimalSep = sCurrencyFormat.charAt(1);
            sRawValue = sRawValue.split(sThousandSep).join("").split(sDecimalSep).join(".");

            var fPen = parseFloat(sRawValue) || 0;
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();
            var fEje = parseFloat(oData.INVEJE) || 0;
            oModel.setProperty(sPath + "/INVPEN", fPen.toString());
            oModel.setProperty(sPath + "/INVTOT", (fPen + fEje).toString());
            this._markVariantDirty();
        },

        /**
         * Handler para cambio de INVTOT en fila de desglose.
         * Recalcula INVPEN = INVTOT - INVEJE.
         */
        onDesgloseInvTotChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            if (!oContext) return;

            var sRawValue = oSource.getValue();
            var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
            var sCurrencyFormat = oAppData.CurrencyFormat;
            var sThousandSep = sCurrencyFormat.charAt(0);
            var sDecimalSep = sCurrencyFormat.charAt(1);
            sRawValue = sRawValue.split(sThousandSep).join("").split(sDecimalSep).join(".");

            var fTot = parseFloat(sRawValue) || 0;
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();
            var fEje = parseFloat(oData.INVEJE) || 0;

            oModel.setProperty(sPath + "/INVTOT", fTot.toString());
            oModel.setProperty(sPath + "/INVPEN", (fTot - fEje).toString());
            this._markVariantDirty();
        },

        initInmovilizadosModel: async function (sPreviousKey) {
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");
            var sFreal = "";

            var versiones = this.getGlobalModel("appData").getData().NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }

            if (!sFreal) {
                setTimeout(function () {
                    this.initInmovilizadosModel(sPreviousKey);
                }.bind(this), 500);
                return;
            }

            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                return;
            }

            var sEjercicioFromSelector = this._getSelectedEjercicio();
            var sEjercicioFallback = oDateStart.getFullYear().toString();
            var sEjercicio = sEjercicioFromSelector || sEjercicioFallback;
            const token = this.getGlobalModel("appData").getProperty("/EvToken");

            try {
                const response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/CambioPestIndirectosSet",
                    {
                        "NavSelProyecto": [this.getGlobalModel("appData").getData().tramo],
                        "NavChanges": [],
                        "NavDatosIndirectos": [],
                        "NavKpisIndirectos": [],
                        "EvBloqueados": this.getGlobalModel("appData").getProperty("/EvBloqueados") || "",
                        "NavMensajes": [],
                        "NavLtVersiones": [flagSelectVersion]
                    },
                    {
                        headers: {
                            ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                            lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                            bloqueado: this.getGlobalModel("appData").getProperty("/EvBloqueados") || "",
                            decimales: this.getGlobalModel("dashboardModel").getData().decimales,
                            ejercicio: sEjercicio,
                            pestana: "Inmovilizados",
                            token: token
                        }
                    }
                );

                var aMensajes = response.NavMensajes?.results || [];
                var aMensajesError = aMensajes.filter(function(mensaje) { return mensaje.Tipo === "E"; });
                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function(m) { return { text: m.Mensaje || m.Message || m.text || "", type: "Error" }; })
                    });
                }
                var sEvBloqueados = response.EvBloqueados || "";
                var bIsBlocked = sEvBloqueados.trim().length > 0;
                this.getGlobalModel("appData").setProperty("/EvBloqueados", sEvBloqueados);
                var oModeloBloqueo = this.getView().getModel("modeloBloqueo");
                if (!oModeloBloqueo) {
                    oModeloBloqueo = new sap.ui.model.json.JSONModel({ isBlocked: bIsBlocked });
                    this.getView().setModel(oModeloBloqueo, "modeloBloqueo");
                } else {
                    oModeloBloqueo.setProperty("/isBlocked", bIsBlocked);
                }
                this._setWaersFromData(response.NavDatosIndirectos.results); //   captura la moneda de la obra para formatDecimales
                this._addComputedFields(response.NavDatosIndirectos.results);
                this._updateKpiTables(response.NavDatosIndirectos.results);
                const tree = this.buildTree(response.NavDatosIndirectos.results);
                this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "inmovilizadosModel");
                this._createSnapshot();
                this._originalInmovilizadosData = JSON.parse(JSON.stringify(tree));
                setTimeout(function () { this.colorRows(); }.bind(this), 500);
            } catch (error) { }
        },

        _updateKpiTables: function(aData) {
            var aRaiz = aData.filter(function(item) { return item.ParentPath === "I"; });
            var oInv = aRaiz.find(function(item) { return item.TipoInd === "I"; }) || {};
            var oAmo = aRaiz.find(function(item) { return item.TipoInd === "A"; }) || {};
            var oDataTitleModel = new sap.ui.model.json.JSONModel({
                data: [{
                    title:  oInv._Ejecutado || "0",
                    title2: oInv._Pendiente || "0",
                    title3: oInv._Total     || "0",
                    title4: oAmo._Ejecutado || "0",
                    title5: oAmo._Pendiente || "0",
                    title6: oAmo._Total     || "0"
                }]
            });
            this.getView().setModel(oDataTitleModel, "dataTitle");
        },

        _addComputedFields: function(aData) {
            aData.forEach(function(item) {
                if (item.TipoInd === "I") {
                    item._Ejecutado = item.InvEje || "0";
                    item._Pendiente = item.InvPen || "0";
                    item._Total = item.InvTot || "0";
                    //   La columna Valor/% Residual comparte una unica plantilla para las
                    //   filas de Inversion (I) y Amortizacion (A). Se unifica aqui el valor a
                    //   mostrar tomandolo del campo backend correcto segun TipoInd: Inversion
                    //   lee ValResidInv/PctjResidInv, Amortizacion ValResidAmo/PctjResidAmo.
                    item._ValResid = item.ValResidInv || "0";
                    item._PctjResid = item.PctjResidInv || "0";
                } else {
                    item._Ejecutado = item.AmoEje || "0";
                    item._Pendiente = item.AmoPen || "0";
                    item._Total = item.AmoTot || "0";
                    item._ValResid = item.ValResidAmo || "0";
                    item._PctjResid = item.PctjResidAmo || "0";
                }
            });
        },

        buildTree: function (data) {
            const groups = {};
            data.forEach(item => {
                if (!groups[item.PhPspnr]) {
                    groups[item.PhPspnr] = {};
                }

                var isLevel3 = item.PhPspnr.split(".").length >= 3;

                var repartoItems;
                if (item.TipoInd === "I") {
                    // Para Inversión: solo Manual
                    repartoItems = [
                        { key: "MAN", text: "Manual" }
                    ];
                } else if (item.TipoInd === "A") {
                    // Para Amortización: OEO, Lineal y Manual
                    repartoItems = [
                        { key: "OEO", text: "OEO" },
                        { key: "LIN", text: "Lineal" },
                        { key: "MAN", text: "Manual" }
                    ];
                } else {
                    repartoItems = [
                        { key: "MAN", text: "Manual" }
                    ];
                }

                groups[item.PhPspnr][item.TipoInd] = {
                    ...item,
                    isLevel3: isLevel3,
                    isNew: false,
                    repartoItems: repartoItems,
                    children: []
                };
            });

            const result = [];
            const processed = new Set();

            // Primero: buscar y añadir el objeto con PhPspnr = "D"
            if (groups["D"]) {
                Object.keys(groups["D"]).forEach(tipo => {
                    result.push(groups["D"][tipo]);
                });
                processed.add("D");
            }

            // Después: todos los demás, ordenados por PhPspnr, con P antes de B
            data.forEach(item => {
                if (processed.has(item.PhPspnr)) return;
                processed.add(item.PhPspnr);

                const versionP = groups[item.PhPspnr]["I"];
                const versionB = groups[item.PhPspnr]["A"];

                if (versionP) {
                    result.push(versionP);
                }
                if (versionB) {
                    result.push(versionB);
                }
            });

            return result;
        },
        _parseODataDate: function (sODataDate) {
            if (!sODataDate) return null;
            var oMatch = /\/Date\((\d+)\)\//.exec(sODataDate);
            if (oMatch) {
                return new Date(parseInt(oMatch[1], 10));
            }
            return new Date(sODataDate);
        },

        /**
         * Al seleccionar/deseleccionar una fila, sincroniza automáticamente la otra versión
         * del mismo elemento (mismo PhPspnr, distinto TipoInd: "I" ↔ "A").
         */
        onRowSelectionChange: function (oEvent) {
            if (this._bSelectionChanging) {
                return;
            }

            var oTable = this.byId("TreeTableInmovilizados");
            if (!oTable) {
                return;
            }

            var oBinding = oTable.getBinding("rows");
            if (!oBinding) {
                return;
            }
            var iTotalRows = oBinding.getLength();

            var aPrevious = this._aPreviousSelectedIndices || [];
            var aCurrent = oTable.getSelectedIndices();

            // Calcular filas recién seleccionadas y recién deseleccionadas
            var aAdded = aCurrent.filter(function (i) { return aPrevious.indexOf(i) === -1; });
            var aRemoved = aPrevious.filter(function (i) { return aCurrent.indexOf(i) === -1; });

            // Guardar la selección actual para la próxima vez
            this._aPreviousSelectedIndices = aCurrent.slice();

            if (aAdded.length === 0 && aRemoved.length === 0) {
                return;
            }

            // Busca el índice de la fila hermana (mismo PhPspnr, TipoInd opuesto)
            var fnFindSibling = function (iIdx, aExclude) {
                var oCtx = oTable.getContextByIndex(iIdx);
                if (!oCtx) { return -1; }
                var oData = oCtx.getObject();
                if (!oData || !oData.PhPspnr || !oData.TipoInd) { return -1; }
                var sPhPspnr = oData.PhPspnr;
                var sSiblingTipoInd = oData.TipoInd === "I" ? "A" : "I";
                for (var i = 0; i < iTotalRows; i++) {
                    if (aExclude.indexOf(i) !== -1) { continue; }
                    var oSibCtx = oTable.getContextByIndex(i);
                    if (!oSibCtx) { continue; }
                    var oSibData = oSibCtx.getObject();
                    if (oSibData && oSibData.PhPspnr === sPhPspnr && oSibData.TipoInd === sSiblingTipoInd) {
                        return i;
                    }
                }
                return -1;
            };

            this._bSelectionChanging = true;
            try {
                // Seleccionar hermanas de las filas añadidas
                aAdded.forEach(function (iIdx) {
                    var iSibling = fnFindSibling(iIdx, aCurrent);
                    if (iSibling !== -1) {
                        oTable.addSelectionInterval(iSibling, iSibling);
                        if (this._aPreviousSelectedIndices.indexOf(iSibling) === -1) {
                            this._aPreviousSelectedIndices.push(iSibling);
                        }
                    }
                }.bind(this));

                // Deseleccionar hermanas de las filas eliminadas
                aRemoved.forEach(function (iIdx) {
                    var iSibling = fnFindSibling(iIdx, aRemoved);
                    if (iSibling !== -1) {
                        oTable.removeSelectionInterval(iSibling, iSibling);
                        var iPos = this._aPreviousSelectedIndices.indexOf(iSibling);
                        if (iPos !== -1) {
                            this._aPreviousSelectedIndices.splice(iPos, 1);
                        }
                    }
                }.bind(this));
            } finally {
                this._bSelectionChanging = false;
            }
        },

        /**
         * Adjunta un listener al botón de colapsar/expandir del header del ObjectPageLayout
         * para recalcular las filas dinámicas cuando cambia el estado del header
         */
        _attachHeaderToggleListener: function () {
            // Evitar adjuntar múltiples veces
            if (this._headerListenerAttached) {
                return;
            }
            
            var oObjectPageLayout = this.byId("objectPageInmovilizados");
            if (!oObjectPageLayout) {
                console.warn("ObjectPageLayout no encontrado en _attachHeaderToggleListener");
                return;
            }

            console.log("Adjuntando listener al ObjectPageLayout");

            // Usar un timeout para asegurar que el DOM está completamente renderizado
            setTimeout(function () {
                var oDom = oObjectPageLayout.getDomRef();
                if (!oDom) {
                    console.warn("DOM del ObjectPageLayout no disponible");
                    return;
                }

                oDom.addEventListener("click", function () {
                    setTimeout(function () {
                        this._calculateDynamicRows();
                        this.colorRows();
                    }.bind(this), 100);
                }.bind(this), true);

                // Buscar el botón de colapsar específicamente
                var oCollapseBtn = oDom.querySelector('[id*="collapseBtn"]');
                if (oCollapseBtn) {
                    console.log("Botón de colapsar encontrado:", oCollapseBtn.id);
                    oCollapseBtn.addEventListener("click", function () {
                        console.log("Click en botón de colapsar detectado");
                        setTimeout(function () {
                            console.log("Llamando a _calculateDynamicRows");
                            this._calculateDynamicRows();
                        }.bind(this), 300);
                    }.bind(this));
                    
                    this._headerListenerAttached = true;
                } else {
                    console.warn("Botón de colapsar no encontrado en el DOM");
                }

                // También capturar clics en el título del header (toggleHeaderOnTitleClick)
                var oHeaderTitle = oDom.querySelector('[id*="headerTitle"]');
                if (oHeaderTitle) {
                    console.log("Título del header encontrado");
                    oHeaderTitle.addEventListener("click", function () {
                        console.log("Click en título del header detectado");
                        setTimeout(function () {
                            console.log("Llamando a _calculateDynamicRows desde título");
                            this._calculateDynamicRows();
                        }.bind(this), 300);
                    }.bind(this));
                }

            }.bind(this), 500);
        },

        
        /**
         * Aplica colores a las filas de la tabla con debouncing para mejorar el rendimiento.
         * Se cancela cualquier petición pendiente y se programa una nueva con un retardo de 80ms,
         * evitando así ejecuciones excesivas durante el scroll.
         * @param {boolean} [bClearAmortizacion] - Si es true, las filas con TipoInd="A" no recibirán color
         */
        colorRows: function (bClearAmortizacion) {
            if (this._colorRowsTimer) {
                clearTimeout(this._colorRowsTimer);
            }
            this._colorRowsTimer = setTimeout(function () {
                this._colorRowsTimer = null;
                this._applyRowColors(bClearAmortizacion);
            }.bind(this), 80);
        },

        /**
         * Función interna que aplica los colores a las filas según TipoInd.
         * Usa el índice DOM real de cada fila (data-sap-ui-rowindex) en lugar del índice
         * del array getRows(), para evitar desajustes durante la virtualización de la tabla.
         * @param {boolean} [bClearAmortizacion] - Si es true, las filas con TipoInd="A" no recibirán color
         * @private
         */
        _applyRowColors: function (bClearAmortizacion) {
            var oTable = this.byId("TreeTableInmovilizados");
            if (!oTable) return;

            var aRows = oTable.getRows();
            if (!aRows || aRows.length === 0) return;

            // Cachear el wrapper jQuery de la tabla fuera del loop para evitar
            // crear objetos jQuery costosos en cada iteración
            var $table = oTable.$();
            var sTableId = oTable.getId();

            aRows.forEach(function (oRow) {
                var oRowDom = oRow.getDomRef();
                if (!oRowDom) return;

                // Obtener el índice real del DOM para evitar desajuste con la virtualización
                var iIdx = oRowDom.getAttribute("data-sap-ui-rowindex");
                if (iIdx === null) return;

                var $fixed  = $table.find(".sapUiTableCtrlFixed tbody tr[data-sap-ui-rowindex='" + iIdx + "']");
                var $scroll = $table.find(".sapUiTableCtrlScroll tbody tr[data-sap-ui-rowindex='" + iIdx + "']");
                var $rowSel = jQuery("#" + sTableId + "-rowsel" + iIdx);

                // Limpiar clases anteriores en todos los fragmentos de la fila
                oRowDom.classList.remove("rowVersionB", "rowVersionP");
                $fixed.removeClass("rowVersionB rowVersionP");
                $scroll.removeClass("rowVersionB rowVersionP");
                $rowSel.removeClass("rowVersionB rowVersionP");

                var oContext = oRow.getBindingContext("inmovilizadosModel");
                if (!oContext) return; // Fila vacía: queda limpia

                var sTipoInd = oContext.getProperty("TipoInd");
                if (!sTipoInd) return;

                // Si se indicó que se deben limpiar las filas de amortización (TipoInd="A"),
                // no se aplica color a esas filas (llamada desde onFilterTipoIndChange)
                if (bClearAmortizacion && sTipoInd === "A") return;

                // Aplicar clase según TipoInd
                var sCls = sTipoInd === "I" ? "rowVersionP" : sTipoInd === "A" ? "rowVersionB" : null;
                if (sCls) {
                    oRowDom.classList.add(sCls);
                    $fixed.addClass(sCls);
                    $scroll.addClass(sCls);
                    $rowSel.addClass(sCls);
                }
            });
        },
        onAmoPenChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            this.onRowInputChangeInversion(oEvent);
            if (oContext) {
                var sRawValue = oSource.getValue();
                var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
                var sCurrencyFormat = oAppData.CurrencyFormat;
                var sThousandSep = sCurrencyFormat.charAt(0);
                var sDecimalSep = sCurrencyFormat.charAt(1);

                sRawValue = sRawValue.split(sThousandSep).join("");
                sRawValue = sRawValue.split(sDecimalSep).join(".");

                var fPendiente = parseFloat(sRawValue) || 0;
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var oData = oContext.getObject();
                var sTipoInd = oData.TipoInd;
                
                if (sTipoInd === "I") {
                    oModel.setProperty(sPath + "/InvPen", fPendiente.toString());
                    var fInvEje = parseFloat(oData.InvEje) || 0;
                    var fInvTot = fPendiente + fInvEje;
                    oModel.setProperty(sPath + "/InvTot", fInvTot.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fPendiente.toString());
                    oModel.setProperty(sPath + "/_Total", fInvTot.toString());
                } else if (sTipoInd === "A") {
                    oModel.setProperty(sPath + "/AmoPen", fPendiente.toString());
                    var fAmoEje = parseFloat(oData.AmoEje) || 0;
                    var fAmoTot = fPendiente + fAmoEje;
                    oModel.setProperty(sPath + "/AmoTot", fAmoTot.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fPendiente.toString());
                    oModel.setProperty(sPath + "/_Total", fAmoTot.toString());
                }

            }
        },

        onAmoTotChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            this.onRowInputChangeInversion(oEvent);
            if (oContext) {
                var sRawValue = oSource.getValue();
                var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
                var sCurrencyFormat = oAppData.CurrencyFormat;
                var sThousandSep = sCurrencyFormat.charAt(0);
                var sDecimalSep = sCurrencyFormat.charAt(1);

                sRawValue = sRawValue.split(sThousandSep).join("");
                sRawValue = sRawValue.split(sDecimalSep).join(".");

                var fTotal = parseFloat(sRawValue) || 0;
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var oData = oContext.getObject();
                var sTipoInd = oData.TipoInd;
                
                if (sTipoInd === "I") {
                    oModel.setProperty(sPath + "/InvTot", fTotal.toString());
                    var fInvEje = parseFloat(oData.InvEje) || 0;
                    var fInvPen = fTotal - fInvEje;
                    oModel.setProperty(sPath + "/InvPen", fInvPen.toString());
                    oModel.setProperty(sPath + "/_Total", fTotal.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fInvPen.toString());
                } else if (sTipoInd === "A") {
                    oModel.setProperty(sPath + "/AmoTot", fTotal.toString());
                    var fAmoEje = parseFloat(oData.AmoEje) || 0;
                    var fAmoPen = fTotal - fAmoEje;
                    oModel.setProperty(sPath + "/AmoPen", fAmoPen.toString());
                    oModel.setProperty(sPath + "/_Total", fTotal.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fAmoPen.toString());
                }

            }
        },

        onValResidChange: function(oEvent){
            this._guardarCampoResidual(oEvent, "ValResid", "_ValResid");
        },

        onPercValResidChange: function(oEvent){
            this._guardarCampoResidual(oEvent, "PctjResid", "_PctjResid");
        },

        //     Guardado temporal directo de Valor residual (ValResidAmo) y % Valor
        //   residual (PctjResidAmo). Antes ambos delegaban en onRowInputChange, cuyo filtro
        //   "valor nuevo === valor en modelo" abortaba el envio: en PctjResidAmo el binding
        //   TwoWay (sin formatter) ya habia actualizado el modelo antes del evento change, por
        //   lo que el guardado temporal nunca se lanzaba. Aqui se normaliza el valor al formato
        //   SAP, se actualiza el modelo y se envia la fila al backend en cada edicion.
        _guardarCampoResidual: function(oEvent, sCampoBase, sCampoUnificado){
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            if (!oContext) { return; }

            //   El campo backend destino depende del TipoInd de la fila: Inversion (I)
            //   escribe en ValResidInv/PctjResidInv y Amortizacion (A) en ValResidAmo/
            //   PctjResidAmo. La columna comparte una unica plantilla enlazada al campo
            //   unificado (_ValResid/_PctjResid), por lo que aqui se resuelve la propiedad
            //   real que viaja en el payload y en el header CampoMod.
            var sTipoInd = oContext.getProperty("TipoInd");
            var sCampo = sCampoBase + (sTipoInd === "I" ? "Inv" : "Amo");

            var sValorFormateado = this._formatToSAPNumber(oSource.getValue());
            if (sValorFormateado === null || sValorFormateado === undefined || sValorFormateado === "") {
                sValorFormateado = "0"; //   campo vaciado -> se envia 0 en lugar de cadena vacia
            }

            var oModel = oContext.getModel();
            var sPath = oContext.getPath();
            //   Se actualiza tanto la propiedad backend real como el campo unificado que
            //   pinta la celda, para que el valor editado persista y se siga mostrando.
            oModel.setProperty(sPath + "/" + sCampo, sValorFormateado);
            oModel.setProperty(sPath + "/" + sCampoUnificado, sValorFormateado);

            var oPayloadRow = this._sanitizeRowForBackend(oContext.getObject());
            oPayloadRow[sCampo] = sValorFormateado;
            this._enviarFilaAlBackend(oContext, oPayloadRow, sCampo);
        },

        onAddPress: function(oEvent){
            var oTable = this.byId("TreeTableInmovilizados");
            var aSelectedIndices = oTable.getSelectedIndices();
            var oModel = this.getView().getModel("inmovilizadosModel");
            
            // Validación 1: Se debe seleccionar al menos una línea
            if (aSelectedIndices.length === 0) {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: this.getTranslatedText("ERROR_SELECCIONE_LINEA"),
                        type: "Error"
                    }]
                });
                return;
            }
            
            // Validación 2: Con la selección sincronizada, se espera que haya 2 o múltiplos de 2 líneas seleccionadas
            // Se verifica que todas las líneas seleccionadas correspondan al mismo PhPspnr
            var aSelectedRows = [];
            var sPhPspnr = null;
            
            for (var i = 0; i < aSelectedIndices.length; i++) {
                var oContext = oTable.getContextByIndex(aSelectedIndices[i]);
                if (oContext) {
                    var oRow = oContext.getObject();
                    aSelectedRows.push(oRow);
                    
                    if (sPhPspnr === null) {
                        sPhPspnr = oRow.PhPspnr;
                    } else if (sPhPspnr !== oRow.PhPspnr) {
                        this.createMessageDialog({
                            title: this.getTranslatedText("ERROR"),
                            textAccept: this.getTranslatedText("ACEPTAR"),
                            messages: [{
                                text: this.getTranslatedText("ERROR_SOLO_UNA_LINEA"),
                                type: "Error"
                            }]
                        });
                        return;
                    }
                }
            }
            
            // Se usa la primera fila seleccionada para las validaciones
            var oSelectedRow = aSelectedRows[0];
            if (!oSelectedRow) {
                return;
            }
            
            // Validación 2: No se puede seleccionar la primera línea (OEO con PhPspnr = "D")
            if (sPhPspnr === "D") {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: this.getTranslatedText("ERROR_NO_ANADIR_OEO"),
                        type: "Error"
                    }]
                });
                return;
            }
            
            // Determinar el nivel de la operación basado en PhPspnr
            var iLevel = this._getOperationLevel(sPhPspnr);
            
            // Validación 3: No se puede seleccionar una operación de nivel 3 o desglose
            if (iLevel === 3) {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: this.getTranslatedText("ERROR_NO_ANADIR_NIVEL3"),
                        type: "Error"
                    }]
                });
                return;
            }
            
            // Si es nivel 1 (capítulo): Abrir popup con catálogo de operaciones
            if (iLevel === 1) {
                this._openOperationsCatalog(oSelectedRow, oContext);
                return;
            }
            
            // Si es nivel 2 (operación)
            if (iLevel === 2) {
                // Obtener todos los elementos del modelo para determinar si la fila tiene hijos reales.
                // Los hijos de una fila nivel 2 son los elementos cuyo ParentPath coincide con el PhPspnr de la fila.
                var aInmovilizadosData = oModel.getData() || [];
                var bTieneHijos = aInmovilizadosData.some(function (oItem) {
                    return oItem.ParentPath === oSelectedRow.PhPspnr;
                });

                // Validación 4: No se puede seleccionar una operación de nivel 2 con desgloses (hijos)
                if (oSelectedRow.children && oSelectedRow.children.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: [{
                            text: this.getTranslatedText("ERROR_NO_ANADIR_CON_DESGLOSES"),
                            type: "Error"
                        }]
                    });
                    return;
                }
                
                // Validación 5: No se puede seleccionar una operación de nivel 2 con datos ejecutados y sin hijos
                var fAmoEje = parseFloat(oSelectedRow.AmoEje) || 0;
                if (fAmoEje > 0 && !bTieneHijos) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: [{
                            text: this.getTranslatedText("ERROR_NO_ANADIR_CON_EJECUTADO"),
                            type: "Error"
                        }]
                    });
                    return;
                }
                
                // Crear línea vacía de nivel 3
                this._createLevel3Row(oSelectedRow, oContext);
            }
        },
        
        onDeletePress: async function(){
            var oTable = this.byId("TreeTableInmovilizados");
            var aSelectedIndices = oTable.getSelectedIndices();
            var oModel = this.getView().getModel("inmovilizadosModel");
            
            // Validación: Se debe seleccionar al menos una línea
            if (aSelectedIndices.length === 0) {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: this.getTranslatedText("ERROR_SELECCIONE_LINEA"),
                        type: "Error"
                    }]
                });
                return;
            }
            
            // Recopilar las líneas seleccionadas para eliminar
            //   Cada fila se sanea con _sanitizeRowForBackend para evitar propiedades cliente.
            var aLinesToDelete = [];
            aSelectedIndices.forEach(function(iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (oContext) {
                    aLinesToDelete.push(this._sanitizeRowForBackend(oContext.getObject()));
                }
            }.bind(this));
            
            if (aLinesToDelete.length === 0) {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: "No se pudieron obtener los datos de las líneas seleccionadas",
                        type: "Error"
                    }]
                });
                return;
            }
            
            // Llamar al servicio de eliminación
            try {
                await this._callDelIndirectosService(aLinesToDelete);
            } catch (error) {
                sap.m.MessageBox.error(
                    "Error al eliminar las operaciones: " + (error.message || error),
                    {
                        title: this.getTranslatedText("ERROR")
                    }
                );
            }
        },
        
        /**
         * Llama al servicio DelIndirectosSet para eliminar operaciones
         * @param {array} aLinesToDelete - Array de líneas a eliminar
         * @returns {Promise} - Promesa con la respuesta del servicio
         */
        _callDelIndirectosService: async function(aLinesToDelete) {
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");
            
            // Obtener la versión activa
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });
            
            // Obtener Freal (ejercicio)
            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }
            
            if (!sFreal) {
                throw new Error("Fecha real no disponible");
            }
            
            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                throw new Error("Fecha real inválida");
            }
            
            var sEjercicio = oDateStart.getFullYear().toString();
            const token = oAppData.EvToken;
            
            // Mostrar diálogo de carga
            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("ELIMINANDO_DATOS") || "Eliminando..."
                });
            }
            this._busyDialog.open();
            
            try {
                // Realizar la llamada al servicio DelIndirectosSet
                var response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/DelIndirectosSet",
                    {
                        "NavSelProyecto": [oAppData.tramo],
                        "NavLtVersiones": [flagSelectVersion],
                        "NavDatosIndirectos": aLinesToDelete,
                        "NavMensajes": []
                    },
                    {
                        headers: {
                            ambito: oAppData.userData.initialNode,
                            lang: oAppData.userData.AplicationLangu,
                            decimales: oDashModel.getData().decimales,
                            norma: this.getGlobalModel("normModel").getData().norma || "",
                            ejercicio: sEjercicio,
                            pestana: "Inmovilizados",
                            token: token
                        }
                    }
                );
                
                this._busyDialog.close();
                
                // Verificar si hay mensajes de error
                var aMensajes = response.NavMensajes?.results || [];
                var aMensajesError = aMensajes.filter(function(mensaje) {
                    return mensaje.Tipo === "E";
                });
                
                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                    });
                    return;
                }
                
                // Si no hay errores, eliminar las líneas del modelo local
                var oModel = this.getView().getModel("inmovilizadosModel");
                var aData = oModel.getData();
                
                // Eliminar las líneas seleccionadas del array de datos
                aLinesToDelete.forEach(function(oLineToDelete) {
                    var iIndex = aData.findIndex(function(oItem) {
                        return oItem.PhPspnr === oLineToDelete.PhPspnr && 
                               oItem.TipoInd === oLineToDelete.TipoInd;
                    });
                    
                    if (iIndex !== -1) {
                        aData.splice(iIndex, 1);
                    }
                });
                
                // Actualizar el modelo
                oModel.setData(aData);
                oModel.refresh();
                
                // Limpiar la selección de la tabla
                var oTable = this.byId("TreeTableInmovilizados");
                oTable.clearSelection();
                
                // Marcar la variante como modificada
                this._markVariantDirty();
                
                // Mensaje de éxito
                sap.m.MessageToast.show(
                    //    Se traduce via i18n con placeholder {0} para soportar EN/FR.  
                    this.getTranslatedText("MSG_LINEAS_ELIMINADAS", [aLinesToDelete.length])
                    //   
                );
                
                // Mostrar mensajes informativos si los hay
                var aMensajesInfo = aMensajes.filter(function(mensaje) {
                    return mensaje.Tipo === "S" || mensaje.Tipo === "I" || mensaje.Tipo === "W";
                });
                
                if (aMensajesInfo.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("INFORMACION") || "Información",
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesInfo.map(function(mensaje) {
                            var sType = "Information";
                            if (mensaje.Tipo === "W") sType = "Warning";
                            if (mensaje.Tipo === "S") sType = "Success";
                            
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: sType
                            };
                        })
                    });
                }
                
                return response;
                
            } catch (error) {
                this._busyDialog.close();
                throw error;
            }
        },

        /**
         * Determina el nivel de la operación basándose en el formato de PhPspnr
         * @param {string} sPhPspnr - Código de la operación
         * @returns {number} - Nivel de la operación (1, 2 o 3)
         */
        _getOperationLevel: function(sPhPspnr) {
            if (!sPhPspnr || sPhPspnr === "D") {
                return 0;
            }
            
            var aParts = sPhPspnr.split(".");
            return aParts.length - 1;
        },
        
        /**
         * Abre el popup con el catálogo de operaciones para un capítulo (nivel 1)
         * @param {object} oSelectedRow - Fila seleccionada
         * @param {object} oContext - Contexto de la fila
         */
        _openOperationsCatalog: async function (oSelectedRow, oContext) {
            // Guardar el contexto de la fila seleccionada para usarlo después
            this._selectedChapterRow = oSelectedRow;
            this._selectedChapterContext = oContext;

            // Obtener los datos necesarios para la llamada al servicio
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");

            // Obtener la versión activa
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            // Obtener Freal (ejercicio)
            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }

            if (!sFreal) {
                //    Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_FECHA_REAL_NO_DISPONIBLE"));
                //   
                return;
            }

            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                //    Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_FECHA_REAL_INVALIDA"));
                //   
                return;
            }

            var sEjercicio = oDateStart.getFullYear().toString();
            const token = oAppData.EvToken;

            // Mostrar diálogo de carga
            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("CARGANDO_DATOS")
                });
            }
            this._busyDialog.open();

            try {
                // Realizar la llamada al servicio CatalogoIndirectosSet
                var response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/CatalogoIndirectosSet",
                    {
                        "NavDatosCatalogo": []
                    },
                    {
                        headers: {
                            norma: this.getGlobalModel("normModel").getData().norma || "",
                            ambito: oAppData.userData.initialNode,
                            lang: oAppData.userData.AplicationLangu,
                            pestana: "Inmovilizados"
                        }
                    }
                );

                this._busyDialog.close();

                // Obtener los datos del catálogo
                var aCatalogData = response.NavDatosCatalogo?.results || [];

                if (aCatalogData.length === 0) {
                    sap.m.MessageBox.information(
                        "No hay operaciones disponibles para este capítulo",
                        {
                            title: this.getTranslatedText("CATALOGO_OPERACIONES_TITULO")
                        }
                    );
                    return;
                }

                // Transformar los datos al formato esperado por el fragment
                var aOperations = aCatalogData.map(function (item) {
                    return {
                        Code: item.PhPspnr || item.Codigo || "",
                        Description: item.Post1 || item.Descripcion || ""
                    };
                });

                // Crear el modelo para el catálogo
                var oCatalogModel = new sap.ui.model.json.JSONModel({
                    operations: aOperations
                });
                this.getView().setModel(oCatalogModel, "catalogModel");

                // Abrir el diálogo del catálogo
                this._openCatalogDialog();

            } catch (error) {
                this._busyDialog.close();
                sap.m.MessageBox.error(
                    this.getTranslatedText("CATALOGO_ERROR_SERVICIO") + "\n" + (error.message || error),
                    {
                        title: this.getTranslatedText("ERROR")
                    }
                );
            }
        },

        /**
         * Abre el diálogo del catálogo de operaciones
         */
        _openCatalogDialog: function() {
            if (!this._catalogDialog) {
                this._catalogDialog = sap.ui.xmlfragment(
                    "zindirect_costs.fragments.OperationsCatalogDialog",
                    this
                );
                this.getView().addDependent(this._catalogDialog);
            }
            this._catalogDialog.open();
        },

        /**
         * Cierra el diálogo del catálogo de operaciones
         */
        onCloseCatalogDialog: function() {
            if (this._catalogDialog) {
                this._catalogDialog.close();
                this._catalogDialog.destroy();
                this._catalogDialog = null;
            }
        },

        /**
         * Llama al servicio AddIndirectosSet para añadir o validar operaciones
         * @param {array} aOperationsData - Array de operaciones a añadir/validar
         * @returns {Promise} - Promesa con la respuesta del servicio
         */
        _callAddIndirectosService: async function(aOperationsData) {
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");
            
            // Obtener la versión activa
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });
            
            // Obtener Freal (ejercicio)
            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }
            
            if (!sFreal) {
                throw new Error("Fecha real no disponible");
            }
            
            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                throw new Error("Fecha real inválida");
            }
            
            var sEjercicio = oDateStart.getFullYear().toString();
            const token = oAppData.EvToken;
            
            // Mostrar diálogo de carga
            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("CARGANDO_DATOS")
                });
            }
            this._busyDialog.open();
            
            try {
                // Realizar la llamada al servicio AddIndirectosSet
                var response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/AddIndirectosSet",
                    {
                        "NavSelProyecto": [oAppData.tramo],
                        "NavLtVersiones": [flagSelectVersion],
                        "NavDatosCatalogo": aOperationsData,
                        "NavMensajes": [],
                        "NavDatosIndirectos": []
                    },
                    {
                        headers: {
                            ambito: oAppData.userData.initialNode,
                            lang: oAppData.userData.AplicationLangu,
                            decimales: oDashModel.getData().decimales,
                            norma: this.getGlobalModel("normModel").getData().norma || "",
                            ejercicio: sEjercicio,
                            pestana: "Inmovilizados",
                            token: token
                        }
                    }
                );
                
                this._busyDialog.close();
                return response;
                
            } catch (error) {
                this._busyDialog.close();
                throw error;
            }
        },

        /**
         * Añade las operaciones seleccionadas del catálogo a la treetable
         */
        onAddSelectedOperations: function() {
            if (!this._catalogDialog) {
                return;
            }
            
            var oCatalogTable = this._catalogDialog.getContent()[0].getItems()[1];
            
            if (!oCatalogTable) {
                //    Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_TABLA_CATALOGO_NO_ENCONTRADA"));
                //   
                return;
            }
            
            var aSelectedIndices = oCatalogTable.getSelectedIndices();
            
            if (aSelectedIndices.length === 0) {
                //    Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.warning(this.getTranslatedText("ERROR_DEBE_SELECCIONAR_OPERACION"));
                //   
                return;
            }
            
            var oCatalogModel = this.getView().getModel("catalogModel");
            var aAllOperations = oCatalogModel.getProperty("/operations");
            var aSelectedOperations = [];
            
            aSelectedIndices.forEach(function(iIndex) {
                if (aAllOperations[iIndex]) {
                    aSelectedOperations.push(aAllOperations[iIndex]);
                }
            });
            
            var aOperationsToAdd = aSelectedOperations.map(function(oOp) {
                return {
                    PhPspnr: oOp.Code,
                    Descripcion: oOp.Description
                };
            });
            
            this._callAddIndirectosService(aOperationsToAdd).then(function(response) {
                var aMensajes = response.NavMensajes?.results || [];
                var aMensajesError = aMensajes.filter(function(mensaje) {
                    return mensaje.Tipo === "E";
                });
                
                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                    });
                    return;
                }
                
                this.onCloseCatalogDialog();
                
                var aCreatedOperations = response.NavDatosIndirectos?.results || [];
                
                if (aCreatedOperations.length > 0) {
                    this._addOperationsToTree(aCreatedOperations);
                    //    Se traduce el mensaje via i18n con el placeholder {0} para soportar EN/FR.  
                    sap.m.MessageToast.show(this.getTranslatedText("MSG_OPERACIONES_ANADIDAS", [aCreatedOperations.length / 2]));
                    //   
                }
            }.bind(this)).catch(function(error) {
                sap.m.MessageBox.error(
                    "Error al añadir las operaciones: " + (error.message || error),
                    {
                        title: this.getTranslatedText("ERROR")
                    }
                );
            }.bind(this));
        },

        _addOperationsToTree: function(aOperationsFromService) {
            if (!this._selectedChapterRow || aOperationsFromService.length === 0) {
                return;
            }
            
            var oModel = this.getView().getModel("inmovilizadosModel");
            var aData = oModel.getData();
            var sChapterCode = this._selectedChapterRow.PhPspnr;
            
            var iChapterAIndex = -1;
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === sChapterCode && aData[i].TipoInd === "A") {
                    iChapterAIndex = i;
                    break;
                }
            }
            
            if (iChapterAIndex === -1) {
                //    Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_CAPITULO_NO_ENCONTRADO"));
                //   
                return;
            }
            
            var iInsertIndex = iChapterAIndex + 1;
            
            aOperationsFromService.sort(function(a, b) {
                if (a.PhPspnr === b.PhPspnr) {
                    return a.TipoInd === "I" ? -1 : 1;
                }
                return a.PhPspnr.localeCompare(b.PhPspnr);
            });
            
            aOperationsFromService.forEach(function(oOperation) {
                if (!oOperation.children) {
                    oOperation.children = [];
                }
                if (!oOperation.repartoItems) {
                    if (oOperation.TipoInd === "I") {
                        // Para Inversión: solo Manual
                        oOperation.repartoItems = [{ key: "MAN", text: "Manual" }];
                    } else if (oOperation.TipoInd === "A") {
                        // Para Amortización: OEO, Lineal y Manual
                        oOperation.repartoItems = [
                            { key: "OEO", text: "OEO" },
                            { key: "LIN", text: "Lineal" },
                            { key: "MAN", text: "Manual" }
                        ];
                    } else {
                        oOperation.repartoItems = [{ key: "MAN", text: "Manual" }];
                    }
                }
                if (!oOperation.Post1 && oOperation.Descripcion) {
                    oOperation.Post1 = oOperation.Descripcion;
                }
                oOperation.isNew = false;
                oOperation.isLevel3 = oOperation.PhPspnr && oOperation.PhPspnr.split(".").length === 4;
                
                aData.splice(iInsertIndex, 0, oOperation);
                iInsertIndex++;
            }.bind(this));
            
            oModel.setData(aData);
            oModel.refresh();
            this._markVariantDirty();
        },

        _createLevel3Row: function(oParentRow, oContext) {
            var oModel = this.getView().getModel("inmovilizadosModel");
            var sParentCode = oParentRow.PhPspnr;
            var aParentParts = sParentCode.split(".");
            
            if (aParentParts.length !== 3) {
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_FORMATO_PADRE"));
                return;
            }
            
            // Obtener la lista plana de datos del modelo
            var aData = oModel.getData();
            
            // Buscar ambos padres (TipoInd "I" y "A") con el mismo PhPspnr
            var oParentI = null;
            var oParentA = null;
            var iParentAIndex = -1;
            
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === sParentCode) {
                    if (aData[i].TipoInd === "I") {
                        oParentI = aData[i];
                    } else if (aData[i].TipoInd === "A") {
                        oParentA = aData[i];
                        iParentAIndex = i;
                    }
                }
            }
            
            if (!oParentA || iParentAIndex === -1) {
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_PADRE_NO_ENCONTRADO"));
                return;
            }
            
            // Buscar todas las operaciones hermanas existentes (mismo prefijo, nivel 3)
            var aSiblings = [];
            var sParentPrefix = sParentCode + "."; // Ej: "I.001.002."
            
            for (var i = 0; i < aData.length; i++) {
                var sCode = aData[i].PhPspnr;
                // Verificar si es nivel 3 y empieza con el prefijo del padre
                if (sCode && sCode.startsWith(sParentPrefix)) {
                    var aParts = sCode.split(".");
                    if (aParts.length === 4) { // Es nivel 3
                        var sLastPart = aParts[3];
                        var iNumber = parseInt(sLastPart, 10);
                        if (!isNaN(iNumber)) {
                            aSiblings.push(iNumber);
                        }
                    }
                }
            }
            
            // Calcular el siguiente número disponible
            var iNextNumber = 1; // Por defecto .001
            if (aSiblings.length > 0) {
                // Encontrar el número más alto y sumar 1
                var iMaxNumber = Math.max.apply(null, aSiblings);
                iNextNumber = iMaxNumber + 1;
            }
            
            // Formatear el número con 3 dígitos (001, 002, etc.)
            var sNextCode = iNextNumber.toString().padStart(3, "0");
            var sNewCode = sParentCode + "." + sNextCode; // Ej: "I.001.002.004"
            
            // Crear la primera fila con TipoInd = "I"
            var oNewRowI = {
                PhPspnr: sNewCode,
                Post1: "",
                TipoInd: "I",
                InvEje: "0",
                Invejereal: "0",
                Invejeajus: "0",
                AmoEje: "0",
                AmoPen: "0",
                AmoTot: "0",
                Tipo: oParentI ? (oParentI.Tipo || "") : "",
                PenPlan: "",
                months: "",
                pend: "",
                _Ejecutado: "0",
                _Pendiente: "0",
                _Total: "0",
                ValResidAmo:"0",
                PctjResidAmo:"0",
                isLevel3: true,
                isNew: true,
                ParentCode: sParentCode,  // Código del padre para validación
                PhPspnrEdited: false,  // Bandera para rastrear si PhPspnr ha sido editado manualmente
                Post1Edited: false,    // Bandera para rastrear si Post1 ha sido editado manualmente
                repartoItems: oParentI ? (oParentI.repartoItems || []) : [{ key: "O", text: "OEO" }],
                children: [],
                Totala1: "0", Totala2: "0", Totala3: "0", Totala4: "0", Totala5: "0",
                Totala6: "0", Totala7: "0", Totala8: "0", Totala9: "0", Totala10: "0",
                Resto: "0",
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0", Val05a1: "0", Val06a1: "0",
                Val07a1: "0", Val08a1: "0", Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0"
            };
            
            // Crear la segunda fila con TipoInd = "A"
            var oNewRowA = {
                PhPspnr: sNewCode,
                Post1: "",
                TipoInd: "A",
                InvEje: "0",
                Invejereal: "0",
                Invejeajus: "0",
                AmoEje: "0",
                AmoPen: "0",
                AmoTot: "0",
                Tipo: oParentA.Tipo || "",
                PenPlan: "",
                months: "",
                pend: "",
                _Ejecutado: "0",
                _Pendiente: "0",
                _Total: "0",
                ValResidAmo:"0",
                PctjResidAmo:"0",
                isLevel3: true,
                isNew: true,
                ParentCode: sParentCode,  // Código del padre para validación
                PhPspnrEdited: false,  // Bandera para rastrear si PhPspnr ha sido editado manualmente
                Post1Edited: false,    // Bandera para rastrear si Post1 ha sido editado manualmente
                repartoItems: oParentA.repartoItems || [{ key: "MAN", text: "Manual" }],
                children: [],
                Totala1: "0", Totala2: "0", Totala3: "0", Totala4: "0", Totala5: "0",
                Totala6: "0", Totala7: "0", Totala8: "0", Totala9: "0", Totala10: "0",
                Resto: "0",
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0", Val05a1: "0", Val06a1: "0",
                Val07a1: "0", Val08a1: "0", Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0"
            };
            
            // Buscar el índice de la última operación hermana existente (mismo ParentCode)
            // para insertar las nuevas operaciones después de todas sus hermanas
            var iLastSiblingIndex = iParentAIndex;
            
            for (var i = iParentAIndex + 1; i < aData.length; i++) {
                if (aData[i].ParentCode === sParentCode) {
                    iLastSiblingIndex = i;
                } else if (aData[i].ParentCode && aData[i].ParentCode !== sParentCode) {
                    // Si encontramos una operación con diferente ParentCode, dejamos de buscar
                    break;
                }
            }
            
            // Insertar las dos nuevas operaciones después de la última operación hermana
            // Primero la "I", luego la "A"
            aData.splice(iLastSiblingIndex + 1, 0, oNewRowI);
            aData.splice(iLastSiblingIndex + 2, 0, oNewRowA);
            
            // Actualizar el modelo con los datos modificados
            oModel.setData(aData);
            oModel.refresh();
            
            // Mensaje de éxito
            var sMessage = this.getTranslatedText("MSG_OPERACIONES_CREADAS").replace("{0}", sNewCode);
            sap.m.MessageToast.show(sMessage);
            this._markVariantDirty();
        },

    _findRowIndex: function (aData, oRow, iCurrentIndex) {
        if (typeof iCurrentIndex === "undefined") {
            iCurrentIndex = 0;
        }

        for (var i = 0; i < aData.length; i++) {
            if (aData[i] === oRow) {
                return iCurrentIndex;
            }
            iCurrentIndex++;

            if (aData[i].children && aData[i].children.length > 0) {
                var iFound = this._findRowIndex(aData[i].children, oRow, iCurrentIndex);
                if (iFound !== -1) {
                    return iFound;
                }
                iCurrentIndex += this._countRows(aData[i].children);
            }
        }

        return -1;
    },

    _countRows: function (aData) {
        var iCount = 0;
        for (var i = 0; i < aData.length; i++) {
            iCount++;
            if (aData[i].children && aData[i].children.length > 0) {
                iCount += this._countRows(aData[i].children);
            }
        }
        return iCount;
    },

    /**
      * Se ejecuta al cambiar la descripción de operación (Post1)
      * Si ambos campos (Post1 y PhPspnr) tienen valor y la fila es nueva, llama al servicio para validar
      */
    onDescOperacionChange: function (oEvent) {
        var oSource = oEvent.getSource();
        var oContext = oSource.getBindingContext("inmovilizadosModel");

        if (oContext) {
            var oData = oContext.getObject();
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var sPost1Value = oSource.getValue().trim();

            // Actualizar el valor en el modelo
            oModel.setProperty(sPath + "/Post1", sPost1Value);

            // Replicar el cambio a la versión hermana (mismo PhPspnr, diferente TipoInd)
            if (oData.isNew) {
                this._replicatePost1ToSibling(oData, sPost1Value, oModel);
            }

            // Si ambos campos tienen valor y la fila es nueva, llamar al servicio
            if (sPost1Value && oData.PhPspnr && oData.isNew) {
                // Preparar los datos para enviar al servicio
                var aOperationToValidate = [{
                    PhPspnr: oData.PhPspnr,
                    Descripcion: sPost1Value
                }];

                // Llamar al servicio para validar la operación
                this._callAddIndirectosService(aOperationToValidate).then(function (response) {
                    // Verificar si hay mensajes de error
                    var aMensajes = response.NavMensajes?.results || [];
                    var aMensajesError = aMensajes.filter(function (mensaje) {
                        return mensaje.Tipo === "E";
                    });

                    if (aMensajesError.length > 0) {
                        // Mostrar errores
                        this.createMessageDialog({
                            title: this.getTranslatedText("ERROR"),
                            textAccept: this.getTranslatedText("ACEPTAR"),
                            messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                        });

                        // Revertir los cambios
                        oModel.setProperty(sPath + "/Post1", "");
                        oSource.setValue("");
                        return;
                    }

                    // Si la validación es exitosa, actualizar los datos con la respuesta del servicio
                    var aValidatedOperations = response.NavDatosIndirectos?.results || [];

                    if (aValidatedOperations.length > 0) {
                        // Buscar la operación validada que corresponde a esta fila
                        var oValidatedOp = aValidatedOperations.find(function (op) {
                            return op.PhPspnr === oData.PhPspnr && op.TipoInd === oData.TipoInd;
                        });

                        if (oValidatedOp) {
                            // Actualizar el modelo con los datos validados del servicio
                            Object.keys(oValidatedOp).forEach(function (key) {
                                if (oModel.getProperty(sPath + "/" + key) !== undefined) {
                                    oModel.setProperty(sPath + "/" + key, oValidatedOp[key]);
                                }
                            });
                        }

                        // Cambiar isNew a false
                        oModel.setProperty(sPath + "/isNew", false);

                        // Mensaje de éxito
                        //    Se traduce el mensaje via i18n para soportar EN/FR.  
                        sap.m.MessageToast.show(this.getTranslatedText("MSG_OPERACION_VALIDADA"));
                        //   
                    }
                }.bind(this)).catch(function (error) {
                    sap.m.MessageBox.error(
                        "Error al validar la operación: " + (error.message || error),
                        {
                            title: this.getTranslatedText("ERROR")
                        }
                    );
                }.bind(this));
            }
        }
    },
    /**
     * Se ejecuta al cambiar el código de operación (PhPspnr)
     * Las validaciones se realizan en el backend mediante el servicio AddIndirectosSet
     * Si ambos campos (PhPspnr y Post1) tienen valor y la fila es nueva, llama al servicio para validar
     */
    onPhPspnrChange: function (oEvent) {
        var oSource = oEvent.getSource();
        var oContext = oSource.getBindingContext("inmovilizadosModel");

        if (oContext) {
            var oData = oContext.getObject();
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var sOldValue = oData.PhPspnr; // Guardar el valor anterior
            var sNewValue = oSource.getValue().trim();

            // Actualizar el valor en el modelo
            oModel.setProperty(sPath + "/PhPspnr", sNewValue);

            // La versión hermana debe mantener el valor anterior del PhPspnr
            // No replicamos el nuevo valor, sino que aseguramos que mantiene el antiguo
            if (oData.isNew && sOldValue !== sNewValue) {
                this._ensureSiblingKeepsOldPhPspnr(oData, sOldValue, oModel);
            }

            // Si ambos campos tienen valor y la fila es nueva, llamar al servicio
            if (sNewValue && oData.Post1 && oData.isNew) {
                // Preparar los datos para enviar al servicio
                var aOperationToValidate = [{
                    PhPspnr: sNewValue,
                    Descripcion: oData.Post1
                }];

                // Llamar al servicio para validar la operación
                this._callAddIndirectosService(aOperationToValidate).then(function (response) {
                    // Verificar si hay mensajes de error
                    var aMensajes = response.NavMensajes?.results || [];
                    var aMensajesError = aMensajes.filter(function (mensaje) {
                        return mensaje.Tipo === "E";
                    });

                    if (aMensajesError.length > 0) {
                        // Mostrar errores (pueden incluir validaciones de formato, duplicados, etc.)
                        this.createMessageDialog({
                            title: this.getTranslatedText("ERROR"),
                            textAccept: this.getTranslatedText("ACEPTAR"),
                            messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                        });

                        // Revertir el cambio
                        oModel.setProperty(sPath + "/PhPspnr", "");
                        oSource.setValue("");
                        return;
                    }

                    // Si la validación es exitosa, actualizar los datos con la respuesta del servicio
                    var aValidatedOperations = response.NavDatosIndirectos?.results || [];

                    if (aValidatedOperations.length > 0) {
                        // Buscar la operación validada que corresponde a esta fila
                        var oValidatedOp = aValidatedOperations.find(function (op) {
                            return op.PhPspnr === sNewValue && op.TipoInd === oData.TipoInd;
                        });

                        if (oValidatedOp) {
                            // Actualizar el modelo con los datos validados del servicio
                            Object.keys(oValidatedOp).forEach(function (key) {
                                if (oModel.getProperty(sPath + "/" + key) !== undefined) {
                                    oModel.setProperty(sPath + "/" + key, oValidatedOp[key]);
                                }
                            });
                        }

                        // Cambiar isNew a false
                        oModel.setProperty(sPath + "/isNew", false);

                        // Mensaje de éxito
                        //    Se traduce el mensaje via i18n para soportar EN/FR.  
                        sap.m.MessageToast.show(this.getTranslatedText("MSG_OPERACION_VALIDADA"));
                        //   
                    }
                }.bind(this)).catch(function (error) {
                    sap.m.MessageBox.error(
                        "Error al validar la operación: " + (error.message || error),
                        {
                            title: this.getTranslatedText("ERROR")
                        }
                    );

                    // Revertir el cambio en caso de error
                    oModel.setProperty(sPath + "/PhPspnr", "");
                    oSource.setValue("");
                }.bind(this));
            }
        }
    },
        /**
         * Replica el valor de Post1 a la versión hermana (mismo PhPspnr, diferente TipoInd)
         */
        _replicatePost1ToSibling: function(oCurrentData, sPost1Value, oModel) {
            var aData = oModel.getData();
            var sSiblingTipoInd = oCurrentData.TipoInd === "I" ? "A" : "I";
            
            // Buscar la fila hermana (mismo PhPspnr, diferente TipoInd)
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === oCurrentData.PhPspnr && 
                    aData[i].TipoInd === sSiblingTipoInd &&
                    aData[i].isNew) {
                    // Actualizar Post1 en la versión hermana
                    oModel.setProperty("/" + i + "/Post1", sPost1Value);
                    break;
                }
            }
        },
        
        /**
         * Asegura que la versión hermana mantenga el valor antiguo de PhPspnr
         */
        _ensureSiblingKeepsOldPhPspnr: function(oCurrentData, sOldValue, oModel) {
            var aData = oModel.getData();
            var sSiblingTipoInd = oCurrentData.TipoInd === "I" ? "A" : "I";
            
            // Buscar la fila hermana (que todavía tiene el PhPspnr antiguo)
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === sOldValue && 
                    aData[i].TipoInd === sSiblingTipoInd &&
                    aData[i].isNew) {
                    // La version hermana ya conserva el valor correcto (el antiguo);
                    // no se requiere ninguna accion adicional, basta con no modificarla.
                    break;
                }
            }
        },

        /**
         * Maneja el cambio en los checkboxes de filtro de TipoInd
         * Filtra las filas de la TreeTable según los checkboxes seleccionados
         */
        onFilterTipoIndChange: function() {
            var oCheckboxInversion = this.byId("checkboxInversion");
            var oCheckboxAmortizacion = this.byId("checkboxAmortizacion");
            
            if (!oCheckboxInversion || !oCheckboxAmortizacion) {
                return;
            }
            
            var bShowInversion = oCheckboxInversion.getSelected();
            var bShowAmortizacion = oCheckboxAmortizacion.getSelected();
            
            // Obtener el modelo y los datos originales
            var oModel = this.getView().getModel("inmovilizadosModel");
            
            if (!oModel || !this._originalInmovilizadosData) {
                return;
            }
            
            // Crear una copia de los datos originales
            var aOriginalData = JSON.parse(JSON.stringify(this._originalInmovilizadosData));
            
            // Filtrar los datos según los checkboxes
            var aFilteredData = aOriginalData.filter(function(oItem) {
                if (oItem.TipoInd === "I" && !bShowInversion) {
                    return false;
                }
                if (oItem.TipoInd === "A" && !bShowAmortizacion) {
                    return false;
                }
                return true;
            });
            
            // Actualizar el modelo con los datos filtrados
            oModel.setData(aFilteredData);
            oModel.refresh();
            
            // Refrescar la tabla
            var oTable = this.byId("TreeTableInmovilizados");
            if (oTable) {
                var oBinding = oTable.getBinding("rows");
                if (oBinding) {
                    oBinding.refresh();
                }
            }
            
            // Refrescar los colores de las filas
            // Se pasa !bShowInversion: true cuando la inversión está oculta,
            // lo que indica que las filas de amortización (TipoInd="A") no deben colorearse
            setTimeout(function() {
                this.colorRows(!bShowInversion);
            }.bind(this), 100);
        },

        /**
         *    Se ejecuta antes de cerrar el navegador para advertir sobre cambios sin guardar.
         * Faltaba esta definicion en Inmovilizados aunque setInitData hacia
         * this.onBrowserClose.bind(this) (linea ~101) y onExit eliminaba el listener, por lo
         * que onInit lanzaba "Cannot read properties of undefined (reading 'bind')". Se replica
         * el comportamiento de las otras pestanas, comprobando hasUnsavedChanges de forma segura.
         */
        onBrowserClose: function (oEvent) {
            if (typeof this.hasUnsavedChanges === "function" && this.hasUnsavedChanges()) {
                oEvent.preventDefault();
                oEvent.returnValue = "";
                return "";
            }
        },

        /**
         * Limpia los event listeners al destruir el controlador
         */
        onExit: function () {

            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },
             _getStaticExportColumns: function () {
            //    Se traducen via i18n las cabeceras del export XLSX.  
            return [
                { header: this.getTranslatedText("oper"), path: "PhPspnr" },
                { header: this.getTranslatedText("DESCRIPCION"), path: "Post1" },
                { header: this.getTranslatedText("type"), path: "TipoInd" },
                { header: this.getTranslatedText("costEje"), path: "_Ejecutado" },
                { header: this.getTranslatedText("costPend"), path: "_Pendiente" },
                { header: this.getTranslatedText("costTotal"), path: "_Total" },
                { header: this.getTranslatedText("valorResidual"), path: "ValResidAmo" },
                { header: this.getTranslatedText("percValorResidual"), path: "PctjResidAmo" },
                { header: this.getTranslatedText("dbReparto"), path: "Tipo" },
                { header: this.getTranslatedText("dbPendPlanificar"), path: "PenPlan" }
            ];
            //   
        },

        /*   */
        /**
         *     Se activa el coloreado azzurrino de las filas Amortización (TipoInd === "A") en el export
         *   porque Inmovilizados sí maneja la dualidad Inversión/Amortización con estilo visual diferenciado.
         */
        _shouldShowAmortizationStyle: function () {
            return true; //  
        },

        /**
         *     Columnas estáticas de Inmovilizados para la Plantilla de carga (apartado 5.9 del spec).
         *   Estructura solicitada por el usuario: 11 columnas — incluye Valor residual y %Residual
         *   específicos de Inmovilizados (campos ValResidAmo/PctjResidAmo del modelo).
         */
        _getPlantillaStaticColumns: function () {
            //    Se traducen via i18n las cabeceras de la plantilla.  
            return [
                { header: this.getTranslatedText("colOperacionAgrupador"), path: "PhPspnr" },
                { header: this.getTranslatedText("DESCRIPCION"), path: "Post1" },
                { header: this.getTranslatedText("colTipoProveedor"), path: "TipoInd" },
                { header: this.getTranslatedText("ejecutado"), path: "_Ejecutado" },
                { header: this.getTranslatedText("pendiente") + "*", path: "_Pendiente" },
                { header: this.getTranslatedText("total"), path: "_Total" },
                { header: this.getTranslatedText("valorResidual") + "*", path: "ValResidAmo" },
                { header: this.getTranslatedText("percValorResidual"), path: "PctjResidAmo" },
                { header: this.getTranslatedText("dbReparto"), path: "Tipo" },
                { header: this.getTranslatedText("fechaInicio"), path: "FINI" },
                { header: this.getTranslatedText("fechaFin"), path: "FFIN" }
            ];
            //   
        },
    });
});
