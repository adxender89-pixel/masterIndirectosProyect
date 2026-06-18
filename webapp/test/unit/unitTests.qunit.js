/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"zindirect_costs/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
