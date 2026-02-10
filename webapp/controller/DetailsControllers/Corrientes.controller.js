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

            this.getView().attachEventOnce("afterRendering", function () {
                this.createYearColumns(
                    "TreeTableBasic",
                    new Date().getFullYear(), 3
                );
            }.bind(this));

            var oCatalogModel = new JSONModel();
            this.getView().setModel(oCatalogModel, "catalog");

            oCatalogModel.loadData("model/Catalog.json");

            oCatalogModel.attachRequestCompleted(function () {
                var aCategories = oCatalogModel.getProperty("/catalog/models/categories");
                if (!Array.isArray(aCategories)) {
                    console.error("Categorías no encontradas");
                    return;
                }

                var aComboItems = this._buildOperacionesCombo(aCategories);

                this.getView().setModel(
                    new JSONModel({ items: aComboItems }),
                    "operacionesModel"
                );

                // ========== CREA EL SNAPSHOT DESPUÉS DE LA CARGA ==========
                this._createSnapshot();
            }.bind(this));

            var iActualYear = new Date().getFullYear();
            var aSelectYears = [];
            var iRangeSelect = 10;

            for (var i = 0; i < iRangeSelect; i++) {
                aSelectYears.push({
                    year: iActualYear + i
                });
            }

            var oYearModel = new sap.ui.model.json.JSONModel({
                years: aSelectYears,
                selectedYear: iActualYear
            });
            this.getView().setModel(oYearModel, "yearsModel");
            // Registra el evento de cierre del navegador
            window.addEventListener("beforeunload", this.onBrowserClose.bind(this));

        },

        /**
         * Crea una copia profunda del modelo "catalog" para comparaciones futuras
         */
        _createSnapshot: function () {
            var oDefaultModel = this.getView().getModel();  // <-- SIN "catalog"
            if (oDefaultModel) {
                var oData = oDefaultModel.getData();
                this._originalData = JSON.parse(JSON.stringify(oData));
            }
        },

        /**
         * Verifica si hay cambios no guardados comparando el modelo actual con el snapshot
         */
        hasUnsavedChanges: function () {
            console.log("=== DEBUG START: hasUnsavedChanges ===");

            if (!this._originalData) return false;

            var oDefaultModel = this.getView().getModel();
            if (!oDefaultModel) return false;

            var aCurrentCat = oDefaultModel.getProperty("/catalog/models/categories");
            var aOriginalCat = this._originalData.catalog.models.categories;

            /**
             * Helper de Normalización Avanzado
             * Convierte en cadena vacía todo lo que sea "zero-like"
             */
            var normalize = function (val) {
                // Si es null, undefined o una cadena vacía
                if (val === undefined || val === null || val === "") return "";

                // Si es un array (ej. el caso 0,0,0,0...), se une y se comprueba si contiene solo ceros o está vacío
                if (Array.isArray(val)) {
                    var sJoined = val.join("").replace(/,/g, "").trim();
                    return (sJoined === "" || /^0+$/.test(sJoined)) ? "" : sJoined;
                }

                var sVal = val.toString().trim();

                // Si la cadena resultante es "0", "0,0,0..." o "0.00", se considera vacía
                if (sVal === "0" || sVal === "0.0" || sVal === "0,0" || /^0+(?:[.,]0+)*$/.test(sVal) || /^0+(?:,0+)*$/.test(sVal)) {
                    return "";
                }

                return sVal;
            };

            var checkRecursive = function (aCurrent, aOriginal, sPath) {
                if (!aCurrent) return false;

                for (var i = 0; i < aCurrent.length; i++) {
                    var oCur = aCurrent[i];
                    var oOri = (aOriginal && aOriginal[i]) ? aOriginal[i] : {};
                    var currentPath = sPath + " -> " + (oCur.name || i);

                    for (var key in oCur) {
                        // 1. Control de Años y Meses (y2026, m2026_01)
                        if (/^y\d{4}$/.test(key) || /^m\d{4}_\d+$/.test(key)) {
                            if (normalize(oCur[key]) !== normalize(oOri[key])) {
                                console.log("DEBUG: Modificación en " + key + ". Actual:", oCur[key], "Original:", oOri[key]);
                                return true;
                            }
                        }

                        // 2. Control del objeto 'months' (el caso crítico)
                        if (key === "months" && oCur[key] && typeof oCur[key] === "object") {
                            for (var mKey in oCur[key]) {
                                var vCurM = normalize(oCur[key][mKey]);
                                var vOriM = (oOri.months) ? normalize(oOri.months[mKey]) : "";

                                if (vCurM !== vOriM) {
                                    console.log("DEBUG: Modificación en months[" + mKey + "]. Actual:", oCur[key][mKey], "Original:", (oOri.months ? oOri.months[mKey] : "undefined"));
                                    return true;
                                }
                            }
                        }
                    }

                    // 3. Recursión sobre los hijos
                    if (oCur.categories && Array.isArray(oCur.categories) && oCur.categories.length > 0) {
                        if (checkRecursive(oCur.categories, oOri.categories, currentPath)) {
                            return true;
                        }
                    }
                }
                return false;
            };

            var bResult = checkRecursive(aCurrentCat, aOriginalCat, "Root");
            console.log("=== DEBUG END: Resultado =", bResult, "===");
            return bResult;
        },

        /**
         * Resetea todos los inputs dinámicos (años y meses) y recrea el snapshot
         */
        resetInputs: function () {
            if (!this._originalData) return;
            var oDefaultModel = this.getView().getModel();
            // Copia profunda para evitar referencias al objeto original
            var oResetCopy = jQuery.extend(true, {}, this._originalData);
            oDefaultModel.setData(oResetCopy);
            oDefaultModel.refresh(true);
        },

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
            // Elimina el control para evitar memory leak
            window.removeEventListener("beforeunload", this.onBrowserClose.bind(this));
        },
    });
});