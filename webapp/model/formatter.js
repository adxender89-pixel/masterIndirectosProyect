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
        },
            formatDecimales: function (numStr,decStr,sepStr) {
            let decimalSep = sepStr[0];
            let groupSep = sepStr[1];

            if(numStr){
                let num = parseFloat(numStr.replace(decimalSep, "."));
            let dec = parseInt(decStr, 10);

            if (isNaN(num) || isNaN(dec)) {
                return "";
            }

            var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
                minFractionDigits: dec,
                maxFractionDigits: dec,
                decimalSeparator: decimalSep,
                groupingSeparator: groupSep || "",
                groupingEnabled: !!groupSep
            });

            return oNumberFormat.format(num);
            }
            else return ""
            
        },
    };
});