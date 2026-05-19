sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "masterindirectos/controller/BaseController",
    "masterindirectos/model/formatter"
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

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Inmovilizados", {

        formatter: formatter,
        /**
         * Inicializa la vista de Diferidos definiendo el estado de navegación y visibilidad.
         * Configura la tabla principal y prepara las columnas anuales iniciales.
         */
        getCustomTableId: function () {
            return "TreeTableInmovilizados";
        },

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

            //  Se identifica esta vista como Inmovilizados para los headers de los servicios.
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
            let table = this.byId("TreeTableInmovilizados")
            table.attachEvent("rowsUpdated", this.colorRows.bind(this));
            table.attachEvent("firstVisibleRowChanged", this.colorRows.bind(this));
            table.rerender(true);
            
            // Adjuntar listener para el botón de colapsar del header después del renderizado
            this._attachHeaderToggleListener();
        },

        /**
         * Gestiona la visibilidad de columnas extendidas al expandir nodos en la TreeTable.
         */
        onToggleOpenState: function (oEvent) {
            var oTable = oEvent.getSource();
            var sTableId = oTable.getId();
            var bExpanded = oEvent.getParameter("expanded");
            var oUiModel = this.getView().getModel("ui");

            var oColMonths = this.byId("colMonths");
            var oColNew = this.byId("colNew");

            if (!bExpanded) {
                // Si se contrae un nodo, verifica si todavía quedan otros expandidos para mantener las columnas.
                var bAnyExpanded = false;
                var oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    for (var i = 0; i < oBinding.getLength(); i++) {
                        if (oTable.isExpanded(i)) {
                            bAnyExpanded = true;
                            break;
                        }
                    }
                }

                if (!bAnyExpanded) {
                    if (oColMonths) oColMonths.setVisible(false);
                    if (oColNew) oColNew.setVisible(false);

                    this._aGroupRanges = [];
                    oUiModel.setProperty("/showStickyAgrupador", false);
                    return;
                }
            } else {
                // Al expandir, asegura que las columnas de detalle sean visibles.
                if (oColMonths) oColMonths.setVisible(true);
                if (oColNew) oColNew.setVisible(true);
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
        initInmovilizadosModel: async function (sPreviousKey) {
            var oAppData = this.getGlobalModel("appData").getData();

            // Se obtiene la version activa desde el modelo global de la aplicacion.
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            // Se lee Freal desde appData como fuente global unica, con fallback al tramo
            // en caso de que el dashboard no haya persistido el valor todavia.
            var sFreal = oAppData.Freal || (oAppData.tramo && oAppData.tramo.Freal) || "";
            var oDashModel = this.getGlobalModel("dashboardModel")
            var sFreal = "";

            // Se recupera el arreglo de versiones desde el modelo global de la aplicación.
            var versiones = this.getGlobalModel("appData").getData().NavLtVersiones;
            // Se busca e identifica el objeto correspondiente a la versión que se encuentra actualmente marcada como activa ("X").
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            //  Se intenta obtener Freal desde appData.tramo como fuente principal.
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                // Se recurre al dashboardModel únicamente si appData no contiene Freal.
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }

            //Si Freal no está disponible en ninguna fuente, se reintenta tras 500ms
            // hasta que el modelo esté cargado. No se utiliza ningún valor por defecto.
            if (!sFreal) {

                setTimeout(function () {
                    this.initInmovilizadosModel(sPreviousKey);
                }.bind(this), 500);
                return;
            }

            // Se parsea la fecha de Freal al formato Date de JavaScript.
            var oDateStart = this._parseODataDate(sFreal);

            // Si el parseo de Freal falla, se detiene la ejecución sin enviar ninguna llamada.
            // No se permite continuar con un ejercicio incorrecto.
            if (!oDateStart || isNaN(oDateStart.getTime())) {

                return;
            }

            // Se extrae el año directamente de Freal para usarlo como ejercicio en la cabecera.
            var sEjercicio = oDateStart.getFullYear().toString();
            const token = this.getGlobalModel("appData").getProperty("/EvToken");

            try {
                const response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/CambioPestIndirectosSet",
                    {
                        "NavSelProyecto": [this.getGlobalModel("appData").getData().tramo],
                        "NavChanges": [],
                        "NavDatosIndirectos": [],
                        "EvBloqueados": "",
                        "NavMensajes": [],
                        "NavDatosIndirectos": [],
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
                    }

                // Capturar el estado de bloqueo de la pestaña desde EvBloqueados
                var sEvBloqueados = response.EvBloqueados || "";
                var bIsBlocked = sEvBloqueados.trim().length > 0;
                this.getGlobalModel("appData").setProperty("/EvBloqueados", sEvBloqueados);
                // Crear o actualizar el modelo de bloqueo
                var oModeloBloqueo = this.getView().getModel("modeloBloqueo");
                if (!oModeloBloqueo) {
                    oModeloBloqueo = new sap.ui.model.json.JSONModel({
                        isBlocked: bIsBlocked
                    });
                    this.getView().setModel(oModeloBloqueo, "modeloBloqueo");
                } else {
                    oModeloBloqueo.setProperty("/isBlocked", bIsBlocked);
                }

                this._addComputedFields(response.NavDatosIndirectos.results);
                const tree = this.buildTree(response.NavDatosIndirectos.results);
                this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "inmovilizadosModel");
                this._createSnapshot();
                this._originalInmovilizadosData = JSON.parse(JSON.stringify(tree));
                setTimeout(function () {
                    this.colorRows();
                }.bind(this), 500);

            } catch (error) {

            }
        },

        _addComputedFields: function(aData) {
            aData.forEach(function(item) {
                if (item.TipoInd === "I") {
                    item._Ejecutado = item.InvEje || "0";
                    item._Pendiente = item.InvPen || "0";
                    item._Total = item.InvTot || "0";
                } else {
                    item._Ejecutado = item.AmoEje || "0";
                    item._Pendiente = item.AmoPen || "0";
                    item._Total = item.AmoTot || "0";
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

                console.log("DOM del ObjectPageLayout encontrado");

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

        colorRows: function (bInversionVisible) {
            var oTable = this.byId("TreeTableInmovilizados");
            var aRows = oTable.getRows();
            var sTableId = oTable.getId();

            aRows.forEach(function (oRow, i) {
                var oContext = oRow.getBindingContext("inmovilizadosModel") 
                    || (oRow.oBindingContexts && oRow.oBindingContexts["inmovilizadosModel"]);

                var oFixedRef = oTable.$().find(".sapUiTableCtrlFixed tbody tr[data-sap-ui-rowindex='" + i + "']");
                var oScrollRef = oTable.$().find(".sapUiTableCtrlScroll tbody tr[data-sap-ui-rowindex='" + i + "']");
                var oRowSelRef = jQuery("#" + sTableId + "-rowsel" + i);

                oFixedRef.removeClass("rowVersionB rowVersionP");
                oScrollRef.removeClass("rowVersionB rowVersionP");
                oRowSelRef.removeClass("rowVersionB rowVersionP");

                if (!oContext) return;

                // Si bInversionVisible no se pasa como parámetro, verificar el estado del checkbox
               /* if (typeof bInversionVisible === "undefined") {
                    var oCheckboxInversion = this.byId("checkboxInversion");
                    if (oCheckboxInversion) {
                        bInversionVisible = oCheckboxInversion.getSelected();
                    }
                }*/

                var sTipoInd = oContext.getProperty("TipoInd");

                if (sTipoInd === "I") {
                    oFixedRef.addClass("rowVersionP");
                    oScrollRef.addClass("rowVersionP");
                    oRowSelRef.addClass("rowVersionP");
                } else if (sTipoInd === "A") {
                    // Solo aplicar la clase rowVersionB si las filas de Inversión están visibles
                    if (bInversionVisible !== false) {
                        oFixedRef.addClass("rowVersionB");
                        oScrollRef.addClass("rowVersionB");
                        oRowSelRef.addClass("rowVersionB");
                    } else {
                        // Si las filas de Inversión están ocultas, no aplicar la clase
                        oFixedRef.removeClass("rowVersionB");
                        oScrollRef.removeClass("rowVersionB");
                        oRowSelRef.removeClass("rowVersionB");
                    }
                }
            });
        },

        onAmoPenChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            this.onRowInputChange(oEvent);
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
            this.onRowInputChange(oEvent);
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
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("inmovilizadosModel");
            this.onRowInputChange(oEvent);
            if (oContext) {
                var sRawValue = oSource.getValue();
                var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
                var sCurrencyFormat = oAppData.CurrencyFormat;
                var sThousandSep = sCurrencyFormat.charAt(0);
                var sDecimalSep = sCurrencyFormat.charAt(1);

                sRawValue = sRawValue.split(sThousandSep).join("");
                sRawValue = sRawValue.split(sDecimalSep).join(".");

                var fValue = parseFloat(sRawValue) || 0;
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var oData = oContext.getObject();

                oModel.setProperty(sPath + "/ValResidAmo", fValue.toString());

            }
        },

        onPercValResidChange: function(oEvent){
            this.onRowInputChange(oEvent);
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
                if (fAmoEje > 0 && (!oSelectedRow.children || oSelectedRow.children.length === 0)) {
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
                    "Se han eliminado " + aLinesToDelete.length + " línea(s) correctamente"
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
                sap.m.MessageBox.error("Error: Fecha real no disponible");
                return;
            }

            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                sap.m.MessageBox.error("Error: Fecha real inválida");
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
                    "masterindirectos.fragments.OperationsCatalogDialog",
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
                sap.m.MessageBox.error("Error: Tabla del catálogo no encontrada");
                return;
            }
            
            var aSelectedIndices = oCatalogTable.getSelectedIndices();
            
            if (aSelectedIndices.length === 0) {
                sap.m.MessageBox.warning("Debe seleccionar al menos una operación");
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
                    sap.m.MessageToast.show("Se han añadido " + (aCreatedOperations.length / 2) + " operación(es) correctamente");
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
                sap.m.MessageBox.error("Error: No se encontró el capítulo seleccionado");
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
                        sap.m.MessageToast.show("Operación validada correctamente");
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
                        sap.m.MessageToast.show("Operación validada correctamente");
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
                    // La versión hermana ya tiene el valor correcto (el antiguo)
                    // No necesitamos hacer nada, solo asegurarnos de que no se cambie
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
            setTimeout(function() {
                this.colorRows(bShowInversion);
            }.bind(this), 100);
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
    });
});
