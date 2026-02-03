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
    Filter,
    FilterOperator,
    BaseController
) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Anticipados", {

        /**
         * Inicializa la vista de Anticipados definiendo el estado de navegación y visibilidad.
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
                    new Date().getFullYear(),
                    3
                );
            }.bind(this));
            // --- Cargar JSON de Catalog ---
            var oCatalogModel = new JSONModel();
            this.getView().setModel(oCatalogModel, "catalog");
            oCatalogModel.loadData("model/Catalog.json"); // ruta a tu JSON

            // Cuando termine de cargar, llenar el Select
            oCatalogModel.attachRequestCompleted(function () {
                var oData = oCatalogModel.getData();

                if (!oData || !oData.catalog || !oData.catalog.models || !oData.catalog.models.categories) {
                    console.error("Catalog.json sin categorías");
                    return;
                }

                // Crear modelo para el Select
                var aOperaciones = this._getOperacionesI003(oData.catalog.models.categories);
                var oOperacionesModel = new JSONModel({ items: aOperaciones });
                this.getView().setModel(oOperacionesModel, "operacionesModel");
            }.bind(this));
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

    // 🔐 contesto + path STABILE
    var oContext = oTable.getContextByIndex(iRowIndex);
    var sPath = oContext && oContext.getPath();
    var oObject = oContext && oContext.getObject();

    // =========================
    // EXPAND
    // =========================
    if (bExpanded) {

        var bIsDetailLevel =
            oObject &&
            oObject.categories &&
            oObject.categories.length > 0 &&
            oObject.categories[0].isGroup === true;

        if (oColMonths) oColMonths.setVisible(bIsDetailLevel);
        if (oColNew) oColNew.setVisible(bIsDetailLevel);

        // ✅ salvo SOLO il padre corretto
        if (bIsDetailLevel && sPath) {
            this._sLastExpandedPath = sPath;
        }
    }

    // =========================
    // COLLAPSE
    // =========================
    else {

        // se sto chiudendo proprio quel padre, lo pulisco
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

        // nessun dettaglio aperto → reset UI
        if (!bAnyDetailExpanded) {
            if (oColMonths) oColMonths.setVisible(false);
            if (oColNew) oColNew.setVisible(false);

            this._aGroupRanges = [];
            oUiModel.setProperty("/showStickyAgrupador", false);
            oUiModel.setProperty("/showStickyParent", false);
            oUiModel.setProperty("/showStickyChild", false);
        }
    }

    // =========================
    // REFRESH POST-TOGGLE
    // =========================
    setTimeout(function () {
        this._refreshAfterToggle(sTableId);
    }.bind(this), 0);
}
    });
});