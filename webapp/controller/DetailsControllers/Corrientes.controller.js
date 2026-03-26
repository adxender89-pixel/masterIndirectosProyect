sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "masterindirectos/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "masterindirectos/model/formatter"
], function (
    JSONModel,
    Column,
    Input,
    Button,
    Label,
    BaseController,
    Filter,
    FilterOperator,
    Fragment,
    formatter
) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Corrientes", {

        formatter: formatter,
        /**
         * Se obtiene el identificador de la tabla personalizada correspondiente a esta vista.
         */
        getCustomTableId: function () {
            return "TreeTableBasic";
        },

            /**
         * Se inicializa la vista de Corrientes, definiendo el estado de navegación y visibilidad.
         * Se configura la tabla principal y se preparan las columnas anuales iniciales.
         */
        onInit: async function () {


            await this.initCorrienteModel();  // <-- aquí se guarda this._sFrealfinobra
            this._initYearsModel();           // <-- se construye el rango de años
            this.tableModelName = "corrientesModel";
            this.firstTime = true;

            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            this.setupDynamicTreeTable("TreeTableBasic");

            this._initVariantManagement("masterindirectos_corrientes_variants");

            setTimeout(function () {
                const oTableForVariant = this.byId("TreeTableBasic");
                if (oTableForVariant) {
                    const oCorrientesModel = oTableForVariant.getModel("corrientesModel");
                    if (oCorrientesModel) {
                        oCorrientesModel.attachPropertyChange(function () {
                            this._markVariantDirty();
                        }.bind(this));
                    }
                }
            }.bind(this), 600);

            const oModel = this.getView().getModel();
            if (oModel) {
                this._editBackupData = JSON.parse(JSON.stringify(oModel.getData()));
            }

            const oTable = this.byId("TreeTableBasic");

            oTable.addEventDelegate({
                onAfterRendering: function () {
                    const oTableDom = oTable.getDomRef();
                    if (!oTableDom) return;

                    const oCtxDebug = oTable.getContextByIndex(4);
                    if (oCtxDebug) {
                        const oObj = oCtxDebug.getObject();
                        console.log("[DEBUG] Row 4 - isEditable:", oObj.isEditable, "| Estructura:", oObj.Estructura, "| PhPspnr:", oObj.PhPspnr);
                    } else {
                        console.log("[DEBUG] Row 4 - context non disponibile");
                    }

                    const $table = $(oTableDom);

                    $table.off("contextmenu").on("contextmenu", function (oNativeEvent) {
                        oNativeEvent.preventDefault();

                        const $target = $(oNativeEvent.target);
                        const oTargetControl = $target.control(0);
                        const iRowIndex = $target.closest(".sapUiTableTr").index();
                        const oRowContext = oTable.getContextByIndex(oTable.getFirstVisibleRow() + iRowIndex);

                        if (oRowContext) {
                            const oRowData = oRowContext.getObject();

                            if (!oRowData || oRowData.padre !== true) {
                                return;
                            }

                            const oBindingInfo = oTargetControl && oTargetControl.getBindingInfo ? oTargetControl.getBindingInfo("value") : null;
                            const sBindingPath = oBindingInfo && oBindingInfo.parts && oBindingInfo.parts[0] ? oBindingInfo.parts[0].path : null;

                            if (sBindingPath !== "PhPspnr" && sBindingPath !== "name") {
                                return;
                            }

                            this.onContextMenu({
                                rowBindingContext: oRowContext,
                                cellControl: oTargetControl || oTable
                            });
                        }
                    }.bind(this));

                    $table.off("keydown", "input").on("keydown", "input", function (oNativeEvent) {
                        const iKeyCode = oNativeEvent.keyCode;
                        if (iKeyCode < 37 || iKeyCode > 40) return;

                        const sControlId = oNativeEvent.target.id.replace("-inner", "");
                        const oInput = sap.ui.getCore().byId(sControlId);

                        if (oInput && oInput.isA("sap.m.Input")) {
                            this._onInputKeyDown({
                                srcControl: oInput,
                                keyCode: iKeyCode,
                                preventDefault: function () { oNativeEvent.preventDefault(); },
                                stopImmediatePropagation: function () { oNativeEvent.stopImmediatePropagation(); }
                            });
                        }
                    }.bind(this));

                    if (this.firstTime) {
                        this.firstTime = false;

                        const sFreal = this.getView().getModel("dashboardModel").getProperty("/NavMasterLt/0/Freal");
                        const sFrealsist = this.getView().getModel("dashboardModel").getProperty("/NavMasterLt/0/Frealsist");

                        const oDateFreal = new Date(sFreal);
                        const oDateFrealsist = new Date(sFrealsist);
                        const bSameDay = oDateFreal.getDate() === oDateFrealsist.getDate();

                        let iYear;
                        if (bSameDay) {
                            this._effectiveDate = oDateFreal;
                            iYear = oDateFreal.getFullYear();
                        } else {
                            const oDatePlusOne = new Date(oDateFreal);
                            oDatePlusOne.setDate(oDatePlusOne.getDate() + 1);
                            this._effectiveDate = oDatePlusOne;
                            iYear = oDatePlusOne.getFullYear();
                        }

                        // Se calcula el número de columnas anuales necesarias a partir del rango completo
                        // guardado en _initYearsModel, en lugar de usar un valor fijo de 2 años adicionales.
                        var iYearEnd = this._iYearEnd || (iYear + 2);
                        var iExtraYears = Math.max(0, iYearEnd - iYear + 1);

                        console.log("[firstTime] Creando columnas de " + iYear + " a " + iYearEnd + " (" + iExtraYears + " extras)");

                        this.createYearColumns(iYear, iExtraYears, "TreeTableBasic", this.getView().getModel("corrientesModel"));

                        setTimeout(function () {
                            const oTableInst = this.byId("TreeTableBasic");
                            if (!oTableInst) return;

                            // Se ocultan todas las columnas dinámicas excepto las dos primeras
                            // nada más crearlas, antes de que la tabla se renderice completamente.
                            this._showYearColumns(iYear);

                            const oPrimerAnioCol = oTableInst.getColumns().find(function (c) {
                                return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
                            });

                            if (oPrimerAnioCol) {
                                const sSubFijo = oPrimerAnioCol.data("subFijoYear");
                                const sYearVal = oPrimerAnioCol.data("year");

                                this.onCreateMonthsTable({
                                    getSource: function () {
                                        return {
                                            getMetadata: function () {
                                                return { getName: function () { return "sap.m.Button"; } };
                                            },
                                            getText: function () { return String(sYearVal); },
                                            data: function (sKey) {
                                                if (sKey === "subFijoYear") return sSubFijo;
                                                if (sKey === "year") return String(sYearVal);
                                                return null;
                                            }
                                        };
                                    }
                                });
                            }
                        }.bind(this), 150);
                    }

                    this._attachHeaderToggleListener();
                }.bind(this)
            });


            this._boundResizeHandler = function () {
                this._calculateDynamicRows();
            }.bind(this);
            $(window).on("resize", this._boundResizeHandler);

            this._boundBrowserClose = this.onBrowserClose.bind(this);
            window.addEventListener("beforeunload", this._boundBrowserClose);
        },

        /**
         * Se escucha el evento de expansión o colapso de la cabecera principal
         * para recalcular las filas de la tabla dinámicamente.
         */
        _attachHeaderToggleListener: function () {
            const oObjectPageLayout = this.byId("objectPageLayout");
            if (!oObjectPageLayout) return;

            setTimeout(function () {
                const oDom = oObjectPageLayout.getDomRef();
                if (!oDom) return;

                oDom.addEventListener("click", function () {
                    setTimeout(function () {
                        this._calculateDynamicRows();
                    }.bind(this), 200);
                }.bind(this), true);

            }.bind(this), 1000);
        },

        /**
         * Se crean masivamente nuevos registros en el catálogo.
         * Permite la creación tanto a nivel de raíz como dentro de agrupadores.
         */
        onAddPress: function (oEvent) {
            const oTable = this.byId("TreeTableBasic");
            const oModel = this.getView().getModel("corrientesModel");
            const oBundle = this.getView().getModel("i18n").getResourceBundle();

            // Se obtiene la cantidad solicitada desde el campo de cantidad de elementos.
            let iQuantity = 1;
            const oInput = this.byId("itemQuantityInput");
            if (oInput) {
                iQuantity = parseInt(oInput.getValue()) || 1;
                oInput.setValue(1);
            }

            // Se determina el contexto del padre donde se insertarán los nuevos hijos.
            let oContext = this._oContextRecord || oTable.getContextByIndex(oTable.getSelectedIndex());

            if (!oContext) {
                sap.m.MessageToast.show("Seleccione un nivel padre primero");
                return;
            }

            const oParentData = oContext.getObject();
            const iCurrentYear = new Date().getFullYear();

            // Se valida que el nodo padre tenga la propiedad 'children' inicializada.
            if (!oParentData.children) {
                oParentData.children = [];
            }

            // Se ejecuta el bucle para crear la cantidad de filas solicitadas.
            for (let k = 0; k < iQuantity; k++) {
                const oNew = {
                    PhPspnr: oParentData.PhPspnr,
                    name: oParentData.padre === true ? oParentData.name + "." : "",
                    ParentPath: oParentData.PhPspnr,
                    padre: false,
                    isGroup: false,
                    isNew: true,
                    children: [],
                    flag1: false,
                    flag2: false,
                    amount: "",
                    currency: oParentData.currency || "",
                    monthsData: {}
                };

                this._fillMonths(oNew, iCurrentYear);

                // Se inserta el nuevo nodo al final de los hijos del nodo seleccionado.
                oParentData.children.push(oNew);
            }

            // Se refresca el modelo para propagar los cambios a la vista.
            oModel.refresh(true);

            // Se expande el nodo padre para que el usuario vea las nuevas filas al final.
            const sPath = oContext.getPath();
            setTimeout(function () {
                const oBinding = oTable.getBinding("rows");
                const iIndex = this._findIndexByPath(oTable, sPath);
                if (iIndex !== -1) {
                    oTable.expand(iIndex);
                }
            }.bind(this), 150);

            // Se cierra el menú contextual y se limpia el registro de contexto activo.
            this.onCloseContextMenu();
            this._oContextRecord = null;

            sap.m.MessageToast.show(oBundle.getText("msgItemsAdded", [iQuantity]));
        },

        /**
         * Se busca el índice visual de una fila por su ruta de enlace de datos.
         */
        _findIndexByPath: function (oTable, sPath) {
            const oBinding = oTable.getBinding("rows");
            const aContexts = oBinding.getContexts(0, oBinding.getLength());
            for (let i = 0; i < aContexts.length; i++) {
                if (aContexts[i].getPath() === sPath) {
                    return i;
                }
            }
            return -1;
        },

        /**
         * Se inicializan las propiedades mensuales y anuales por defecto para un nuevo elemento.
         */
        _fillMonths: function (oItem, iYearStart) {
            oItem.monthsData = {};

            for (let i = 0; i < 3; i++) {
                const iYear = iYearStart + i;
                oItem["y" + iYear] = "";

                for (let m = 1; m <= 12; m++) {
                    const sMonthKey = "m" + iYear + "_" + (m < 10 ? "0" + m : m);
                    oItem.monthsData[sMonthKey] = "";
                }
            }
        },

        /**
         * Se fuerza el renderizado y cálculo de elementos una vez que la vista está disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            this._attachHeaderToggleListener();
        },

        /**
         * Se gestiona la visibilidad de las columnas extendidas (meses, checkboxes)
         * al expandir o contraer nodos en la TreeTable.
         * Se marca además la variante activa como modificada al cambiar el estado del árbol.
         */
        onToggleOpenState: function (oEvent) {
            const oTable = oEvent.getSource();
            const sTableId = oTable.getId();
            const bExpanded = oEvent.getParameter("expanded");
            const iRowIndex = oEvent.getParameter("rowIndex");
            const oUiModel = this.getView().getModel("ui");

            // Se marca la variante activa como modificada al expandir o contraer un nodo.
            this._markVariantDirty();

            const oColMonths = this.byId("colMonths");
            const oColNew = this.byId("colNew");
            const oColCheck1 = this.byId("colCheckBox1");
            const oColCheck2 = this.byId("colCheckBox2");

            const oContext = oTable.getContextByIndex(iRowIndex);
            const sPath = oContext && oContext.getPath();
            const oObject = oContext && oContext.getObject();

            const iLevel = sPath ? (sPath.match(/\/categories/g) || []).length : 0;

            /* Se procesa la expansión del nodo. */
            if (bExpanded) {
                const bIsDetailLevel =
                    iLevel >= 2 &&
                    oObject &&
                    oObject.categories &&
                    oObject.categories.length > 0 &&
                    oObject.categories[0].isGroup === true;

                if (oColMonths) oColMonths.setVisible(bIsDetailLevel);
                if (oColNew) oColNew.setVisible(bIsDetailLevel);
                if (oColCheck1) oColCheck1.setVisible(bIsDetailLevel);
                if (oColCheck2) oColCheck2.setVisible(bIsDetailLevel);

                if (bIsDetailLevel && sPath) {
                    this._sLastExpandedPath = sPath;
                }
            }
            /* Se procesa el colapso del nodo. */
            else {
                if (this._sLastExpandedPath === sPath) {
                    this._sLastExpandedPath = null;
                }

                let bAnyDetailExpanded = false;
                const oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    const iLength = oBinding.getLength();

                    for (let i = 0; i < iLength; i++) {
                        if (oTable.isExpanded(i)) {
                            const oCtx = oTable.getContextByIndex(i);
                            const oObj = oCtx && oCtx.getObject();
                            const sCtxPath = oCtx ? oCtx.getPath() : "";
                            const iCtxLevel = (sCtxPath.match(/\/categories/g) || []).length;

                            if (
                                iCtxLevel >= 2 &&
                                oObj &&
                                oObj.categories &&
                                oObj.categories[0] &&
                                oObj.categories[0].isGroup === true
                            ) {
                                bAnyDetailExpanded = true;
                                break;
                            }
                        }
                    }
                }

                /* Se reinicia la interfaz de usuario si no queda ningún detalle abierto. */
                if (!bAnyDetailExpanded) {
                    if (oColMonths) oColMonths.setVisible(false);
                    if (oColNew) oColNew.setVisible(false);
                    if (oColCheck1) oColCheck1.setVisible(false);
                    if (oColCheck2) oColCheck2.setVisible(false);

                    this._aGroupRanges = [];
                    oUiModel.setProperty("/showStickyAgrupador", false);
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }
            }

            setTimeout(function () {
                this._refreshAfterToggle(sTableId);
            }.bind(this));
        },

        /**
         * Se gestiona el evento de cierre del navegador para advertir sobre posibles cambios sin guardar.
         */
        onBrowserClose: function (oEvent) {
            if (this.hasUnsavedChanges()) {
                oEvent.preventDefault();
                oEvent.returnValue = '';
                return '';
            }
        },

        /**
         * Se limpian los escuchadores de eventos activos al destruir el controlador de la vista.
         */
        onExit: function () {
            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },

        /**
         * Se inicializa el modelo de datos realizando una petición al servidor OData.
         */
        initCorrienteModel: async function (evt) {
            const sCurrentYear = new Date().getFullYear().toString();

            await this.post(
                this.getGlobalModel("mainService"),
                "/CambioPestIndirectosSet",
                {
                    "NavSelProyecto": [this.getGlobalModel("appData").getData().tramo],
                    "NavChanges": [],
                    "NavDatosIndirectos": [],
                    "EvBloqueados": "",
                    "NavMensajes": []
                },
                {
                    headers: {
                        ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                        lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                        bloqueado: "",
                        decimales: "02",
                        ejercicio: sCurrentYear,
                        pestana: "Corrientes"
                    }
                }
            ).then(function (response) {

                console.log("[initCorrienteModel] response completa:", JSON.stringify(response));

                // Se guarda la fecha de fin de obra para usarla en el select de años.
                const aNavLsObra = response.NavLsObra && response.NavLsObra.results;
                if (aNavLsObra && aNavLsObra.length > 0) {
                    this._sFrealfinobra = aNavLsObra[0].Frealfinobra;
                    console.log("[initCorrienteModel] Frealfinobra guardado:", this._sFrealfinobra);
                }

                response.NavDatosIndirectos.results.forEach(function (item) {
                    if (item.PhPspnr === "I.003.001") {
                        item.Estructura = "o";
                    }
                });

                const tree = this.buildTree(response.NavDatosIndirectos.results);
                this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "corrientesModel");

            }.bind(this));
        },

        /**
         * Se procesan los datos lineales obtenidos del servicio y se transforman en una estructura de árbol.
         * Se guarda además una copia profunda de los datos originales del servidor para poder calcular
         * el delta de cambios al guardar una variante sin necesidad de almacenar el modelo completo.
         */
        buildTree: function (data) {
            const map = {};
            data.forEach(item => {
                map[item.PhPspnr] = {
                    ...item,
                    children: [],
                    isEditable: item.Estructura === "o"
                };
            });

            const roots = [];

            data.forEach(item => {
                if (item.ParentPath === "I") {
                    map[item.PhPspnr].padre = true;
                    if (!roots.some(root => root.PhPspnr === item.PhPspnr)) {
                        roots.push(map[item.PhPspnr]);
                    }
                } else {
                    const parent = map[item.ParentPath];
                    if (parent) {
                        map[item.PhPspnr].padre = false;
                        parent.children.push(map[item.PhPspnr]);
                    }
                }
            });

            this._originalServerData = JSON.parse(JSON.stringify(roots));
            return roots;
        },
            /**
         * Se parsea una fecha en formato OData (/Date(ms)/) y se devuelve un objeto Date.
         * Se contempla también el caso en que la fecha ya sea un objeto Date o un string ISO.
         */
        _parseODataDate: function (sODataDate) {
            if (!sODataDate) return null;
            var oMatch = /\/Date\((\d+)\)\//.exec(sODataDate);
            if (oMatch) {
                return new Date(parseInt(oMatch[1], 10));
            }
            return new Date(sODataDate);
        },
           /**
         * Se inicializa el modelo de años disponibles para el selector de ejercicio,
         * calculando el rango desde el año de Freal hasta el año de Frealfinobra, ambos inclusive.
         * Se leen ambas fechas directamente desde el modelo global dashboardModel.
         */
        _initYearsModel: function () {
            var oDashboardModel = this.getView().getModel("dashboardModel");

            if (!oDashboardModel) {
                console.warn("[_initYearsModel] dashboardModel no disponible, reintentando en 500ms...");
                setTimeout(function () { this._initYearsModel(); }.bind(this), 500);
                return;
            }

            var sFreal = oDashboardModel.getProperty("/NavMasterLt/0/Freal");
            var sFrealfinobra = oDashboardModel.getProperty("/NavLsObra/0/Frealfinobra");

            var oDateStart = this._parseODataDate(sFreal);
            var oDateEnd = this._parseODataDate(sFrealfinobra);

            if (!oDateStart || !oDateEnd || isNaN(oDateStart) || isNaN(oDateEnd)) {
                console.warn("[_initYearsModel] Fechas no válidas. sFreal:", sFreal, "| sFrealfinobra:", sFrealfinobra);
                return;
            }

            var iYearStart = oDateStart.getFullYear();
            var iYearEnd = oDateEnd.getFullYear();

            // Se guardan el año de inicio y fin para usarlos al crear las columnas dinámicas.
            this._iYearStart = iYearStart;
            this._iYearEnd = iYearEnd;

            var aYears = [];
            for (var i = iYearStart; i <= iYearEnd; i++) {
                aYears.push({ year: String(i) });
            }

            this.getView().setModel(new JSONModel({
                years: aYears,
                selectedYear: String(iYearStart)
            }), "yearsModel");

            console.log("[_initYearsModel] Años generados de " + iYearStart + " a " + iYearEnd);
        },


    });
});