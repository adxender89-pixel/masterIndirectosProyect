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

            oCatalogModel.loadData("model/Catalog.json");

            oCatalogModel.attachRequestCompleted(function () {
                var aCategories = oCatalogModel.getProperty("/catalog/models/categories");
                if (!Array.isArray(aCategories)) {
                    console.error("Categorie non trovate");
                    return;
                }

                var aComboItems = this._buildOperacionesCombo(aCategories);

                this.getView().setModel(
                    new JSONModel({ items: aComboItems }),
                    "operacionesModel"
                );
            }.bind(this));
        },

        /**
         * Forza el renderizado de la tabla una vez la vista está disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            this.byId("TreeTableBasic").rerender(true);
        },
        /**
          * Función que filtra las operaciones I.003.xxx
          */
        _buildOperacionesCombo: function (aCategories) {
            var aResult = [];

            function recurse(aNodes) {
                if (!Array.isArray(aNodes)) {
                    return;
                }

                aNodes.forEach(function (oNode) {

                    // prendiamo SOLO i nodi "finali"
                    if (
                        oNode.name &&
                        oNode.expandible === true &&
                        (!Array.isArray(oNode.categories) || oNode.categories.length > 0)
                    ) {
                        // escludiamo i macro-padri tipo "I. 003"
                        if (!oNode.categories || oNode.categories.length === 0) {
                            return;
                        }

                        // se ha figli "Agrupador", è un padre reale (I.003.xxx)
                        var hasAgrupador = oNode.categories.some(function (c) {
                            return c.isGroup === true;
                        });

                        if (hasAgrupador) {
                            aResult.push({
                                key: oNode.name,
                                text: oNode.name + " - " + (oNode.currency || "")
                            });
                        }
                    }

                    // 🔁 continua a scendere
                    if (Array.isArray(oNode.categories)) {
                        recurse(oNode.categories);
                    }
                });
            }

            recurse(aCategories);
            return aResult;
        },
        /**
        * Filtra la TreeTable según la operación seleccionada en el Select
        */
        onOperacionChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oTable = this.byId("TreeTableBasic");
            var oCatalogModel = this.getView().getModel("catalog");
            var oUiModel = this.getView().getModel("ui");
            var aCategories = oCatalogModel.getProperty("/catalog/models/categories");

            if (!Array.isArray(aCategories)) {
                return;
            }

            // ==========================================
            // CLEAR ComboBox → ripristino totale
            // ==========================================
            if (!oSelectedItem) {
                oTable.setModel(new JSONModel({ categories: aCategories }));
                oTable.bindRows("/categories");

                oUiModel?.setProperty("/showStickyParent", false);
                oUiModel?.setProperty("/showStickyChild", false);

                setTimeout(function () {
                    oTable.collapseAll();
                    oTable.invalidate();
                    this._refreshAfterToggle(oTable.getId());
                }.bind(this), 0);

                return;
            }

            // ==========================================
            // SELEZIONE
            // ==========================================
            var sKey = oSelectedItem.getKey();

            // 🔹 filtro dinamico (mantiene anche il padre)
            var aFilteredRoot = [];

            aCategories.forEach(function (rootCat) {

                if (!Array.isArray(rootCat.categories)) {
                    return;
                }

                var aFilteredChildren = this._filterCategories(
                    rootCat.categories,
                    sKey
                );

                // 🔹 se non matcha nulla → skip
                if (aFilteredChildren.length === 0) {
                    return;
                }

                // 🔹 RICREO IL PADRE (I.003)
                var oParentClone = Object.assign({}, rootCat);
                oParentClone.categories = aFilteredChildren;

                aFilteredRoot.push(oParentClone);

            }.bind(this));

            oTable.setModel(new JSONModel({ categories: aFilteredRoot }));
            oTable.bindRows("/categories");

            // ==========================================
            // EXPAND + STICKY automatico
            // ==========================================
            setTimeout(function () {
                oTable.expandToLevel(99);
                oTable.invalidate();

                var oBinding = oTable.getBinding("rows");
                if (!oBinding) return;

                for (var i = 0; i < oBinding.getLength(); i++) {
                    var oCtx = oTable.getContextByIndex(i);
                    var oObj = oCtx && oCtx.getObject();

                    // primo padre valido (dinamico)
                    if (oObj && oObj.categories && oObj.categories.length) {
                        this._sLastExpandedPath = oCtx.getPath();
                        oTable.setFirstVisibleRow(i);

                        oUiModel?.setProperty("/showStickyParent", true);
                        oUiModel?.setProperty("/showStickyChild", true);

                        this._refreshAfterToggle(oTable.getId());
                        break;
                    }
                }
            }.bind(this), 50);
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


            // EXPAND

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

            // COLLAPSE

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


            // REFRESH POST-TOGGLE

            setTimeout(function () {
                this._refreshAfterToggle(sTableId);
            }.bind(this));
        }
    });
});