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

        /**
         * Inicializa la vista de Diferidos definiendo el estado de navegación y visibilidad.
         * Configura la tabla principal y prepara las columnas anuales iniciales.
         */
        getCustomTableId: function() {
            return "TreeTableDiferidos";
        },

        onInit: function () {

            this.initDiferidosModel();
            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            // Ejecuta la configuración base para la TreeTable.
            this.setupDynamicTreeTable("TreeTableDiferidos");

            // Tras el renderizado, añade las columnas de los próximos 3 años.
            this.getView().attachEventOnce("afterRendering", function () {
                this.createYearColumns(new Date().getFullYear(), 3, "TreeTableDiferidos");
                this._attachHeaderToggleListener();
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

        initDiferidosModel: function(evt){
            this.post(
                this.getGlobalModel("mainService"),
                "/CambioPestIndirectosSet",
                {
                    "NavSelProyecto": [this.getGlobalModel("appData").getData().tramo],
                    "NavChanges": [],
                    "NavDatosIndirectos": [],
                    "EvBloqueados" : "",
                    "NavMensajes" : [],
                    "NavDatosIndirectos" : []


                },
                {
                    headers: {
                        ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                        lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                        bloqueado: "",
                        decimales: "02",
                        ejercicio: "2026",
                        pestana:"Diferidos"
                    }
                }
            ).then(function (response) {
                let tree = this.buildTree(response.NavDatosIndirectos.results)
                this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "diferidosModel");
        }.bind(this));
        },

        buildTree: function (data) {
            // Crear un mapa para acceso rápido por PhPspnr
            const map = {};
            data.forEach(item => {
                map[item.PhPspnr] = { ...item, children: [] }; // Clonamos para no modificar el original
            });

            const roots = [];

            data.forEach(item => {
                if (item.ParentPath === "I") {
                    // Nodo raíz
                    roots.push(map[item.PhPspnr]);
                } else {
                    // Nodo hijo: buscar su padre por ParentPath
                    const parent = map[item.ParentPath];
                    if (parent) {
                        parent.children.push(map[item.PhPspnr]);
                    }
                }
            });

            return roots;
        },
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