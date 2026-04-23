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

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Anticipados", {

        formatter: formatter,

        /**
         * Inicializa la vista de Diferidos definiendo el estado de navegación y visibilidad.
         * Configura la tabla principal y prepara las columnas anuales iniciales.
         */
        getCustomTableId: function () {
            return "TreeTableAnticipados";
        },

        onInit: function () {

            this.setInitData();
        },
        /**
                 *  La función ejecuta la inicialización de la vista de Anticipados.
                 * El sistema guarda un "snapshot" del layout estándar para restaurarlo manualmente.
                 */
        setInitData: async function () {
            this.initVariantConfig({
                tableId: "TreeTableAnticipados",
                modelName: "anticipadosModel",
                storageKey: "anticipados_variants"
            });

            this._initVariantManagement();

            this._initYearsModel();
            // Se delega la inicialización al método asíncrono para garantizar
            // que las columnas dinámicas se crean siempre después de las estáticas.
            //this.initAnticipadosModel(this._previousTabKey);

            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");
            this.setupDynamicTreeTable("TreeTableAnticipados");

            //  Se crean las columnas dinámicas utilizando el rango Freal → Frealfinobra,
            //  evitando el uso de años fijos basados en la fecha actual.
            this.createDynamicYearColumns("TreeTableAnticipados");





            this._boundResizeHandler = function () {
                this._calculateDynamicRows();
            }.bind(this);
            $(window).on("resize", this._boundResizeHandler);

            this._boundBrowserClose = this.onBrowserClose.bind(this);
            window.addEventListener("beforeunload", this._boundBrowserClose);




            var oTable = this.byId("TreeTableAnticipados");
            if (oTable) {
                oTable.addEventDelegate({
                    onAfterRendering: function () {
                        if (this._bAnticipadosFirstRender) return;
                        this._bAnticipadosFirstRender = true;

                        //  El sistema crea las columnas dinámicas.
                        //  this.createYearColumns(new Date().getFullYear(), 3, "TreeTableAnticipados");
                        this._attachHeaderToggleListener();


                        //  El sistema captura el estado base (Standard) de las columnas.
                        //  Se guarda el ID, visibilidad y ancho para poder "limpiar" cambios de otras variantes.
                        this._aStandardLayout = oTable.getColumns().map(function (oCol) {
                            return {
                                col: oCol,
                                visible: oCol.getVisible(),
                                width: oCol.getWidth()
                            };
                        });

                        var oVModel = this.getView().getModel("variantModel");
                        if (oVModel && this._aVariants) {
                            var sCurrentName = oVModel.getProperty("/currentName");

                            var oCurrentVariant = this._aVariants.find(function (v) {
                                return v.name === sCurrentName;
                            });

                            //  Si es Standard, se fuerza la limpieza de cualquier residuo de otras variantes.
                            if (!oCurrentVariant || sCurrentName === "Standard") {
                                this._applyStandardReset();
                            } else if (oCurrentVariant.state) {
                                this._bSuppressDirtyFlag = true;
                                this._applyVariantState(oCurrentVariant.state);
                                this._bSuppressDirtyFlag = false;
                            }
                            this._bVariantAppliedByDelegate = true;
                        }
                    }.bind(this)
                });
            }
        },
        onAfterRendering: function (oEvent) {
            let table = this.byId("TreeTableAnticipados")
            table.attachEvent("rowsUpdated", this.colorRows.bind(this));
            table.attachEvent("firstVisibleRowChanged", this.colorRows.bind(this));
        },

        /**
         *  La función elimina cualquier modificación de layout o datos y restaura el estado base.
         *  El sistema recorre el snapshot guardado para asegurar que la tabla vuelva al diseño original.
         */
        _applyStandardReset: function () {
            var oTable = this.byId("TreeTableAnticipados");
            var oModel = this.getView().getModel("anticipadosModel");

            if (!oTable || !this._aStandardLayout) return;

            this._bSuppressDirtyFlag = true;

            // El sistema restaura las propiedades físicas de las columnas desde el snapshot.
            this._aStandardLayout.forEach(function (oItem) {
                oItem.col.setVisible(oItem.visible);
                oItem.col.setWidth(oItem.width);
            });

            //  El sistema limpia los datos editados cargando de nuevo la copia del servidor original.
            if (this._originalServerData && oModel) {
                oModel.setData(JSON.parse(JSON.stringify(this._originalServerData)));
            }

            this._bSuppressDirtyFlag = false;

            // El sistema asegura que el flag de modificación (dirty) esté desactivado para Standard.
            if (this.getView().getModel("variantModel")) {
                this.getView().getModel("variantModel").setProperty("/isDirty", false);
            }
        },

        _createSnapshot: function () {
            var oDefaultModel = this.getView().getModel("anticipadosModel");
            if (oDefaultModel) {
                var oData = oDefaultModel.getData();
                this._originalData = JSON.parse(JSON.stringify(oData));
            }
        },

        /**
         *  La función restaura la tabla al estado base guardado durante la inicialización.
         * El sistema limpia los cambios de usuario y restablece los valores originales del servidor.
         */
        _restoreStandardState: function () {
            var oTable = this.byId("TreeTableAnticipados");
            var oModel = this.getView().getModel("anticipadosModel");

            if (!oTable || !this._aStandardColumnLayout) return;

            this._bSuppressDirtyFlag = true;

            //  El sistema restablece la configuración física de cada columna guardada en el layout base.
            this._aStandardColumnLayout.forEach(function (oConfig) {
                var oCol = sap.ui.getCore().byId(oConfig.id);
                if (oCol) {
                    oCol.setVisible(oConfig.visible);
                    oCol.setWidth(oConfig.width);
                }
            });

            // 
            //El sistema recarga la copia profunda de los datos originales del servidor.
            if (this._originalServerData && oModel) {
                oModel.setData(JSON.parse(JSON.stringify(this._originalServerData)));
            }

            this._bSuppressDirtyFlag = false;
        },

        /**
         * Se inicializa el modelo de datos de la pestaña Anticipados realizando
         * una petición POST al servicio OData y construyendo la estructura jerárquica.
         *  Se convierte en async/await y se elimina la definición duplicada.
         * El bloque de aplicación de delta se mantiene aquí ya que los datos del
         * modelo deben estar actualizados antes de que el delegate aplique la variante.
         */
        initAnticipadosModel: async function (sPreviousKey) {
            var oAppData = this.getGlobalModel("appData").getData();
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            var sFreal = oAppData.Freal || (oAppData.tramo && oAppData.tramo.Freal) || "";
            var oDashModel = this.getGlobalModel("dashboardModel")
            var sFreal = "";

            var versiones = this.getGlobalModel("appData").getData().NavLtVersiones;
            // Se busca e identifica el objeto correspondiente a la versión que se encuentra actualmente marcada como activa ("X").
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                // Se recurre al dashboardModel únicamente si appData no contiene Freal.
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }
            if (!sFreal) {

                setTimeout(function () {
                    this.initAnticipadosModel(sPreviousKey);
                }.bind(this), 500);
                return;
            }
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
                var response = await this.post(
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
                            bloqueado: !!sPreviousKey ? sPreviousKey : "",
                            decimales: this.getGlobalModel("dashboardModel").getData().decimales,
                            ejercicio: sEjercicio,
                            pestana: "Anticipados",
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
                            messages: aMensajesError
                        });
                    }
                var tree = this.buildTree(response.NavDatosIndirectos.results);
                var oNewModel = new sap.ui.model.json.JSONModel(tree);
                this.getView().setModel(oNewModel, "anticipadosModel");
                this._createSnapshot();
                setTimeout(function () {
                    this.colorRows();
                }.bind(this), 500);
                oNewModel.attachPropertyChange(function () {
                    this._markVariantDirty();
                }.bind(this));

                // Se aplica el delta de celdas editadas de la variante activa
                // sobre el modelo recién cargado, antes de que el delegate de
                // afterRendering aplique el estado completo de columnas y expansiones.
                var oVModel = this.getView().getModel("variantModel");
                if (oVModel && this._aVariants) {
                    var sCurrentName = oVModel.getProperty("/currentName");
                    var oCurrentVariant = this._aVariants.find(function (v) {
                        return v.name === sCurrentName;
                    });
                    if (oCurrentVariant && oCurrentVariant.state &&
                        Array.isArray(oCurrentVariant.state.modelDelta) &&
                        oCurrentVariant.state.modelDelta.length > 0) {
                        this._bSuppressDirtyFlag = true;
                        this._applyModelDelta(oCurrentVariant.state.modelDelta);
                        this._bSuppressDirtyFlag = false;
                    }
                }

            } catch (e) {
                // Se captura el error para que setInitData pueda continuar.
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
            }.bind(this), 0);
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
                    repartoItems = [
                        { key: "O", text: "OEO" }
                    ];
                } else {
                    repartoItems = [
                        { key: "M", text: "Manual" }
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
        _attachHeaderToggleListener: function () {
            var oObjectPageLayout = this.byId("objectPageAnticipados");
            if (!oObjectPageLayout) return;

            setTimeout(function () {
                var oDom = oObjectPageLayout.getDomRef();
                if (!oDom) return;

                oDom.addEventListener("click", function () {
                    setTimeout(function () {
                        this._calculateDynamicRows();
                    }.bind(this), 200);
                }.bind(this), true);

            }.bind(this), 1000);
        },
        colorRows: function () {
            var oTable = this.byId("TreeTableAnticipados");
            var aRows = oTable.getRows();
            var sTableId = oTable.getId();

            aRows.forEach(function (oRow, i) {
                var oContext = oRow.getBindingContext("anticipadosModel") 
            || (oRow.oBindingContexts && oRow.oBindingContexts["anticipadosModel"]);


                var oFixedRef = oTable.$().find(".sapUiTableCtrlFixed tbody tr[data-sap-ui-rowindex='" + i + "']");
                var oScrollRef = oTable.$().find(".sapUiTableCtrlScroll tbody tr[data-sap-ui-rowindex='" + i + "']");
                var oRowSelRef = jQuery("#" + sTableId + "-rowsel" + i);

                oFixedRef.removeClass("rowVersionB rowVersionP");
                oScrollRef.removeClass("rowVersionB rowVersionP");
                oRowSelRef.removeClass("rowVersionB rowVersionP");

                if (!oContext) return;

                var sTipoInd = oContext.getProperty("TipoInd");
                var sParentPath = oContext.getProperty("ParentPath");

                if (sTipoInd === "I") {
                    oFixedRef.addClass("rowVersionP");
                    oScrollRef.addClass("rowVersionP");
                    oRowSelRef.addClass("rowVersionP");
                } else if (sTipoInd === "A") {
                    oFixedRef.addClass("rowVersionB");
                    oScrollRef.addClass("rowVersionB");
                    oRowSelRef.addClass("rowVersionB");


                }
            });
        },

        onAmoPenChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");

            if (oContext) {
                // Leer el valor directamente del input
                var sRawValue = oSource.getValue();

                // Limpiar formato (quitar separadores de miles, convertir decimal)
                var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
                var sCurrencyFormat = oAppData.CurrencyFormat;
                var sThousandSep = sCurrencyFormat.charAt(0);
                var sDecimalSep = sCurrencyFormat.charAt(1);

                sRawValue = sRawValue.split(sThousandSep).join("");
                sRawValue = sRawValue.split(sDecimalSep).join(".");

                var fAmoPen = parseFloat(sRawValue) || 0;

                // Escribir el valor limpio de vuelta al modelo
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                oModel.setProperty(sPath + "/AmoPen", fAmoPen.toString());

                // Ahora leer AmoEje del modelo y calcular AmoTot
                var fAmoEje = parseFloat(oContext.getObject().AmoEje) || 0;
                var fAmoTot = fAmoPen + fAmoEje;

                oModel.setProperty(sPath + "/AmoTot", fAmoTot.toString());
                this.onRowInputChange(oEvent);
            }
        },
        /**
         * Se ejecuta antes de cerrar el navegador para advertir sobre cambios no guardados
         */
        onBrowserClose: function (oEvent) {
            if (this.hasUnsavedChanges()) {

                oEvent.preventDefault();
                oEvent.returnValue = '';
                return '';
            }
        },
        /**
         * Limpia los event listeners al destruir el controlador
         */
        onExit: function () {
            //  Se resetea la bandera para que la siguiente navegación a esta
            // vista reinicialice las columnas correctamente desde cero.
            this._bAnticipadosFirstRender = false;
            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },
    });
});