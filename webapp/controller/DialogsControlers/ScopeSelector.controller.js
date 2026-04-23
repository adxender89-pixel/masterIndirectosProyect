sap.ui.define(
    [
        "../BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/base/util/deepClone",
    ],
    function (BaseController, JSONModel, deepClone) {
        "use strict";

        return BaseController.extend("masterindirectos.controller.DialogsControlers.ScopeSelector", {
            
            /**
             * Se inicializa el controlador del diálogo estableciendo un modelo JSON vacío
             * para los tramos asociados a una obra específica.
             */
            onInit: function () {
                this.getView().setModel(new JSONModel([]), "tramosByObraModel");
            },

            /**
             * Se filtran los elementos de la tabla jerárquica (TreeTable) en base a la consulta
             * ingresada por el usuario, buscando coincidencias en la descripción o en el código del centro de beneficio.
             */
            filterScopes: function (oEvent) {
                // Se obtiene el valor de búsqueda y se convierte a minúsculas.
                const sQuery = oEvent.getParameter("value").toLowerCase();
                const oTreeTable = this.byId("nodeSelectorTable");
                const oBinding = oTreeTable.getBinding("rows");
                
                if (sQuery) {
                    // Se crea un arreglo de filtros para buscar coincidencias.
                    const aFilters = [];
                    aFilters.push(new sap.ui.model.Filter("profitCenterDescription", sap.ui.model.FilterOperator.Contains, sQuery));
                    aFilters.push(new sap.ui.model.Filter("profitCenter", sap.ui.model.FilterOperator.Contains, sQuery));
                    
                    // Se combinan los filtros utilizando el operador lógico OR (and: false).
                    const oCombinedFilter = new sap.ui.model.Filter({
                        filters: aFilters,
                        and: false
                    });
                    
                    // Se aplica el filtro al binding y se expande el árbol para mostrar los resultados.
                    oBinding.filter(oCombinedFilter);
                    oTreeTable.expandToLevel(10);
                } else {
                    // Si no hay consulta, se eliminan los filtros y se contrae el árbol completo.
                    oBinding.filter([]);
                    oTreeTable.collapseAll();
                }
            },

            /**
             * Se procesa la selección del nodo confirmada por el usuario.
             * Extrae la información del nodo y el tramo asociado, los clona para evitar referencias
             * y los envía de vuelta a la vista que invocó el diálogo mediante un callback.
             */
            onAcceptScopeSelection: function () {
                const options = this.getView().getViewData();
                const oTreeTable = this.byId("nodeSelectorTable");
                const index =  oTreeTable.getSelectedIndex();
                let oSelectedNodeClone = null;
                let oSelectedNode = null;
                
                // Si no hay ningún elemento seleccionado, se detiene la ejecución.
                if(index === -1){
                    return;
                }

                // Se obtiene el contexto y el objeto del nodo seleccionado.
                const oContext = oTreeTable.getContextByIndex(index);
                oSelectedNode = oContext.getObject();
                
                // Se clona profundamente el nodo para eliminar las referencias de sus hijos y tramo,
                // evitando posibles bucles circulares de datos en el modelo receptor.
                oSelectedNodeClone = deepClone(oSelectedNode);
                delete oSelectedNodeClone.children;
                delete oSelectedNodeClone.tramo;

                let tramo = null;
                // Si el nodo seleccionado tiene un tramo asociado, se busca su correspondencia en el modelo global.
                if(oSelectedNode.tramo){
                    tramo = this.getGlobalModel("allTramosModel").getData().find(tramo => tramo.ProyectoExt === oSelectedNode.tramo);
                    tramo = deepClone(tramo);
                }
                
                // Se ejecuta la función de retorno (callback) pasando los datos clonados y se cierra el diálogo.
                options.callback(oSelectedNodeClone || null, tramo);
                options.close();
            },

            /**
             * Se cancela la selección actual y se cierra el diálogo sin retornar ningún dato.
             */
            onCancelScopeSelection: function () {
                const options = this.getView().getViewData();
                options.close();
            },

            /**
             * Se determina la visibilidad del combobox evaluando si existen tramos asociados
             * a la obra proporcionada por parámetro.
             */
            setVisibleCombo: function (aObra) {
                if (aObra){
                    const modelTramos = this.getGlobalModel("allTramosModel");
                    const tramos = modelTramos.getData();
                    // Se verifica si al menos un tramo pertenece al centro de beneficio (obra).
                    const existeTramo = tramos.some(tramo => tramo.Prctr === aObra);
                    
                    return existeTramo;
                }
                return false;
            },

            /**
             * Se gestiona el evento de selección de una obra en la tabla principal del diálogo.
             * Filtra los tramos globales que pertenecen a dicha obra y actualiza el modelo local.
             */
            obraSelected: function (oEvent) {
                const oTreeTable = oEvent.getSource();
                const index = oTreeTable.getSelectedIndex();
                
                if(index !== -1){
                    // Se obtiene el objeto de la obra seleccionada.
                    const oContext = oTreeTable.getContextByIndex(index);
                    const oSelectedNode = oContext.getObject();
                    const obra = oSelectedNode.profitCenter;
                    
                    const modelTramosByObra = new JSONModel();
                    const modelTramos = this.getGlobalModel("allTramosModel");
                    const tramos = modelTramos.getData();
                    
                    // Se filtran los tramos que coinciden con el código de la obra seleccionada.
                    const tramosByObra = tramos.filter(tramo => tramo.Prctr === obra);
                    modelTramosByObra.setData(tramosByObra);
                    
                    // Se asigna el nuevo modelo filtrado a la vista.
                    this.getView().setModel(modelTramosByObra, "tramosByObraModel");
                } else {
                    // Si no hay selección, se vacía el modelo de tramos por obra.
                    this.getView().setModel(new JSONModel([]), "tramosByObraModel");
                }
            },

            /**
             * Se determina si el combobox debe estar habilitado evaluando si existen tramos
             * cargados en el modelo local para la obra seleccionada.
             */
            setEnabledCombo: function (aObra) {
                if (aObra){
                    const modelTramosByObra = this.getView().getModel("tramosByObraModel");
                    const tramos = modelTramosByObra.getData();
                    // Se verifica si la obra seleccionada tiene representación en los tramos filtrados.
                    const existeTramo = tramos.some(tramo => tramo.Prctr === aObra);
                    return existeTramo;
                }
            }
            
        });
    }
);