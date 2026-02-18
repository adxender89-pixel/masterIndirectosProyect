sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "masterindirectos/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], function (
    JSONModel,
    Column,
    Input,
    Button,
    Label,
    BaseController,
    Filter,
    FilterOperator,

) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Corrientes", {

        /**
         * Esta función le dice al BaseController qué ID de tabla buscar 
         * en esta vista específica.
         */
        getCustomTableId: function () {
            return "TreeTableBasic";
        },

        /**
         * Inicializa la vista de Corrientes definiendo el estado de navegación y visibilidad.
         * Configura la tabla principal y prepara las columnas anuales iniciales.
         * resubida
         */
        onInit: function () {

            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            this.setupDynamicTreeTable("TreeTableBasic");
            var oModel = this.getView().getModel();

            if (oModel) {
                this._editBackupData = JSON.parse(JSON.stringify(oModel.getData()));
            }

            // --- DELEGADO DE TECLADO (OPCIÓN 2) ---
            var oTable = this.byId("TreeTableBasic");
            oTable.addEventDelegate({
                onAfterRendering: function () {

                    var oTableDom = oTable.getDomRef();
                    if (!oTableDom) return;

                    // Usamos jQuery (.on) para capturar el keydown de cualquier input presente o futuro
                    $(oTableDom).off("keydown", "input").on("keydown", "input", function (oNativeEvent) {
                        var iKeyCode = oNativeEvent.keyCode;
                        // Solo nos interesan las flechas (37, 38, 39, 40)
                        if (iKeyCode < 37 || iKeyCode > 40) return;

                        // Obtenemos el control SAPUI5 a partir del ID del elemento DOM
                        var sId = oNativeEvent.target.id;
                        // A veces el ID del input real termina en -inner, lo limpiamos
                        var sControlId = sId.replace("-inner", "");
                        var oInput = sap.ui.getCore().byId(sControlId);

                        if (oInput && oInput.isA("sap.m.Input")) {
                            // Llamamos a tu función de navegación
                            this._onInputKeyDown({
                                srcControl: oInput,
                                keyCode: iKeyCode,
                                preventDefault: function () { oNativeEvent.preventDefault(); },
                                stopImmediatePropagation: function () { oNativeEvent.stopImmediatePropagation(); }
                            });
                        }
                    }.bind(this));
                }.bind(this)
            });
            // --------------------------------------

            this.getView().attachEventOnce("afterRendering", function () {
                this.createYearColumns(
                    new Date().getFullYear(), 3, "TreeTableBasic"
                );

                // Se adjunta el listener de cambios en el header
                this._attachHeaderToggleListener();
            }.bind(this));

            var oCatalogModel = new JSONModel();
            this.getView().setModel(oCatalogModel, "catalog");
            oCatalogModel.loadData("model/Catalog.json");

            oCatalogModel.attachRequestCompleted(function () {
                var aCategories = oCatalogModel.getProperty("/catalog/models/categories");
                if (!Array.isArray(aCategories)) {

                    return;
                }
                var aComboItems = this._buildOperacionesCombo(aCategories, "catalog");
                this.getView().setModel(
                    new JSONModel({ items: aComboItems }),
                    "operacionesModel"

                );
                var oModel = this.getView().getModel(); // modello principale
                if (oModel) {
                    this._editBackupData = JSON.parse(JSON.stringify(oModel.getData()));
                }
                setTimeout(function () {
                    this._createSnapshot();
                }.bind(this), 0);
            }.bind(this));

            var iActualYear = new Date().getFullYear();
            var aSelectYears = [];
            var iRangeSelect = 10;
            for (var i = 0; i < iRangeSelect; i++) {
                aSelectYears.push({ year: iActualYear + i });
            }

            var oYearModel = new sap.ui.model.json.JSONModel({
                years: aSelectYears,
                selectedYear: iActualYear
            });
            this.getView().setModel(oYearModel, "yearsModel");

            this._boundBrowserClose = this.onBrowserClose.bind(this);
            window.addEventListener("beforeunload", this._boundBrowserClose);
        },
        /**
         * Escucha cuando el header se expande o colapsa y recalcula las filas
         */
        _attachHeaderToggleListener: function () {


            var oObjectPageLayout = this.byId("objectPageLayout");

            if (!oObjectPageLayout) {

                return;
            }

            // Delegación de eventos - Intercepta todos los clicks en los botones collapse/expand
            setTimeout(function () {
                var oDom = oObjectPageLayout.getDomRef();

                if (!oDom) {

                    return;
                }

                // Event delegation: intercepta los clicks en cualquier botón de toggle
                oDom.addEventListener("click", function (e) {
                    var target = e.target;

                    // Se verifica si el click es en un botón de collapse o expand
                    if (target.closest(".sapFDynamicPageToggleHeaderIndicator") ||
                        target.closest('[id$="-collapseBtn"]') ||
                        target.closest('[id$="-expandBtn"]')) {



                        setTimeout(function () {

                            this._calculateDynamicRows();
                        }.bind(this), 200);
                    }
                }.bind(this), true); // true = useCapture



            }.bind(this), 1000); // Delay mayor para asegurar que el DOM esté listo


        },
        /**
        * Manejador del evento de añadir elemento.
         * Inserta un nuevo nodo hijo dentro del elemento seleccionado actualmente
         */

        onAddPress: function () {
            var oTable = this.byId("TreeTableBasic");
            var iSelectedIndex = oTable.getSelectedIndex();
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (iSelectedIndex === -1) {
                sap.m.MessageToast.show(oBundle.getText("msgSelectRow"));
                return;
            }

            var oContext = oTable.getContextByIndex(iSelectedIndex);
            var oParentData = oContext.getObject();
            var sParentName = oParentData.name;

            // --- NUEVA VALIDACIÓN POR PARÁMETRO "PADRE" ---
            // Solo si el objeto tiene "padre: true" en el JSON permitiremos añadir.
            if (oParentData.padre !== true) {
                // Si intentan añadir en un hijo (que no tiene este parámetro), saltará el error.
                sap.m.MessageToast.show(oBundle.getText("msgOnlyRootAllowed", [sParentName]));
                return;
            }

            var iCurrentYear = new Date().getFullYear();

            // --- CREACIÓN DEL OBJETO HIJO ---
            var oNewChild = {
                name: sParentName + ".",
                currency: "",
                amount: "",
                pricepending: "",
                pricetotal: "",
                size: "",
                last: "",
                pend: "",
                year2: null,
                monthsData: [],
                isGroup: false,
                expandible: true, // Para que se vea como una fila normal de la tabla
                // IMPORTANTE: No le ponemos "padre: true" al hijo.
                // Al no tenerlo, el botón no funcionará cuando se seleccione esta nueva fila.
                categories: [],
                months: {}
            };

            // Bucle de inicialización de meses (se mantiene igual)
            for (var i = 0; i < 3; i++) {
                var iYear = iCurrentYear + i;
                oNewChild["y" + iYear] = "";
                for (var m = 1; m <= 12; m++) {
                    var sMonthKey = "m" + iYear + "_" + (m < 10 ? "0" + m : m);
                    oNewChild.months[sMonthKey] = "";
                }
            }

            if (!oParentData.categories) {
                oParentData.categories = [];
            }

            oParentData.categories.push(oNewChild);

            this.getView().getModel("catalog").refresh(true);
            oTable.expand(iSelectedIndex);

            if (oTable.getBinding("rows")) {
                oTable.getBinding("rows").refresh();
            }

            sap.m.MessageToast.show(oBundle.getText("msgAddSuccess", [sParentName]));
        },   /**

        /**
         * Fuerza el renderizado de la tabla una vez que la vista está disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            this.byId("TreeTableBasic").rerender(true);
        },
        /**
         * Gestiona la visibilidad de columnas extendidas al expandir nodos en la TreeTable.
         */
        onToggleOpenState: function (oEvent) {
            var oTable = oEvent.getSource();
            var sTableId = oTable.getId();
            var bExpanded = oEvent.getParameter("expanded");
            var iRowIndex = oEvent.getParameter("rowIndex");
            var oUiModel = this.getView().getModel("ui");

            var oColMonths = this.byId("colMonths");
            var oColNew = this.byId("colNew");

            var oContext = oTable.getContextByIndex(iRowIndex);
            var sPath = oContext && oContext.getPath();
            var oObject = oContext && oContext.getObject();


            // expand

            if (bExpanded) {

                var bIsDetailLevel =
                    oObject &&
                    oObject.categories &&
                    oObject.categories.length > 0 &&
                    oObject.categories[0].isGroup === true;

                if (oColMonths) oColMonths.setVisible(bIsDetailLevel);
                if (oColNew) oColNew.setVisible(bIsDetailLevel);

                if (bIsDetailLevel && sPath) {
                    this._sLastExpandedPath = sPath;
                }
            }

            // collapse

            else {

                if (this._sLastExpandedPath === sPath) {
                    this._sLastExpandedPath = null;
                }

                var bAnyDetailExpanded = false;
                var oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    var iLength = oBinding.getLength();

                    for (var i = 0; i < iLength; i++) {
                        if (oTable.isExpanded(i)) {
                            var oCtx = oTable.getContextByIndex(i);
                            var oObj = oCtx && oCtx.getObject();

                            if (
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

                // Si nada está abierto: reset UI
                if (!bAnyDetailExpanded) {
                    if (oColMonths) oColMonths.setVisible(false);
                    if (oColNew) oColNew.setVisible(false);

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
         * Se ejecuta antes de cerrar el navegador para advertir sobre cambios no guardados
         */
        onBrowserClose: function (oEvent) {
            if (this.hasUnsavedChanges()) {
                // Si hay cambios reales, bloquea el cierre
                oEvent.preventDefault();
                oEvent.returnValue = ''; // Estándar para Chrome
                return ''; // Para otros navegadores
            }
        },

        /**
         * Limpia los event listeners al destruir el controlador
         */
        onExit: function () {
            // Se utiliza la misma referencia para eliminar
            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
        },




    });
});