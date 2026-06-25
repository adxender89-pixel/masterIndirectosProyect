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

    return BaseController.extend("zindirect_costs.controller.DetailsControllers.Diferidos", {

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
                case "P":
                    sKey = "tipoIndAplicacion";
                    break;
                case "B":
                    sKey = "tipoIndProvision";
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
            return "TreeTableDiferidos";
        },
        //      Se sobrescribe el hook para indicar que
        //  en Diferidos el campo "Coste pendiente" se mapea en
        //  el modelo como "_Pendiente". Lo utiliza el
        //  onMonthInputChange del BaseController para calcular
        //  porcentajes sobre las celdas mensuales editables.
        _getCostePendienteField: function () {
            return "_Pendiente";
        },
        //    
        onInit: function () {

            this.setInitData();
            this._originalDiferidosData = null;

        },
        _shouldShowAmortizationStyle: function () {
    return true;
},
        setInitData: async function () {

            // Configuración de la variante para diferidos 
            this.initVariantConfig({
                tableId: "TreeTableDiferidos", // ID exacto del XML 
                modelName: "diferidosModel",     // Nombre del modelo de datos 
                storageKey: "diferidos_variants"  // Clave única en localStorage 
            });

            this._initVariantManagement(); // Ahora se llama sin parámetros

            //   Se identifica esta vista como Diferidos para los headers de los servicios.
            this._pestana = "Diferidos";

            this._initYearsModel();
            //this.initDiferidosModel(this._previousTabKey);
            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            // Ejecuta la configuración base para la TreeTable.
            this.setupDynamicTreeTable("TreeTableDiferidos");
            //  Se crean las columnas dinámicas utilizando el rango Freal → Frealfinobra,
            //  evitando el uso de años fijos basados en la fecha actual.
            this.createDynamicYearColumns("TreeTableInmovilizados");
            // Tras el renderizado, añade las columnas de los próximos 3 años.
            const oTable = this.byId(this.getCustomTableId());
            if (oTable) {
                oTable.addEventDelegate({
                    onAfterRendering: function () {
                        if (this._bDiferidosFirstRender) return;
                        this._bDiferidosFirstRender = true;

                        // this.createDynamicYearColumns(this.getCustomTableId());
                        this._attachHeaderToggleListener();


                    }.bind(this)
                });
            }


            this._boundResizeHandler = function () {
                this._calculateDynamicRows();
            }.bind(this);
            $(window).on("resize", this._boundResizeHandler);

            this._setupBrowserCloseHandler();
        },
        onBeforeRendering: function () {
            if (this._observer) {
                this._observer.disconnect();
                this._observer = null;
            }
        },

        /**
         * Forza el renderizado de la tabla una vez la vista está disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            let table = this.byId("TreeTableDiferidos");
            
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

            // Menú contextual con clic derecho sobre filas
            this._attachContextMenuToTable("TreeTableDiferidos");
        },

        /**
         * Gestiona la visibilidad de columnas extendidas al expandir nodos en la TreeTable.
         */
        onToggleOpenState: function (oEvent) {
            this._markVariantDirty();
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
                this.colorRows()
            }.bind(this), 0);
        },

        _createSnapshot: function () {
            var oDefaultModel = this.getView().getModel("diferidosModel");
            if (oDefaultModel) {
                var oData = oDefaultModel.getData();
                this._originalData = JSON.parse(JSON.stringify(oData));
            }
        },
        initDiferidosModel: async function (sPreviousKey) {
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

            //   Se intenta obtener Freal desde appData.tramo como fuente principal.
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
                    this.initDiferidosModel(sPreviousKey);
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

          //   Se obtiene el ejercicio desde el selector con fallback al año de Freal, 
            //   replicando el patron de Corrientes/Externos. Antes se leia siempre de Freal 
            //   por lo que el cambio de año en el selector no se reflejaba en el header. 
            var sEjercicioFromSelector = this._getSelectedEjercicio(); // 
            var sEjercicioFallback = oDateStart.getFullYear().toString(); // 
            var sEjercicio = sEjercicioFromSelector || sEjercicioFallback; // 
            const token = this.getGlobalModel("appData").getProperty("/EvToken");
            try {
                const response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/CambioPestIndirectosSet",
                    {
                        "NavSelProyecto": [this.getGlobalModel("appData").getData().tramo],
                        "NavChanges": [],
                        "NavDatosIndirectos": [],
                         "NavKpisIndirectos":[],
                        //   Se envía en el body el capítulo ya bloqueado por el usuario para evitar
                        //      que el backend lo intente bloquear de nuevo y dispare el error de
                        //      bloqueo propio al cambiar de año en el selector.
                        "EvBloqueados": this.getGlobalModel("appData").getProperty("/EvBloqueados") || "",
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
                            pestana: "Diferidos",
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

                this._setWaersFromData(response.NavDatosIndirectos.results); //   captura la moneda de la obra para formatDecimales
                this._addComputedFields(response.NavDatosIndirectos.results);
                this._updateKpiTables(response.NavDatosIndirectos.results);
                let tree = this.buildTree(response.NavDatosIndirectos.results)
                this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "diferidosModel");
                this._createSnapshot();
                this._originalDiferidosData = JSON.parse(JSON.stringify(tree));
                setTimeout(function () {
                    this.colorRows();
                }.bind(this), 500);

            } catch (error) {

            }
        },
        _parseODataDate: function (sODataDate) {
            if (!sODataDate) return null;
            var oMatch = /\/Date\((\d+)\)\//.exec(sODataDate);
            if (oMatch) {
                return new Date(parseInt(oMatch[1], 10));
            }
            return new Date(sODataDate);
        },

        _updateKpiTables: function(aData) {
            var aRaiz = aData.filter(function(item) { return item.ParentPath === "I"; });
            var oApl = aRaiz.find(function(item) { return item.TipoInd === "P"; }) || {};
            var oPro = aRaiz.find(function(item) { return item.TipoInd === "B"; }) || {};
            var oDataTitleModel = new sap.ui.model.json.JSONModel({
                data: [{
                    title:  oApl._Ejecutado || "0",
                    title2: oApl._Pendiente || "0",
                    title3: oApl._Total     || "0",
                    title4: oPro._Ejecutado || "0",
                    title5: oPro._Pendiente || "0",
                    title6: oPro._Total     || "0"
                }]
            });
            this.getView().setModel(oDataTitleModel, "dataTitle");
        },

        //   Diferidos NO repinta con la respuesta del guardado temporal (ver
        //   BaseController._shouldMergeTempSaveResponse). El backend devuelve el campo
        //   editado a 0 en GuardarTempIndir, por lo que volcar la respuesta borraba el
        //   valor tecleado y lo descuadraba entre Aplicacion (fila blanca) y Provision
        //   (fila azul). Se comporta como Corrientes: el guardado temporal conserva lo
        //   tecleado y el refresco real ocurre en initDiferidosModel (CambioPestIndirectos)
        //   tras el guardado definitivo.
        _shouldMergeTempSaveResponse: function () {
            return true;
        },

        _addComputedFields: function(aData) {
            aData.forEach(function(item) {
                //   Aplicacion (TipoInd="P") -> campos de Inversion (Inv*); Provision
                //   (TipoInd="B") -> campos de Amortizacion (Amo*). Coherente con
                //   _mergeBackendRowsIntoTree (que agrupa "P" con "I" -> Inv*) y con el
                //   convenio de Inmovilizados (I->Inv, A->Amo). Antes estaba invertido y
                //   los valores se volteaban tras el primer guardado temporal.
                if (item.TipoInd === "P") {
                    item._Ejecutado = item.InvEje || "0";
                    item._Pendiente = item.InvPen || "0";
                    item._Total = item.InvTot || "0";
                    item._PctjPen = item.PctjPenInv || "0";
                } else {
                    item._Ejecutado = item.AmoEje || "0";
                    item._Pendiente = item.AmoPen || "0";
                    item._Total = item.AmoTot || "0";
                    item._PctjPen = item.PctjPenAmo || "0";
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
                if (item.TipoInd === "P") {
                    // Para Provisión: solo Manual
                    repartoItems = [
                        { key: "MAN", text: "Manual" },
                        { key: "OEO", text: "OEO" }
                    ];
                } else if (item.TipoInd === "B") {
                    // Para Aplicación: solo OEO
                    repartoItems = [
                        { key: "OEO", text: "OEO" }
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

                const versionP = groups[item.PhPspnr]["P"];
                const versionB = groups[item.PhPspnr]["B"];

                if (versionP) {
                    result.push(versionP);
                }
                if (versionB) {
                    result.push(versionB);
                }
            });

            return result;
        },

        /**
         * Al seleccionar/deseleccionar una fila, sincroniza automáticamente la otra versión
         * del mismo elemento (mismo PhPspnr, distinto TipoInd: "P" ↔ "B").
         */
        onRowSelectionChange: function (oEvent) {
            if (this._bSelectionChanging) {
                return;
            }

            var oTable = this.byId("TreeTableDiferidos");
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
                var sSiblingTipoInd = oData.TipoInd === "P" ? "B" : "P";
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

        _attachHeaderToggleListener: function () {
            var oObjectPageLayout = this.byId("objectPageDiferidos");
            if (!oObjectPageLayout) return;

            setTimeout(function () {
                var oDom = oObjectPageLayout.getDomRef();
                if (!oDom) return;

                oDom.addEventListener("click", function () {
                    setTimeout(function () {
                        this._calculateDynamicRows();
                        this.colorRows();
                    }.bind(this), 100);
                }.bind(this), true);

            }.bind(this), 1000);
        },
        /**
         * Limpia los event listeners al destruir el controlador
         */
        onExit: function () {
            this._teardownBrowserCloseHandler();
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },
       /**
         * Aplica colores a las filas de la tabla con debouncing para mejorar el rendimiento.
         * Se cancela cualquier petición pendiente y se programa una nueva con un retardo de 80ms,
         * evitando así ejecuciones excesivas durante el scroll.
         * @param {boolean} [bClearProvision] - Si es true, las filas con TipoInd="B" no recibirán color
         */
        colorRows: function (bClearProvision) {
            if (this._colorRowsTimer) {
                clearTimeout(this._colorRowsTimer);
            }
            this._colorRowsTimer = setTimeout(function () {
                this._colorRowsTimer = null;
                this._applyRowColors(bClearProvision);
            }.bind(this), 80);
        },

        /**
         * Función interna que aplica los colores a las filas según TipoInd.
         * Usa el índice DOM real de cada fila (data-sap-ui-rowindex) en lugar del índice
         * del array getRows(), para evitar desajustes durante la virtualización de la tabla.
         * @param {boolean} [bClearProvision] - Si es true, las filas con TipoInd="B" no recibirán color
         * @private
         */
        _applyRowColors: function (bClearProvision) {
            var oTable = this.byId("TreeTableDiferidos");
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

                var oContext = oRow.getBindingContext("diferidosModel");
                if (!oContext) return; // Fila vacía: queda limpia

                var sTipoInd = oContext.getProperty("TipoInd");
                if (!sTipoInd) return;

                // Si se indicó que se deben limpiar las filas de provisión (TipoInd="B"),
                // no se aplica color a esas filas (llamada desde onFilterTipoIndChange)
                if (bClearProvision && sTipoInd === "B") return;

                // Aplicar clase según TipoInd (P = Prevision, B = Base)
                var sCls = sTipoInd === "P" ? "rowVersionP" : sTipoInd === "B" ? "rowVersionB" : null;
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
            var oContext = oSource.getBindingContext("diferidosModel");
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
                
                if (sTipoInd === "P") {
                    oModel.setProperty(sPath + "/InvPen", fPendiente.toString());
                    var fInvEje = parseFloat(oData.InvEje) || 0;
                    var fInvTot = fPendiente + fInvEje;
                    oModel.setProperty(sPath + "/InvTot", fInvTot.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fPendiente.toString());
                    oModel.setProperty(sPath + "/_Total", fInvTot.toString());
                } else if (sTipoInd === "B") {
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
            var oContext = oSource.getBindingContext("diferidosModel");
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
                
                if (sTipoInd === "P") {
                    oModel.setProperty(sPath + "/InvTot", fTotal.toString());
                    var fInvEje = parseFloat(oData.InvEje) || 0;
                    var fInvPen = fTotal - fInvEje;
                    oModel.setProperty(sPath + "/InvPen", fInvPen.toString());
                    oModel.setProperty(sPath + "/_Total", fTotal.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fInvPen.toString());
                } else if (sTipoInd === "B") {
                    oModel.setProperty(sPath + "/AmoTot", fTotal.toString());
                    var fAmoEje = parseFloat(oData.AmoEje) || 0;
                    var fAmoPen = fTotal - fAmoEje;
                    oModel.setProperty(sPath + "/AmoPen", fAmoPen.toString());
                    oModel.setProperty(sPath + "/_Total", fTotal.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fAmoPen.toString());
                }
            }
        },

        //      Se reescribe onPercPenAmo para que el
        //  campo PctjPenAmo dispare el guardado temporal en el
        //  backend de forma fiable. La delegacion previa en
        //  onRowInputChange fallaba en silencio: el Input
        //  plano usa TwoWay binding directo sobre
        //  diferidosModel>PctjPenAmo, por lo que el modelo se
        //  actualiza antes de que onRowInputChange ejecute el
        //  filtro "valor nuevo === valor en modelo", abortando
        //  el envio sin avisar. Se replica el patron usado en
        //  Inmovilizados._guardarCampoResidual (PctjResidAmo)
        //  que ya resolvio el mismo problema: contexto
        //  explicito sobre "diferidosModel", normalizacion via
        //  _formatToSAPNumber, persistencia en el modelo y
        //  envio del payload sanitizado a GuardarTempIndirSet
        //  con CampoMod = "PctjPenAmo".
        //    
        onPercPenAmo: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("diferidosModel");
            if (!oContext) {
                return;
            }

            var sValorFormateado = this._formatToSAPNumber(oSource.getValue());
            if (sValorFormateado === null || sValorFormateado === undefined || sValorFormateado === "") {
                //  Campo vaciado: se envia "0" en lugar de cadena
                //  vacia para evitar 400 Bad Request del backend.
                sValorFormateado = "0";
            }

            var oModel = oContext.getModel();
            var sPath = oContext.getPath();
            //   El %Pendiente apunta al campo segun TipoInd: Aplicacion (P) -> PctjPenInv,
            //   Provision (B) -> PctjPenAmo. La columna comparte una unica plantilla y pinta
            //   el campo unificado _PctjPen, que tambien se actualiza aqui. (Hoy solo es
            //   editable para P, pero se rutina por TipoInd por coherencia con el resto.)
            var sCampo = oContext.getObject().TipoInd === "P" ? "PctjPenInv" : "PctjPenAmo";
            oModel.setProperty(sPath + "/" + sCampo, sValorFormateado);
            oModel.setProperty(sPath + "/_PctjPen", sValorFormateado);

            var oPayloadRow = this._sanitizeRowForBackend(oContext.getObject());
            oPayloadRow[sCampo] = sValorFormateado;
            this._enviarFilaAlBackend(oContext, oPayloadRow, sCampo);
        },

        onAddPress: function(oEvent){
            var oTable = this.byId("TreeTableDiferidos");
            var aSelectedIndices = oTable.getSelectedIndices();
            var oModel = this.getView().getModel("diferidosModel");
            
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
            
            //    se delegan al backend las validaciones de fila OEO ("D"), de operacion de nivel 3 y de operacion con datos ejecutados (AmoEje > 0 y sin hijos). El servicio rechaza esas combinaciones con su propio mensaje y duplicarlas en cliente generaba mantenimiento adicional cada vez que cambiaba la regla de negocio. Se mantiene en local unicamente el bloqueo por desgloses preexistentes porque deriva del estado del modelo cargado y permite ahorrar un viaje innecesario al backend  

            // Determinar el nivel de la operación basado en PhPspnr
            var iLevel = this._getOperationLevel(sPhPspnr);

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

                // Crear línea vacía de nivel 3
                this._createLevel3Row(oSelectedRow, oContext);
            }
        },

        onDeletePress: async function(){
            var oTable = this.byId("TreeTableDiferidos");
            var aSelectedIndices = oTable.getSelectedIndices();
            var oModel = this.getView().getModel("diferidosModel");
            
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
                            pestana: "Diferidos"
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
                var oModel = this.getView().getModel("diferidosModel");
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
                var oTable = this.byId("TreeTableDiferidos");
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
                            pestana: "Diferidos"
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
                            pestana: "Diferidos",
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
         * bajo el capítulo (nivel 1) seleccionado previamente
         */
        onAddSelectedOperations: function() {
            if (!this._catalogDialog) {
                return;
            }
            
            // Obtener la tabla del catálogo del fragment
            var oCatalogTable = this._catalogDialog.getContent()[0].getItems()[1];
            
            if (!oCatalogTable) {
                //    Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_TABLA_CATALOGO_NO_ENCONTRADA"));
                //   
                return;
            }
            
            // Obtener los índices seleccionados
            var aSelectedIndices = oCatalogTable.getSelectedIndices();
            
            if (aSelectedIndices.length === 0) {
                //    Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.warning(this.getTranslatedText("ERROR_DEBE_SELECCIONAR_OPERACION"));
                //   
                return;
            }
            
            // Obtener las operaciones seleccionadas
            var oCatalogModel = this.getView().getModel("catalogModel");
            var aAllOperations = oCatalogModel.getProperty("/operations");
            var aSelectedOperations = [];
            
            aSelectedIndices.forEach(function(iIndex) {
                if (aAllOperations[iIndex]) {
                    aSelectedOperations.push(aAllOperations[iIndex]);
                }
            });
            
            // Preparar las operaciones para enviar al servicio
            var aOperationsToAdd = aSelectedOperations.map(function(oOp) {
                return {
                    PhPspnr: oOp.Code,
                    Descripcion: oOp.Description
                };
            });
            
            // Llamar al servicio para añadir las operaciones
            this._callAddIndirectosService(aOperationsToAdd).then(function(response) {
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
                
                // Cerrar el diálogo
                this.onCloseCatalogDialog();
                
                // Obtener las operaciones creadas del servicio
                var aCreatedOperations = response.NavDatosIndirectos?.results || [];
                
                if (aCreatedOperations.length > 0) {
                    // Añadir las operaciones devueltas por el servicio a la treetable
                    this._addOperationsToTree(aCreatedOperations);
                    
                    // Mensaje de éxito
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

        /**
         * Añade las operaciones seleccionadas del catálogo al árbol
         * bajo el capítulo seleccionado
         * @param {array} aOperationsFromService - Array de operaciones desde el servicio
         */
        _addOperationsToTree: function(aOperationsFromService) {
            if (!this._selectedChapterRow || aOperationsFromService.length === 0) {
                return;
            }
            
            var oModel = this.getView().getModel("diferidosModel");
            var aData = oModel.getData();
            var sChapterCode = this._selectedChapterRow.PhPspnr;
            
            // Encontrar el índice del capítulo (versión B) en la lista plana
            var iChapterBIndex = -1;
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === sChapterCode && aData[i].TipoInd === "B") {
                    iChapterBIndex = i;
                    break;
                }
            }
            
            if (iChapterBIndex === -1) {
                //    Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_CAPITULO_NO_ENCONTRADO"));
                //   
                return;
            }
            
            // Insertar las nuevas operaciones después del capítulo
            var iInsertIndex = iChapterBIndex + 1;
            
            // Ordenar las operaciones: primero TipoInd="P", luego TipoInd="B"
            aOperationsFromService.sort(function(a, b) {
                if (a.PhPspnr === b.PhPspnr) {
                    // Mismo PhPspnr: "P" antes de "B"
                    return a.TipoInd === "P" ? -1 : 1;
                }
                // Diferentes PhPspnr: mantener orden alfabético
                return a.PhPspnr.localeCompare(b.PhPspnr);
            });
            
            // Insertar las operaciones devueltas por el servicio
            aOperationsFromService.forEach(function(oOperation) {
                // Solo añadir propiedades UI necesarias si no existen
                if (!oOperation.children) {
                    oOperation.children = [];
                }
                // repartoItems basándose en TipoInd
                if (!oOperation.repartoItems) {
                    if (oOperation.TipoInd === "P") {
                        // Para Provisión: solo Manual
                        oOperation.repartoItems = [{ key: "MAN", text: "Manual" },{ key: "OEO", text: "OEO" }];
                    } else if (oOperation.TipoInd === "B") {
                        // Para Aplicación: solo OEO
                        oOperation.repartoItems = [{ key: "OEO", text: "OEO" }];
                    } else {
                        oOperation.repartoItems = [{ key: "MAN", text: "Manual" }];
                    }
                }
                // Mapear Descripcion a Post1 si Post1 no existe
                if (!oOperation.Post1 && oOperation.Descripcion) {
                    oOperation.Post1 = oOperation.Descripcion;
                }
                // Las operaciones del catálogo son operaciones existentes, no nuevas
                oOperation.isNew = false;
                // Determinar isLevel3 basándose en el PhPspnr
                oOperation.isLevel3 = oOperation.PhPspnr && oOperation.PhPspnr.split(".").length === 4;
                
                aData.splice(iInsertIndex, 0, oOperation);
                iInsertIndex++;
            }.bind(this));
            
            // Actualizar el modelo
            oModel.setData(aData);
            oModel.refresh();
            
            // Marcar como modificado
            this._markVariantDirty();
        },

        /**
         * Crea dos nuevas líneas vacías de nivel 3 (TipoInd "P" y "B") bajo la operación de nivel 2 seleccionada
         * @param {object} oParentRow - Fila padre (nivel 2)
         * @param {object} oContext - Contexto de la fila padre
         */
        _createLevel3Row: function(oParentRow, oContext) {
            var oModel = this.getView().getModel("diferidosModel");
            var sParentCode = oParentRow.PhPspnr;
            var aParentParts = sParentCode.split(".");
            
            if (aParentParts.length !== 3) {
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_FORMATO_PADRE"));
                return;
            }
            
            // Obtener la lista plana de datos del modelo
            var aData = oModel.getData();
            
            // Buscar ambos padres (TipoInd "P" y "B") con el mismo PhPspnr
            var oParentP = null;
            var oParentB = null;
            var iParentBIndex = -1;
            
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === sParentCode) {
                    if (aData[i].TipoInd === "P") {
                        oParentP = aData[i];
                    } else if (aData[i].TipoInd === "B") {
                        oParentB = aData[i];
                        iParentBIndex = i;
                    }
                }
            }
            
            if (!oParentB || iParentBIndex === -1) {
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_PADRE_NO_ENCONTRADO"));
                return;
            }
            
            // Buscar todas las operaciones hermanas existentes (mismo prefijo, nivel 3)
            var aSiblings = [];
            var sParentPrefix = sParentCode + ".";
            
            for (var i = 0; i < aData.length; i++) {
                var sCode = aData[i].PhPspnr;
                if (sCode && sCode.startsWith(sParentPrefix)) {
                    var aParts = sCode.split(".");
                    if (aParts.length === 4) {
                        var sLastPart = aParts[3];
                        var iNumber = parseInt(sLastPart, 10);
                        if (!isNaN(iNumber)) {
                            aSiblings.push(iNumber);
                        }
                    }
                }
            }
            
            // Calcular el siguiente número disponible
            var iNextNumber = 1;
            if (aSiblings.length > 0) {
                var iMaxNumber = Math.max.apply(null, aSiblings);
                iNextNumber = iMaxNumber + 1;
            }
            
            // Formatear el número con 3 dígitos
            var sNextCode = iNextNumber.toString().padStart(3, "0");
            var sNewCode = sParentCode + "." + sNextCode;
            
            // Crear la primera fila con TipoInd = "P"
            var oNewRowP = {
                PhPspnr: sNewCode,
                Post1: "",
                TipoInd: "P",
                InvEje: "0",
                Invejereal: "0",
                Invejeajus: "0",
                AmoEje: "0",
                AmoPen: "0",
                AmoTot: "0",
                Tipo: oParentP ? (oParentP.Tipo || "") : "",
                PenPlan: "",
                months: "",
                pend: "",
                _Ejecutado: "0",
                _Pendiente: "0",
                _Total: "0",
                isLevel3: true,
                isNew: true,
                ParentCode: sParentCode,
                PhPspnrEdited: false,
                Post1Edited: false,
                repartoItems: oParentP ? (oParentP.repartoItems || []) : [{ key: "O", text: "OEO" }],
                children: [],
                Totala1: "0", Totala2: "0", Totala3: "0", Totala4: "0", Totala5: "0",
                Totala6: "0", Totala7: "0", Totala8: "0", Totala9: "0", Totala10: "0",
                Resto: "0",
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0", Val05a1: "0", Val06a1: "0",
                Val07a1: "0", Val08a1: "0", Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0"
            };
            
            // Crear la segunda fila con TipoInd = "B"
            var oNewRowB = {
                PhPspnr: sNewCode,
                Post1: "",
                TipoInd: "B",
                InvEje: "0",
                Invejereal: "0",
                Invejeajus: "0",
                AmoEje: "0",
                AmoPen: "0",
                AmoTot: "0",
                Tipo: oParentB.Tipo || "",
                PenPlan: "",
                months: "",
                pend: "",
                _Ejecutado: "0",
                _Pendiente: "0",
                _Total: "0",
                isLevel3: true,
                isNew: true,
                ParentCode: sParentCode,
                PhPspnrEdited: false,
                Post1Edited: false,
                repartoItems: oParentB.repartoItems || [{ key: "MAN", text: "Manual" },{ key: "OEO", text: "OEO" }],
                children: [],
                Totala1: "0", Totala2: "0", Totala3: "0", Totala4: "0", Totala5: "0",
                Totala6: "0", Totala7: "0", Totala8: "0", Totala9: "0", Totala10: "0",
                Resto: "0",
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0", Val05a1: "0", Val06a1: "0",
                Val07a1: "0", Val08a1: "0", Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0"
            };
            
            // Buscar el índice de la última operación hermana existente
            var iLastSiblingIndex = iParentBIndex;
            
            for (var i = iParentBIndex + 1; i < aData.length; i++) {
                if (aData[i].ParentCode === sParentCode) {
                    iLastSiblingIndex = i;
                } else if (aData[i].ParentCode && aData[i].ParentCode !== sParentCode) {
                    break;
                }
            }
            
            // Insertar las dos nuevas operaciones después de la última operación hermana
            aData.splice(iLastSiblingIndex + 1, 0, oNewRowP);
            aData.splice(iLastSiblingIndex + 2, 0, oNewRowB);
            
            // Actualizar el modelo con los datos modificados
            oModel.setData(aData);
            oModel.refresh();
            
            // Mensaje de éxito
            var sMessage = this.getTranslatedText("MSG_OPERACIONES_CREADAS").replace("{0}", sNewCode);
            sap.m.MessageToast.show(sMessage);
            this._markVariantDirty();
        },
        
        _findRowIndex: function(aData, oRow, iCurrentIndex) {
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
        
        _countRows: function(aData) {
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
        onDescOperacionChange: function(oEvent){
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("diferidosModel");
            
            if (oContext) {
                var oData = oContext.getObject();
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var sPost1Value = oSource.getValue().trim();
                
                // Actualizar el valor en el modelo
                oModel.setProperty(sPath + "/Post1", sPost1Value);
                
                // Si ambos campos tienen valor y la fila es nueva, llamar al servicio
                if (sPost1Value && oData.PhPspnr && oData.isNew) {
                    // Preparar los datos para enviar al servicio
                    var aOperationToValidate = [{
                        PhPspnr: oData.PhPspnr,
                        Descripcion: sPost1Value
                    }];
                    
                    // Llamar al servicio para validar la operación
                    this._callAddIndirectosService(aOperationToValidate).then(function(response) {
                        // Verificar si hay mensajes de error
                        var aMensajes = response.NavMensajes?.results || [];
                        var aMensajesError = aMensajes.filter(function(mensaje) {
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
                            var oValidatedOp = aValidatedOperations.find(function(op) {
                                return op.PhPspnr === oData.PhPspnr && op.TipoInd === oData.TipoInd;
                            });
                            
                            if (oValidatedOp) {
                                // Actualizar el modelo con los datos validados del servicio
                                Object.keys(oValidatedOp).forEach(function(key) {
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
                    }.bind(this)).catch(function(error) {
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
        onPhPspnrChange: function(oEvent){
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("diferidosModel");
            
            if (oContext) {
                var oData = oContext.getObject();
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var sNewValue = oSource.getValue().trim();
                
                // Actualizar el valor en el modelo
                oModel.setProperty(sPath + "/PhPspnr", sNewValue);
                
                // Si ambos campos tienen valor y la fila es nueva, llamar al servicio
                if (sNewValue && oData.Post1 && oData.isNew) {
                    // Preparar los datos para enviar al servicio
                    var aOperationToValidate = [{
                        PhPspnr: sNewValue,
                        Descripcion: oData.Post1
                    }];
                    
                    // Llamar al servicio para validar la operación
                    this._callAddIndirectosService(aOperationToValidate).then(function(response) {
                        // Verificar si hay mensajes de error
                        var aMensajes = response.NavMensajes?.results || [];
                        var aMensajesError = aMensajes.filter(function(mensaje) {
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
                            var oValidatedOp = aValidatedOperations.find(function(op) {
                                return op.PhPspnr === sNewValue && op.TipoInd === oData.TipoInd;
                            });
                            
                            if (oValidatedOp) {
                                // Actualizar el modelo con los datos validados del servicio
                                Object.keys(oValidatedOp).forEach(function(key) {
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
                    }.bind(this)).catch(function(error) {
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

        _onAfterRowInputChange: async function (oContext, oSource) {
            //    Se verifica que el contexto este disponible antes de construir el payload.
            //    Si el contexto es nulo el metodo padre ya habria retornado antes de llegar aqui.
            if (!oContext) {
                return;
            }

            //    Se obtiene el objeto de datos completo de la fila desde el modelo de Diferidos.
            var oModel = this.getView().getModel(this.tableModelName);
            var sPath = oContext.getPath();
            var oRowData = oModel.getProperty(sPath);

            if (!oRowData) {
                return;
            }

            //    Se construye el payload de la fila copiando todos los campos del nodo del modelo
            //    y eliminando las propiedades internas del arbol que el backend no debe recibir.
            var oPayloadRow = {};
            Object.keys(oRowData).forEach(function (sKey) {
                if (sKey !== "children" &&
                    sKey !== "padre" &&
                    sKey !== "isEditable" &&
                    sKey !== "_linDateFrom" &&
                    sKey !== "_linDateTo") {
                    oPayloadRow[sKey] = oRowData[sKey];
                }
            });

            //    Se delega el envio al metodo centralizado del BaseController que gestiona
            //    la autenticacion, cabeceras y el endpoint /GuardarTempIndirSet.
            await this._enviarFilaAlBackend(oContext, oPayloadRow);
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
            var oModel = this.getView().getModel("diferidosModel");
            
            if (!oModel || !this._originalDiferidosData) {
                return;
            }
            
            // Crear una copia de los datos originales
            var aOriginalData = JSON.parse(JSON.stringify(this._originalDiferidosData));
            
            // Filtrar los datos según los checkboxes
            var aFilteredData = aOriginalData.filter(function(oItem) {
                if (oItem.TipoInd === "P" && !bShowInversion) {
                    return false;
                }
                if (oItem.TipoInd === "B" && !bShowAmortizacion) {
                    return false;
                }
                return true;
            });
            
            // Actualizar el modelo con los datos filtrados
            oModel.setData(aFilteredData);
            oModel.refresh();
            
            // Refrescar la tabla
            var oTable = this.byId("TreeTableDiferidos");
            if (oTable) {
                var oBinding = oTable.getBinding("rows");
                if (oBinding) {
                    oBinding.refresh();
                }
            }
            
            // Refrescar los colores de las filas
            // Se pasa !bShowInversion: true cuando la inversión (P) está oculta,
            // lo que indica que las filas de provisión (TipoInd="B") no deben colorearse
            setTimeout(function() {
                this.colorRows(!bShowInversion);
            }.bind(this), 100);
        },

        /**
         * Handler del botón "+" en la columna PhPspnr para crear filas de desglose.
         * Adaptado de Anticipados: aplica a TipoInd="P" (Provisión).
         */
        onAddDesglosePress: function(oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("diferidosModel");
            if (!oContext) return;

            var oData = oContext.getObject();
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();

            // Solo para Provisión (filas con TipoInd="P", no nuevas)
            if (oData.TipoInd !== "P") {
                return;
            }

            var aChildren = oData.children ? oData.children.slice() : [];

            var sLabelAgrup    = this.getTranslatedText("agrupador")        || "Agrupador";
            var sLabelDescrip  = this.getTranslatedText("DESCRIPCION")      || "Descripción";
            var sLabelProv     = this.getTranslatedText("proveedor")        || "Proveedor";
            var sLabelEje      = this.getTranslatedText("ejecutado")        || "Ejecutado";
            var sLabelPend     = this.getTranslatedText("pendiente")        || "Pendiente";
            var sLabelTot      = this.getTranslatedText("total")            || "Total";
            var sLabelReparto  = this.getTranslatedText("dbReparto")        || "Reparto";
            var sLabelPenPlan  = this.getTranslatedText("dbPendPlanificar") || "Pend. planificar";
            var sLabelPctj     = this.getTranslatedText("porcpend")         || "% Pend. Amo.";
            var sLabelResto    = this.getTranslatedText("restoProv")        || "Resto de proveedores";

            var bHasHeader = aChildren.some(function(c) { return c.__isHeader === true; });

            if (!bHasHeader) {
                var oHeaderRow = {
                    __isCustom: true,
                    __isHeader: true,
                    __isEditable: false,
                    __isSinProveedor: false,
                    _headerAgrup:   sLabelAgrup,
                    _headerDescr:   sLabelDescrip,
                    _headerProv:    sLabelProv,
                    _headerEje:     sLabelEje,
                    _headerPend:    sLabelPend,
                    _headerTot:     sLabelTot,
                    _headerReparto: sLabelReparto,
                    _headerPenPlan: sLabelPenPlan,
                    _headerPctj:    sLabelPctj,
                    AGRUP: "", Post1: "", DESCRIP: "", LIFNR: "",
                    INVEJE: "0", INVPEN: "0", INVTOT: "0", PENPLAN: "0", PCTJ: "0",
                    Tipo: sLabelReparto, PenPlan: sLabelPenPlan,
                    _Ejecutado: "0", _Pendiente: "0", _Total: "0",
                    children: []
                };
                aChildren.unshift(oHeaderRow);
            }

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
                PCTJ:   "0",
                TIPO:   "MAN",
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0",
                Val05a1: "0", Val06a1: "0", Val07a1: "0", Val08a1: "0",
                Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0",
                Totala1: "0",
                children: []
            };

            var iSinProveedorIdx = aChildren.findIndex(function(c) { return c.__isSinProveedor === true; });
            if (iSinProveedorIdx !== -1) {
                aChildren.splice(iSinProveedorIdx, 0, oNewDesglose);
            } else {
                aChildren.push(oNewDesglose);
                var oResto = {
                    __isCustom: true,
                    __isEditable: false,
                    __isSinProveedor: true,
                    __isHeader: false,
                    AGRUP:  "",
                    Post1:  sLabelResto,
                    LIFNR:  "",
                    _headerProv: "",
                    //   onAddDesglosePress solo corre para filas TipoInd="P" (Aplicacion),
                    // que ahora muestran los campos Inv* (igual que _addComputedFields y
                    // onAmoPenChange/onAmoTotChange tras revertir la inversion). La fila
                    // "Resto de proveedores" se alimenta del Inv* del padre P para ser
                    // coherente con el importe que muestra la operacion.
                    INVEJE: oData.InvEje || "0",
                    INVPEN: oData.InvPen || "0",
                    INVTOT: oData.InvTot || "0",
                    PENPLAN: "0",
                    PCTJ: "0",
                    TIPO:   "MAN",
                    Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0",
                    Val05a1: "0", Val06a1: "0", Val07a1: "0", Val08a1: "0",
                    Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0",
                    Totala1: "0",
                    children: []
                };
                aChildren.push(oResto);
            }

            oModel.setProperty(sPath + "/children", aChildren);
            oModel.refresh(true);

            var oTable = this.byId("TreeTableDiferidos");
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
         * Handler para cambio de campo AGRUP en filas de desglose de provisión.
         */
        onDesglosAGRUPChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("diferidosModel");
            if (oContext) {
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                oModel.setProperty(sPath + "/AGRUP", oSource.getValue());
                this._markVariantDirty();
            }
        },

        /**
         * Handler para cambio del campo Proveedor (LIFNR) en filas de desglose.
         */
        onDesgloseProveedorChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("diferidosModel");
            if (!oContext) return;

            var sNewLifnr = oSource.getValue().trim();
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();

            if (!sNewLifnr) {
                oModel.setProperty(sPath + "/LIFNR", "");
                return;
            }

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

        /**
         * Handler para cambio de INVPEN en fila de desglose.
         */
        onDesgloseInvPenChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("diferidosModel");
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
            var fExpectedTot = fPen + fEje;

            oModel.setProperty(sPath + "/INVPEN", fPen.toString());
            oModel.setProperty(sPath + "/INVTOT", fExpectedTot.toString());
            this._markVariantDirty();
        },

        /**
         * Handler para cambio de INVTOT en fila de desglose.
         */
        onDesgloseInvTotChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("diferidosModel");
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
            var fPen = fTot - fEje;

            oModel.setProperty(sPath + "/INVTOT", fTot.toString());
            oModel.setProperty(sPath + "/INVPEN", fPen.toString());
            this._markVariantDirty();
        },
         _getStaticExportColumns: function () {
            //    Se traducen via i18n las cabeceras del export XLSX.  
            return [
                { header: this.getTranslatedText("oper"), path: "PhPspnr" },
                { header: this.getTranslatedText("DESCRIPCION"), path: "Post1" },
                { header: this.getTranslatedText("type"), path: "TipoInd" },
                { header: this.getTranslatedText("costEje"), path: "_Ejecutado" },
                { header: this.getTranslatedText("costPend"), path: "_Pendiente" },
                { header: this.getTranslatedText("pendiente%"), path: "PctjPenAmo" },
                { header: this.getTranslatedText("costTotal"), path: "_Total" },
                { header: this.getTranslatedText("dbReparto"), path: "Tipo" },
                { header: this.getTranslatedText("dbPendPlanificar"), path: "PenPlan" }
            ];
            //   
        },

        /*   */
        /**
         *     Columnas estáticas de Diferidos para la Plantilla de carga (apartado 5.9 del spec).
         *   Estructura solicitada por el usuario: 8 columnas — incluye "% Pendiente" (PctjPenAmo)
         *   específico de Diferidos. NO incluye Fecha Inicio/Fin (no figura en el spec del usuario
         *   para este capítulo).
         */
        _getPlantillaStaticColumns: function () {
            //    Se traducen via i18n las cabeceras de la plantilla.  
            return [
                { header: this.getTranslatedText("colOperacionAgrupador"), path: "PhPspnr" },
                { header: this.getTranslatedText("DESCRIPCION"), path: "Post1" },
                { header: this.getTranslatedText("colTipoProveedor"), path: "TipoInd" },
                { header: this.getTranslatedText("ejecutado"), path: "_Ejecutado" },
                { header: this.getTranslatedText("pendiente") + "*", path: "_Pendiente" },
                { header: this.getTranslatedText("pendiente%"), path: "PctjPenAmo" },
                { header: this.getTranslatedText("total"), path: "_Total" },
                { header: this.getTranslatedText("dbReparto"), path: "Tipo" }
            ];
            //   
        },

    });
});
