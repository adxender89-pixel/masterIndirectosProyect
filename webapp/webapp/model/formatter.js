sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * Formatea un número a moneda local (EUR)
         * @param {string|number} fValue Valor numérico
         * @returns {string} Valor formateado con € y separadores
         */
        currencyEUR: function (fValue) {
            if (!fValue) {
                return "0,00 €";
            }
            var oCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({
                currencyCode: false,
                customCurrencies: {
                    "EUR": {
                        "symbol": "€",
                        "decimals": 2
                    }
                }
            });
            return oCurrencyFormat.format(fValue, "EUR");
        },

        /**
         * Define el estado (color) según la prioridad o el importe
         */
        statusState: function (fAmount) {
            if (fAmount > 1000000) {
                return "Error"; // Rojo si supera el millón
            } else if (fAmount > 500000) {
                return "Warning"; // Naranja
            }
            return "Success"; // Verde
        }
    };
});