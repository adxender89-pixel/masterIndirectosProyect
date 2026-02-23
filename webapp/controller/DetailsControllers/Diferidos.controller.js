sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "masterindirectos/controller/BaseController"
], function (
    JSONModel,
    Column,
    Input,
    Button,
    Label,
    BaseController
) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Diferidos", {
         getCustomTableId: function () {
            return "TreeTableDiferidos";
        },

        /**
         * Inicializa la vista de Diferidos definiendo el estado de navegación y visibilidad.
         * Configura la tabla principal y prepara las columnas anuales iniciales.
         */
        onInit: function () {
            this.getView().setModel(new JSONModel({
                selectedKey: "Diferidos"
            }), "state");
            
            this.getView().setModel(new JSONModel({
                Coste: "19.882.313,17",
                CostePendiente: "3.134.026,07",
                CosteTotal: "23.016.339,24"

            }), "KpiDiferidos");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            this.tableModelName = "diferidos"; // Nombre del modelo para la tabla, se usará en funciones genéricas del BaseController
            var oCatalogModel = new JSONModel();
            this.getView().setModel(oCatalogModel, this.tableModelName);

            oCatalogModel.loadData("model/CatalogDiferidos.json");

            oCatalogModel.attachRequestCompleted(function () {
                var aCategories = oCatalogModel.getProperty("/catalogDiferidos/models/categories");
                if (!Array.isArray(aCategories)) {

                    return;
                }

                var aComboItems = this._buildOperacionesCombo(aCategories);

                this.getView().setModel(
                    new JSONModel({ items: aComboItems }),
                    "operacionesModel"
                );

                this._createSnapshot();
            }.bind(this));

            // Ejecuta la configuración base para la TreeTable.
            this.setupDynamicTreeTable("TreeTableExternos");

            // Tras el renderizado, añade las columnas de los próximos 3 años.
            this.getView().attachEventOnce("afterRendering", function () {
                this.createYearColumns(
                    
                    new Date().getFullYear(),
                    3, "TreeTableExternos"
                );
            }.bind(this));
        },

        /**
         * Forza el renderizado de la tabla una vez la vista está disponible en el DOM.
         */
        onAfterRendering: function(oEvent){
            this.byId("TreeTableDiferidos").rerender(true);
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
            var oDefaultModel = this.getView().getModel("diferidos");  // SIN "catalog"
            if (oDefaultModel) {
                var oData = oDefaultModel.getData();
                this._originalData = JSON.parse(JSON.stringify(oData));
            }
        },
    });
});