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
         */
        onInit: function () {
            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            // Ejecuta la configuración base para la TreeTable.
            this.setupDynamicTreeTable("TreeTableBasic");

            // Tras el renderizado, añade las columnas de los próximos 3 años.
            this.getView().attachEventOnce("afterRendering", function () {
                this.createYearColumns(
                    "TreeTableBasic",
                    new Date().getFullYear(), 3
                );
            }.bind(this));
            var oCatalogModel = new JSONModel();
            // 1. Settiamo il modello SUBITO, anche se è vuoto (così la View lo conosce già)
            this.getView().setModel(oCatalogModel, "catalog");

            var oCatalogModel = new JSONModel();
            oCatalogModel.loadData("model/Catalog.json");

            oCatalogModel.attachRequestCompleted(function () {
                var oData = oCatalogModel.getData();
                var oOriginalModel = new JSONModel(jQuery.extend(true, {}, oData));

                // Li settiamo globali sul Component
                this.getOwnerComponent().setModel(oCatalogModel, "data");
                this.getOwnerComponent().setModel(oOriginalModel, "dataOriginal");
            }.bind(this));
            // 1. Definiamo l'anno di partenza
            var iActualYear = new Date().getFullYear();
            var aSelectYears = [];

            // 2. QUESTO È IL TUO "TELECOMANDO":
            var iRangeSelect = 10; // <--- SE SCRIVI 10, AVRAI 10 ANNI NEL MENU.

            // 3. Il ciclo genera fisicamente la lista basandosi su iRangeSelect
            for (var i = 0; i < iRangeSelect; i++) {
                aSelectYears.push({
                    year: iActualYear + i
                });
            }

            // 4. Carichiamo la lista nel modello usato dal Select nell'XML
            var oYearModel = new sap.ui.model.json.JSONModel({
                years: aSelectYears,
                selectedYear: iActualYear
            });
            this.getView().setModel(oYearModel, "yearsModel");
        },

        /**
         * Forza el renderizado de la tabla una vez la vista está disponible en el DOM.
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

                // si nada esta abierto: reset UI
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
        }
    });
});