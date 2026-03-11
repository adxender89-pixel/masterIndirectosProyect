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
], function (
    JSONModel,
    Column,
    Input,
    Button,
    Label,
    BaseController,
    Filter,
    FilterOperator,
    Fragment

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
            this.tableModelName = ""
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

            var oTable = this.byId("TreeTableBasic");


            oTable.addEventDelegate({
                onAfterRendering: function () {

                    var oTableDom = oTable.getDomRef();
                    if (!oTableDom) return;
                    var $table = $(oTableDom);

                    // CLIC DERECHO
                    $table.off("contextmenu").on("contextmenu", function (oNativeEvent) {
                        oNativeEvent.preventDefault();
                        var $target = $(oNativeEvent.target);
                        var oTargetControl = $target.control(0);

                        var iRowIndex = $target.closest(".sapUiTableTr").index();
                        var oRowContext = oTable.getContextByIndex(oTable.getFirstVisibleRow() + iRowIndex);

                        if (!oRowContext) return;

                        // Verificar que es padre o cabecera
                        var oObj = oRowContext.getObject();
                        if (!oObj) return;
                        if (oObj.padre !== true && oObj.cabecera !== true) return;

                        // ── Solo abrir si el clic fue sobre el Input de la columna "name" ──
                        // El oTargetControl debe ser el Input cuyo value binding sea "name"
                        var oCtrl = oTargetControl;
                        if (oCtrl && oCtrl.getBindingInfo) {
                            var oBindingInfo = oCtrl.getBindingInfo("value");
                            var sBindingPath = oBindingInfo && oBindingInfo.parts && oBindingInfo.parts[0] && oBindingInfo.parts[0].path;

                            console.log("binding path:", sBindingPath);

                            if (sBindingPath !== "name") return;
                        } else {
                            return;
                        }
                        // ──────────────────────────────────────────────────────────────────

                        this.onContextMenu({
                            rowBindingContext: oRowContext,
                            cellControl: oTargetControl || oTable
                        });
                    }.bind(this));


                    $table.off("keydown", "input").on("keydown", "input", function (oNativeEvent) {
                        var iKeyCode = oNativeEvent.keyCode;
                        if (iKeyCode < 37 || iKeyCode > 40) return;

                        var sControlId = oNativeEvent.target.id.replace("-inner", "");
                        var oInput = sap.ui.getCore().byId(sControlId);
                        if (oInput && oInput.isA("sap.m.Input")) {
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

            this.getView().attachEventOnce("afterRendering", function () {
                this.createYearColumns(new Date().getFullYear(), 3, "TreeTableBasic");
                this._attachHeaderToggleListener();
            }.bind(this));

            var oCatalogModel = new JSONModel();
            this.getView().setModel(oCatalogModel, this.tableModelName);
            oCatalogModel.loadData("model/Catalog.json");

            oCatalogModel.attachRequestCompleted(function () {
                var aCategories = oCatalogModel.getProperty("/catalog/models/categories");
                if (Array.isArray(aCategories)) {
                    var aComboItems = this._buildOperacionesCombo(aCategories);
                    this.getView().setModel(new JSONModel({ items: aComboItems }), "operacionesModel");
                    this._createSnapshot();
                }
                var aComboItems = this._buildOperacionesCombo(aCategories, this.tableModelName);
                this.getView().setModel(
                    new JSONModel({ items: aComboItems }),
                    "operacionesModel"

                );
                var oModel = this.getView().getModel();
                if (oModel) {
                    this._editBackupData = JSON.parse(JSON.stringify(oModel.getData()));
                }
                setTimeout(function () {
                    this._createSnapshot();
                }.bind(this), 0);
            }.bind(this));

            var iActualYear = new Date().getFullYear();
            var aSelectYears = [];
            for (var i = 0; i < 10; i++) {
                aSelectYears.push({ year: iActualYear + i });
            }
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                years: aSelectYears,
                selectedYear: iActualYear
            }), "yearsModel");

            this._boundResizeHandler = function () {
                this._calculateDynamicRows();
            }.bind(this);
            $(window).on("resize", this._boundResizeHandler);

            this._boundBrowserClose = this.onBrowserClose.bind(this);
            window.addEventListener("beforeunload", this._boundBrowserClose);
        },

        /**
         * Escucha cuando el header se expande o colapsa y recalcula las filas
         */
        _attachHeaderToggleListener: function () {
            var oObjectPageLayout = this.byId("objectPageLayout");
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
        /**
           * Crea masivamente nuevos registros en el catálogo.
           * Ahora permite creación en Raíz y en Agrupadores.
           */
        onAddPress: function (oEvent) {
            var oTable = this.byId("TreeTableBasic");
            var oModel = this.getView().getModel();
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            var iQuantity = 1;
            var oInput = this.byId("itemQuantityInput");
            if (oInput) {
                iQuantity = parseInt(oInput.getValue()) || 1;
                oInput.setValue(1);
            }

            var oContext = this._oContextRecord || oTable.getContextByIndex(oTable.getSelectedIndex());
            var aTargetArray;
            var sParentName = "";

            if (!oContext) {

                aTargetArray = oModel.getProperty("/catalog/models/categories");
            } else {

                var oParentData = oContext.getObject();


               if (oParentData.padre === true || oParentData.isGroup === true) {

    // Si es la fila "Agrupador" (cabecera), subir un nivel al padre real
    if (oParentData.cabecera === true) {
        var sParentPath = oContext.getPath();
        // Subir dos niveles: /categories/X/categories/0 → /categories/X
        sParentPath = sParentPath.substring(0, sParentPath.lastIndexOf("/categories"));
        var oRealParent = oModel.getProperty(sParentPath);
        if (!oRealParent || !oRealParent.categories) {
            sap.m.MessageToast.show(oBundle.getText("msgOnlyRootAllowed"));
            return;
        }
        aTargetArray = oRealParent.categories;
        sParentName = oRealParent.name;
    } else {
        if (!oParentData.categories) { oParentData.categories = []; }
        aTargetArray = oParentData.categories;
        sParentName = oParentData.name;
    }
} else {

                    sap.m.MessageToast.show(oBundle.getText("msgOnlyRootAllowed"));
                    return;
                }
            }


            var iCurrentYear = new Date().getFullYear();
            var sNewItemDefaultName = oBundle.getText("labelNewOperation");

            for (var k = 0; k < iQuantity; k++) {


                var sFinalName = "";

                if (!oContext) {

                    sFinalName = sNewItemDefaultName + " " + (aTargetArray.length + 1);
                } else {

                    var oParentData = oContext.getObject();

                    if (oParentData.padre === true) {
                        // Si el padre es de nivel Raíz (ej: I.003), le ponemos el prefijo I.003.
                        sFinalName = sParentName + ".";
                    } else {

                        sFinalName = "";
                    }
                }

    var oNew = {
    name: sFinalName,
    // NO pongas isGroup, padre, expandible, cabecera
    // Solo los campos de datos
    flag1: false,
    flag2: false,
    amount: "",
    currency: "",
    nMonths: "",
    pend: "",
    months: "",
    monthsData: {}
};

                this._fillMonths(oNew, iCurrentYear);
                aTargetArray.push(oNew);
            }

            // 4. REFRESCO Y EXPANSIÓN
            oModel.refresh(true);

            if (oContext) {
                var sPath = oContext.getPath();
                setTimeout(function () {
                    var oBinding = oTable.getBinding("rows");
                    oBinding.refresh(true);

                    var aContexts = oBinding.getContexts(0, oBinding.getLength());
                    var iIndex = -1;
                    for (var i = 0; i < aContexts.length; i++) {
                        if (aContexts[i].getPath() === sPath) {
                            iIndex = i;
                            break;
                        }
                    }

                    if (iIndex !== -1) {
                        oTable.expand(iIndex);
                    }
                }.bind(this), 100);
            }

            // 5. LIMPIEZA
            if (this.onCloseContextMenu) { this.onCloseContextMenu(); }
            this._oContextRecord = null;

            sap.m.MessageToast.show(oBundle.getText("msgItemsAdded", [iQuantity]));
        },

        _fillMonths: function (oItem, iYearStart) {
            oItem.monthsData = {};

            for (var i = 0; i < 3; i++) {
                var iYear = iYearStart + i;
                oItem["y" + iYear] = "";
                for (var m = 1; m <= 12; m++) {
                    var sMonthKey = "m" + iYear + "_" + (m < 10 ? "0" + m : m);

                    oItem.monthsData[sMonthKey] = "";
                }
            }
        },
        /**
         * Fuerza el renderizado de la tabla una vez que la vista está disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            this._attachHeaderToggleListener();

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
            var oColCheck1 = this.byId("colCheckBox1");
            var oColCheck2 = this.byId("colCheckBox2");

            var oContext = oTable.getContextByIndex(iRowIndex);
            var sPath = oContext && oContext.getPath();
            var oObject = oContext && oContext.getObject();

            var iLevel = sPath ? (sPath.match(/\/categories/g) || []).length : 0;
            // expand

            if (bExpanded) {

                var bIsDetailLevel =
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
                            var sCtxPath = oCtx ? oCtx.getPath() : "";
                            var iCtxLevel = (sCtxPath.match(/\/categories/g) || []).length;

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

                // Si nada está abierto: reset UI
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

            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },




    });
});