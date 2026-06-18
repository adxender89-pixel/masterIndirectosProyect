sap.ui.define(
  [
    "zindirect_costs/controller/BaseController",
  ],
  function (BaseController) {
    "use strict";

    return BaseController.extend("zindirect_costs.controller.App", {
      onInit: async function () {
        // Aplica el modo compacto a la vista raíz
        this.getView().addStyleClass("sapUiSizeCompact");

      },

    });
  }
);
