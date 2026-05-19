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

        /**
         * Se convierte cualquier valor del modelo a un boolean estricto para
         * usar en propiedades tipadas como sap.m.CheckBox.selected. Se considera
         * true si el valor es true, "X", "x", "true", "1" o un numero distinto
         * de cero. Cualquier otro valor (incluido el string vacio "" tipico de
         * los flags SAP no marcados) se trata como false, evitando el error
         * "expected boolean" que UI5 lanza al validar la propiedad. 
         */
        toBoolean: function (vValue) {
            if (vValue === true) return true;
            if (vValue === false || vValue === null || vValue === undefined) return false;
            if (typeof vValue === "number") return vValue !== 0;
            if (typeof vValue === "string") {
                var sNorm = vValue.trim().toLowerCase();
                return sNorm === "x" || sNorm === "true" || sNorm === "1";
            }
            return false;
        },

         formatDecimales: function (numStr, decStr, sepStr) {
            // Se verifica que sepStr esté disponible y tenga al menos dos caracteres.
            // Si el modelo aún no ha cargado este valor se devuelve el original
            // para evitar que la celda quede en blanco durante la inicialización.
            if (!sepStr || sepStr.length < 2) return numStr || "";

            // Se extrae el separador decimal del primer carácter de sepStr.
            // Con el valor estándar ",." del servidor esto produce ",".
            let decimalSep = sepStr[0];

            // Se extrae el separador de millar del segundo carácter de sepStr.
            // Con el valor estándar ",." del servidor esto produce ".".
            let groupSep = sepStr[1];

            // Se descarta el valor si llega vacío, nulo o indefinido para evitar
            // que aparezca "NaN" o cadenas vacías inesperadas en la tabla.
            if (numStr === null || numStr === undefined || numStr === "") return "";

            // Se convierte el valor a cadena de texto por si llega como número
            // nativo de JavaScript en lugar de como string desde el modelo OData.
            let sVal = String(numStr);

            //  Se normaliza la cadena a formato con punto decimal para que
            //  parseFloat pueda interpretarla correctamente. Es necesario
            //  distinguir entre formato del usuario (ej. "1.846,00" con coma
            //  decimal y punto de millar) y formato SAP / interno (ej.
            //  "2.00000" con punto decimal y sin separador de millar).
            //  La logica anterior eliminaba indiscriminadamente todos los
            //  puntos cuando decimalSep era ",", convirtiendo "2.00000" en
            //  "200000" y por tanto mostrando "200.000,00" tras una edicion.
            //  Heuristica: si la cadena contiene el separador decimal del
            //  usuario, esta en formato del usuario y se aplica la antigua
            //  normalizacion; en caso contrario se asume formato con punto
            //  decimal estandar y parseFloat la interpreta directamente.
            if (decimalSep === ",") {
                if (sVal.indexOf(",") >= 0) {
                    sVal = sVal.replace(/\./g, "").replace(",", ".");
                }
                //  Sin coma -> formato SAP "X.XXX" -> parseFloat funciona tal cual.
            } else {
                if (sVal.indexOf(",") >= 0) {
                    sVal = sVal.replace(/,/g, "");
                }
                //  Sin coma -> formato SAP "X.XXX" -> parseFloat funciona tal cual.
            }

            // Se convierte la cadena normalizada a número flotante nativo.
            let num = parseFloat(sVal);

            // Se convierte la cadena de decimales a entero para configurar
            // el formateador. El servidor envía "02" en lugar de 2.
            let dec = parseInt(decStr, 10);

            // Se verifica que ambas conversiones hayan producido números válidos.
            // Si alguna falla se devuelve vacío para no mostrar "NaN" en la tabla.
            if (isNaN(num) || isNaN(dec)) return "";

            // Se instancia el formateador de números de SAPUI5 con la configuración
            // regional extraída del perfil del usuario. Este formateador es el
            // responsable de aplicar los separadores correctos en la salida final.
            var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
                // Se establece el mínimo de decimales visibles igual al configurado.
                minFractionDigits: dec,
                // Se establece el máximo de decimales igual al configurado para
                // evitar que aparezcan más cifras decimales de las necesarias.
                maxFractionDigits: dec,
                // Se aplica el separador decimal del perfil del usuario.
                decimalSeparator: decimalSep,
                // Se aplica el separador de millar del perfil del usuario.
                groupingSeparator: groupSep || "",
                // Se activa el agrupamiento de miles solo si existe separador definido.
                groupingEnabled: !!groupSep
            });

            // Se devuelve el número formateado según la configuración regional.
       
            return oNumberFormat.format(num);
        },
    };
});