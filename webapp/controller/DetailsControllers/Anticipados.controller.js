sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",

    "masterindirectos/controller/BaseController"
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
          * Función que filtra las operaciones I.003.xxx
          */
        _getOperacionesI003: function (aCategories) {
            var aResult = [];

            function recurse(categories) {
                if (!Array.isArray(categories)) return;
                categories.forEach(function (oCat) {
                    if (oCat.name && oCat.name.replace(/\s/g, '').startsWith("I.003.")) {
                        aResult.push({ key: oCat.name, text: oCat.name });
                    }
                    // Recurse into child categories
                    if (oCat.categories) {
                        recurse(oCat.categories);
                    }
                });
            }

            recurse(aCategories);
            return aResult;
        },


        /**
 * Filtra la TreeTable según la operación seleccionada en el Select
 */onOperacionChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oTable = this.byId("TreeTableBasic");
            var oCatalogModel = this.getView().getModel("catalog");
            var aCategories = oCatalogModel.getProperty("/catalog/models/categories");

            if (!aCategories) return;

            // ==========================================
            //  SI SE LIMPIA EL COMBO → RESET AL INICIO
            // ==========================================
            if (!oSelectedItem) {
                oTable.setModel(new JSONModel({ categories: aCategories }));
                oTable.bindRows("/categories");

                oTable.collapseAll();

                // Expandir solo I.003
                setTimeout(function () {
                    var oBinding = oTable.getBinding("rows");
                    if (!oBinding) return;

                    for (var i = 0; i < oBinding.getLength(); i++) {
                        var oCtx = oTable.getContextByIndex(i);
                        var oObj = oCtx && oCtx.getObject();

                        if (oObj?.name?.replace(/\s/g, '') === "I.003") {
                            oTable.expand(i);
                            oTable.invalidate(); // pinta el gris correctamente
                            break;
                        }
                    }
                }, 0);

                return; //  no seguir
            }

            // ==========================================
            //  SELECCIÓN NORMAL
            // ==========================================
            var sKey = oSelectedItem.getKey();

            var aFilteredRoot = aCategories.map(function (rootCat) {
                var newCat = Object.assign({}, rootCat);

                if (rootCat.name && rootCat.name.replace(/\s/g, '').startsWith("I.003")) {
                    newCat.categories = rootCat.categories
                        ? this._filterCategories(rootCat.categories, sKey)
                        : [];
                }

                return newCat;
            }.bind(this));

            oTable.setModel(new JSONModel({ categories: aFilteredRoot }));
            oTable.bindRows("/categories");

            // Expandir todo bajo I.003
            setTimeout(function () {
                oTable.expandToLevel(99);
                oTable.invalidate(); // CLAVE para el gris
            }, 50);
        },



        _filterCategories: function (aCategories, sKey) {
            return aCategories
                .map(function (cat) {
                    var newCat = Object.assign({}, cat);

                    if (cat.categories) {
                        // Filtramos hijos recursivamente
                        newCat.categories = this._filterCategories(cat.categories, sKey);
                    }

                    // Si el nodo coincide con el key, mantenemos todos sus hijos originales
                    if (cat.name === sKey) {
                        newCat.categories = cat.categories || [];
                        return newCat;
                    }

                    // Mantener nodo si tiene hijos filtrados
                    if (newCat.categories && newCat.categories.length > 0) {
                        return newCat;
                    }

                    return null;
                }.bind(this))
                .filter(Boolean);
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
            var oObject = oContext?.getObject();

            // =========================
            // EXPAND
            // =========================
            if (bExpanded) {
                if (oObject?.categories?.length) {
                    setTimeout(function () {
                        var oBinding = oTable.getBinding("rows");
                        if (!oBinding) return;

                        var iIndex = oBinding.getContexts().findIndex(function (ctx) {
                            return ctx.getObject() === oObject;
                        });

                        if (iIndex !== -1) {
                            oTable.expandToLevel(iIndex, 99); // expandir solo este nodo
                        }
                    }, 0);
                }

                var bIsDetailLevel = oObject?.categories?.[0]?.isGroup === true;

                if (oColMonths) oColMonths.setVisible(bIsDetailLevel);
                if (oColNew) oColNew.setVisible(bIsDetailLevel);
            }

            // =========================
            // COLLAPSE
            // =========================
            else {
                var oBinding = oTable.getBinding("rows");
                if (oBinding) {
                    for (var i = 0; i < oBinding.getLength(); i++) {
                        var oCtxInner = oTable.getContextByIndex(i);
                        var oObjInner = oCtxInner?.getObject();

                        // Solo colapsar el nodo actual
                        if (oObjInner === oObject) {
                            oTable.collapse(i);
                            break;
                        }
                    }
                }

                // Lógica de columnas sticky
                var bAnyDetailExpanded = false;
                if (oBinding) {
                    for (var j = 0; j < oBinding.getLength(); j++) {
                        if (oTable.isExpanded(j)) {
                            var oCtxCheck = oTable.getContextByIndex(j);
                            var oObjCheck = oCtxCheck?.getObject();

                            if (oObjCheck?.categories?.[0]?.isGroup === true) {
                                bAnyDetailExpanded = true;
                                break;
                            }
                        }
                    }
                }

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