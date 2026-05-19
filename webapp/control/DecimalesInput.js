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

				//  Se trata el campo vacio (NaN tras parsear) como 0 para que
				//  al borrar el contenido y salir del input vuelva a mostrarse
				//  el valor formateado "0,00" en lugar de quedarse vacio.
				if (isNaN(actualValue)) {
					actualValue = 0;
				}

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

			//  Se desactiva la reformatacion en vivo durante la escritura. La
			//  version anterior, en cada keystroke, parseaba el valor y lo
			//  sobrescribia con la version formateada (con miles fuera, maximo
			//  2 decimales), provocando dos efectos visibles:
			//    - El caret saltaba a una posicion arbitraria tras cada
			//      pulsacion, impidiendo insertar digitos en medio de un
			//      numero existente (ej. al intentar "11" -> "111" el caret
			//      se reposicionaba y producia "1.100,00" o variantes).
			//    - Los ceros finales del ",00" se anadian o eliminaban en
			//      cada keystroke, dando la sensacion de que la celda
			//      "respiraba" ceros durante la edicion.
			//  La formatacion final se aplica al blur (attachChange + focusout)
			//  por lo que el usuario puede escribir libremente y solo entonces
			//  se aplica el formato pleno.
			this.attachLiveChange(function (evt) {
				//  Handler vacio mantenido por compatibilidad con consumidores
				//  externos que pudieran enlazar al evento liveChange a traves
				//  del aggregation del control. No realiza ninguna accion.
			});

			//  Al entrar al input solo se selecciona todo el contenido cuando
			//  el valor actual representa cero (por ejemplo "0,00"). De este
			//  modo, escribir "6" sobre una celda vacia produce "6,00" en
			//  lugar de "60,00" o "606,00", mientras que en las celdas con
			//  valor distinto de cero se conserva el comportamiento natural:
			//  el cursor se posiciona donde el usuario hace clic y se puede
			//  editar libremente.
			this.attachBrowserEvent("focusin", function (evt) {
				try {
					if (!that.getModel("appData")) return;
					var sValue = that.getValue();

					//  Se sincroniza _lastProcessedValue al valor actual cada
					//  vez que la celda recibe el foco. En sap.ui.table las
					//  celdas template se reciclan entre filas durante la
					//  virtualizacion: la misma instancia de DecimalesInput
					//  puede quedar enlazada a varios contextos sin disparar
					//  onAfterRendering, por lo que _lastProcessedValue
					//  quedaba con el valor de la fila anterior y al
					//  focusout el filtro "value === lastProcessed" fallaba,
					//  lanzando un fireChange y un POST innecesario al backend.
					that._lastProcessedValue = sValue;

					if (!sValue) return;

					let modelUser = that.getModel("appData").getData().userData;
					let currencyFormat = modelUser.CurrencyFormat;
					let thousandSeparator = currencyFormat.charAt(0);
					let decimalSeparator = currencyFormat.charAt(1);

					var sNumeric = sValue
						.split(thousandSeparator).join("")
						.split(decimalSeparator).join(".");
					var nValue = parseFloat(sNumeric);

					if (!isNaN(nValue) && nValue === 0) {
						var oDomRef = that.getFocusDomRef();
						if (oDomRef && typeof oDomRef.select === "function") {
							//  Se difiere el select() para que el navegador no lo
							//  sobrescriba con el posicionamiento de cursor que
							//  realiza inmediatamente despues del focus.
							setTimeout(function () { oDomRef.select(); }, 0);
						}
					}
				} catch (e) {
					//  Se ignora cualquier error de DOM cuando el control aun
					//  no esta totalmente renderizado.
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

					//  Si el usuario borra todo el contenido y abandona el input,
					//  se fuerza el valor formateado de cero ("0,00") para que el
					//  campo nunca quede vacio en pantalla. El equivalente vacio
					//  en este control es siempre el cero con sus decimales.
					if (!sCurrentValue) {
						let modelUser = that.getModel("appData").getData().userData;
						let currencyFormat = modelUser.CurrencyFormat;
						let thousandSeparator = currencyFormat.charAt(0);
						let decimalSeparator = currencyFormat.charAt(1);
						var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
							groupingEnabled: true,
							groupingSeparator: thousandSeparator,
							decimalSeparator: decimalSeparator,
							minFractionDigits: that.getProperty("decimalNumbers"),
							maxFractionDigits: that.getProperty("decimalNumbers")
						});
						sCurrentValue = numberFormat.format(0);
						that.setValue(sCurrentValue);
					}

					if (sCurrentValue === that._lastProcessedValue) return;
					that._lastProcessedValue = sCurrentValue;
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