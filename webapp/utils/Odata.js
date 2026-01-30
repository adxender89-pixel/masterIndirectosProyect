sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * Función para la acción READ del modelo
         * @param {sap.ui.model.odata.v2.ODataModel} oModel Modelo OData
         * @param {string} sEntity Entidad a consultar
         * @param {Array} [aFilter] Filtros de la consulta
         * @param {object} [oUrlParameters] Parámetros de la URL
         * @param {Array} [aSorter] Parámetros de ordenación
         * @param {object} [mParameters] Configuración adicional (groupId, headers, etc.)
         */
        get: function (oModel, sEntity, aFilter, oUrlParameters, aSorter, mParameters) {
            return new Promise(function (resolve, reject) {
                const mOptions = Object.assign({}, mParameters);

                // Configurar opciones obligatorias
                mOptions.urlParameters = oUrlParameters;
                mOptions.filters = aFilter;
                mOptions.sorters = aSorter || [];
                mOptions.success = function (oData, response) {
                    resolve({ oData: oData, response: response });
                };
                mOptions.error = reject;

                oModel.read(sEntity, mOptions);
            });
        },

        /**
         * Función para la actualización (UPDATE)
         * @param {sap.ui.model.odata.v2.ODataModel} oModel 
         * @param {string} sEntityPath Path de la entidad (e.g. /Entity('Key'))
         * @param {object} oDataUpdate Datos a actualizar
         * @param {object} [mParameters] Configuración adicional: { groupId: "...", changeSetId: "..." }
         */
        update: function (oModel, sEntityPath, oDataUpdate, mParameters) {
            return new Promise(function (resolve, reject) {
                const mOptions = Object.assign({}, mParameters);

                mOptions.success = function (oData, response) {
                    resolve({ oData: oData, response: response });
                };
                mOptions.error = reject;

                oModel.update(sEntityPath, oDataUpdate, mOptions);
            });
        },      

        /**
         * Función para la creación (CREATE)
         * @param {sap.ui.model.odata.v2.ODataModel} oModel 
         * @param {string} sEntity Nombre de la entidad
         * @param {object} oDataCreate Datos a crear
         * @param {object} [mParameters] (Nuevo) Configuración adicional: { groupId: "...", changeSetId: "..." }
         */
        create: function (oModel, sEntity, oDataCreate, mParameters) {
            return new Promise(function (resolve, reject) {
                const mOptions = Object.assign({}, mParameters);

                mOptions.success = function (oData, response) {
                    resolve({ oData: oData, response: response });
                };
                mOptions.error = reject;

                oModel.create(sEntity, oDataCreate, mOptions);
            });
        },

        /**
         * Función para el borrado (DELETE)
         * @param {sap.ui.model.odata.v2.ODataModel} oModel 
         * @param {string} sEntityPath Path de la entidad
         * @param {object} [mParameters] Configuración adicional: { groupId: "...", changeSetId: "..." }
         */
        delete: function (oModel, sEntityPath, mParameters) {
            return new Promise(function (resolve, reject) {
                const mOptions = Object.assign({}, mParameters);

                mOptions.success = function (oData, response) {
                    resolve({ oData: oData, response: response });
                };
                mOptions.error = reject;

                oModel.remove(sEntityPath, mOptions);
            });
        },

        /**
         * Function callFunction (Function Import)
         * @param {sap.ui.model.odata.v2.ODataModel} oModel
         * @param {string} sNameFunction Nombre de la función
         * @param {string} sHttpMethod Método HTTP (GET, POST)
         * @param {object} oUrlParams Parámetros de la URL para la función
         * @param {object} [mParameters] (Nuevo) Configuración adicional: { groupId: "...", refreshAfterChange: false }
         */
        callFunction: function (oModel, sNameFunction, sHttpMethod, oUrlParams, mParameters) {
            return new Promise(function (resolve, reject) {
                const mOptions = Object.assign({}, mParameters);

                mOptions.method = sHttpMethod;
                mOptions.urlParameters = oUrlParams;
                mOptions.success = function (oData, response) {
                    resolve({ oData: oData, response: response });
                };
                mOptions.error = reject;

                oModel.callFunction(sNameFunction, mOptions);
            });
        },

        // --- Métodos Helper Wrappers con Manejo de Mensajes ---

        /**
         * Wrapper de create mostrando mensaje automático
         */
        createShowingError: function (oModel, sEntity, oDataCreate, mParameters) {
            const oSapMessages = SapMessage.getInstance();
            // Reutilizamos el método create base para no duplicar lógica
            return this.create(oModel, sEntity, oDataCreate, mParameters)
                .then(function(result) {
                    oSapMessages.show(result.response);
                    return result;
                });
            // Nota: Si falla, la promesa se rechaza y debe ser capturada por el caller
        },

        /**
         * Wrapper de get mostrando mensaje automático
         */
        getShowingError: function (oModel, sEntity, aFilter, oUrlparametrer, aSorter, mParameters) {
             const oSapMessages = SapMessage.getInstance();
             return this.get(oModel, sEntity, aFilter, oUrlparametrer, aSorter, mParameters)
                .then(function(result) {
                    oSapMessages.show(result.response);
                    return result;
                });
        },

		/**
         * Wrapper para UPDATE mostrando mensaje
         */
        updateShowingError: function (oModel, sEntityPath, oDataUpdate, mParameters) {
            const oSapMessages = SapMessage.getInstance();
            return this.update(oModel, sEntityPath, oDataUpdate, mParameters)
                .then(function (oResult) {
                    oSapMessages.show(oResult.response);
                    return oResult;
                });
        }
    };
});