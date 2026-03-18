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
			aggregations: {
			},
            events: {
                change: {},
                liveChange: {}   
            }
		},


        init: function () {
            
			var that = this;
			this.attachChange(function (evt) {
				var input = evt.getSource();
				var actualValue = input.getValue();
				var modelUser = sap.ui.getCore().getModel("userModel").getData();
				actualValue = actualValue.split(modelUser.userConfig.thousandSeparator).join("");
				actualValue = actualValue.split(modelUser.userConfig.decimalSeparator).join(".");
				actualValue = parseFloat(actualValue);
				var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
					groupingEnabled: true,
					groupingSeparator: modelUser.userConfig.thousandSeparator,
					decimalSeparator: modelUser.userConfig.decimalSeparator,
					minFractionDigits: that.getProperty("decimalNumbers"),
					maxFractionDigits: that.getProperty("decimalNumbers")
				});
				if(that.getProperty("decimalNumbers")!="0"){
					actualValue = numberFormat.format(actualValue);
				}
				
				input.setValue(actualValue);
				this._lastValue = "";
			});
			this.attachLiveChange(function (evt) {
				var input = evt.getSource();
				var actualValue = input.getValue();
				var modelUser = sap.ui.getCore().getModel("userModel").getData();
				if (actualValue.indexOf(modelUser.userConfig.decimalSeparator) !== actualValue.length - 1 &&
					!(actualValue.charAt(actualValue.length - 1) == 0 && actualValue.indexOf(modelUser.userConfig.decimalSeparator) === actualValue.length - 2)) {
					actualValue = actualValue.split(modelUser.userConfig.thousandSeparator).join("");
					actualValue = actualValue.split(modelUser.userConfig.decimalSeparator).join(".");
					actualValue = parseFloat(actualValue);
					var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
						groupingEnabled: false,
						decimalSeparator: modelUser.userConfig.decimalSeparator,
						maxFractionDigits: 2
					})
					actualValue = numberFormat.format(actualValue);
					input.setValue(actualValue);
					input._lastValue = "";
				}
			});
			/*this.attachBrowserEvent("focusout", function (evt) {
				that.fireChange();
			});*/
		
        },

        renderer: sap.m.InputRenderer,

        onAfterRendering: function () {

        }



    });
});