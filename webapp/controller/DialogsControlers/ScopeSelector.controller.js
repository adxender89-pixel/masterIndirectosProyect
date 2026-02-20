sap.ui.define(
    [
        "../BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/base/util/deepClone",
    ],
    function (BaseController, JSONModel, deepClone) {
        "use strict";

        return BaseController.extend("masterindirectos.controller.DialogsControlers.ScopeSelector", {
            onInit: function () {
                this.getView().setModel(new JSONModel([]), "tramosByObraModel");
            },

            filterScopes: function (oEvent) {
                const sQuery = oEvent.getParameter("value").toLowerCase();
                const oTreeTable = this.byId("nodeSelectorTable");
                const oBinding = oTreeTable.getBinding("rows");
                if (sQuery) {
                    const aFilters = [];
                    aFilters.push(new sap.ui.model.Filter("profitCenterDescription", sap.ui.model.FilterOperator.Contains, sQuery));
                    aFilters.push(new sap.ui.model.Filter("profitCenter", sap.ui.model.FilterOperator.Contains, sQuery));
                    const oCombinedFilter = new sap.ui.model.Filter({
                        filters: aFilters,
                        and: false
                    });
                    oBinding.filter(oCombinedFilter);
                    oTreeTable.expandToLevel(10);
                } else {
                    oBinding.filter([]);
                    oTreeTable.collapseAll();
                }
            },

            onAcceptScopeSelection: function () {
                const options = this.getView().getViewData();
                const oTreeTable = this.byId("nodeSelectorTable");
                const index =  oTreeTable.getSelectedIndex();
                let oSelectedNodeClone = null;
                let oSelectedNode = null;
                if(index === -1){
                    return;
                }

                const oContext = oTreeTable.getContextByIndex(index);
                oSelectedNode = oContext.getObject();
                oSelectedNodeClone = deepClone(oSelectedNode);
                delete oSelectedNodeClone.children;
                delete oSelectedNodeClone.tramo;
                
                options.callback(oSelectedNodeClone || null, oSelectedNode?.tramo || null);
                options.close();
            },

            onCancelScopeSelection: function () {
                const options = this.getView().getViewData();
                options.close();
            },

            setVisibleCombo: function (aObra) {
                if (aObra){
                    const modelTramos = this.getGlobalModel("allTramosModel");
                    const tramos = modelTramos.getData();
                    const existeTramo = tramos.some(tramo => tramo.Prctr === aObra);
                    
                    return existeTramo;
                }
                return false;
            },

            obraSelected: function (oEvent) {
                const oTreeTable = oEvent.getSource();
                const index = oTreeTable.getSelectedIndex();
                if(index !== -1){
                    const oContext = oTreeTable.getContextByIndex(index);
                    const oSelectedNode = oContext.getObject();
                    const obra = oSelectedNode.profitCenter;
                    const modelTramosByObra = new JSONModel();
                    const modelTramos = this.getGlobalModel("allTramosModel");
                    const tramos = modelTramos.getData();
                    const tramosByObra = tramos.filter(tramo => tramo.Prctr === obra);
                    modelTramosByObra.setData(tramosByObra);
                    this.getView().setModel(modelTramosByObra, "tramosByObraModel");
                } else {
                    this.getView().setModel(new JSONModel([]), "tramosByObraModel");
                }
            },

            setEnabledCombo: function (aObra) {
                if (aObra){
                    const modelTramosByObra = this.getView().getModel("tramosByObraModel");
                    const tramos = modelTramosByObra.getData();
                    const existeTramo = tramos.some(tramo => tramo.Prctr === aObra);
                    return existeTramo;
                }
            }
            


        });
    }
);
