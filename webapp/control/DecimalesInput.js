sap.ui.define(["sap/m/Input"], function (Control) {
	"use strict";
	return sap.m.Input.extend("masterindirectos.control.DecimalesInput", {
		metadata: {
			properties: {
				decimalNumbers: {
					type: "Number",
					defaultValue: 2
				},
			},
			aggregations: {},
			events: {
				change: {},
				liveChange: {}
			}
		},

		init: function () {

			var that = this;

			this.attachChange(function (evt) {
				var input = evt.getSource();
				var sValue = evt.getParameter("newValue");

				//      Se obtiene el separador decimal del formato de moneda del usuario
				//      antes de limpiar el valor para poder preservarlo en la expresion
				//      regular y evitar que se elimine junto con otros caracteres no numericos.
				let modelUser = input.getModel("appData").getData().userData;
				let currencyFormat = modelUser.CurrencyFormat;
				let thousandSeparator = currencyFormat.charAt(0);
				let decimalSeparator = currencyFormat.charAt(1);

				//      Se escapa el separador decimal para usarlo de forma segura en el
				//      regex evitando que el punto actue como comodin en la expresion.
				var sEscapedDecimal = decimalSeparator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

				//      Se eliminan unicamente los caracteres que no son digitos ni el
				//      separador decimal, preservando la coma o el punto decimal del valor.
				//      Antes se usaba /\D/g que eliminaba tambien el separador decimal
				//      convirtiendo por ejemplo "7.777,00" en "777700" antes del parseo.
				var sCleanValue = sValue
					? sValue.replace(new RegExp("[^0-9" + sEscapedDecimal + "]", "g"), "")
					: sValue;

				//      Se actualiza el input unicamente si la limpieza modifico el valor.
				if (sValue !== sCleanValue) {
					input.setValue(sCleanValue);
				}

				var actualValue = input.getValue();
				actualValue = actualValue.split(thousandSeparator).join("");
				actualValue = actualValue.split(decimalSeparator).join(".");
				actualValue = parseFloat(actualValue);

				var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
					groupingEnabled: true,
					groupingSeparator: thousandSeparator,
					decimalSeparator: decimalSeparator,
					minFractionDigits: that.getProperty("decimalNumbers"),
					maxFractionDigits: that.getProperty("decimalNumbers")
				});

				if (that.getProperty("decimalNumbers") != "0") {
					actualValue = numberFormat.format(actualValue);
				}

				input.setValue(actualValue);

				//      Se almacena el ultimo valor ya procesado y formateado para que
				//      el evento focusout pueda compararlo y evitar disparar un segundo
				//      change identico que enviaria un valor incorrecto al backend.
				//      El mismo valor se usa en liveChange para evitar que un clic sin
				//      edicion vuelva a procesar el separador de miles como parte del numero.
				that._lastProcessedValue = actualValue;

				this._lastValue = "";
			});

			this.attachLiveChange(function (evt) {
				var input = evt.getSource();
				var actualValue = input.getValue();

				//      Se interrumpe el procesamiento si el valor actual coincide con el
				//      ultimo valor ya formateado por el evento change, evitando que un
				//      simple clic sin edicion sobre el campo vuelva a procesar el
				//      separador de miles como parte del numero y multiplique el valor.
				if (actualValue === that._lastProcessedValue) return;

				let modelUser = input.getModel("appData").getData().userData;
				let currencyFormat = modelUser.CurrencyFormat;
				let thousandSeparator = currencyFormat.charAt(0);
				let decimalSeparator = currencyFormat.charAt(1);

				if (actualValue.indexOf(decimalSeparator) !== actualValue.length - 1 &&
					!(actualValue.charAt(actualValue.length - 1) == 0 &&
						actualValue.indexOf(decimalSeparator) === actualValue.length - 2)) {
					actualValue = actualValue.split(thousandSeparator).join("");
					actualValue = actualValue.split(decimalSeparator).join(".");
					actualValue = parseFloat(actualValue);
					var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
						groupingEnabled: false,
						decimalSeparator: decimalSeparator,
						maxFractionDigits: 2
					});
					actualValue = numberFormat.format(actualValue);
					input.setValue(actualValue);
					input._lastValue = "";
				}
			});

			//      Se compara el valor actual del input con el ultimo valor ya procesado
			//      por el evento change para bloquear el focusout cuando el valor no ha
			//      cambiado realmente, evitando la doble llamada al backend con valor
			//      incorrecto causada por el focusout que se dispara al cambiar de celda.
			this.attachBrowserEvent("focusout", function (evt) {
				try {
					if (!that.getModel("appData")) return;
					var sCurrentValue = that.getValue();
					if (sCurrentValue === that._lastProcessedValue) return;
					that.fireChange();
				} catch (e) {
					//      Se ignora el error si el modelo no esta disponible todavia.
				}
			});
		},

		renderer: sap.m.InputRenderer,

		onAfterRendering: function () {
			//      Se inicializa _lastProcessedValue con el valor actual del input
			//      en el momento del renderizado para que el liveChange pueda compararlo
			//      desde el primer clic y evitar multiplicaciones del valor formateado.
			this._lastProcessedValue = this.getValue();
		}

	});
});