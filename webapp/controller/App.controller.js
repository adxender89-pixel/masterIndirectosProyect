sap.ui.define(
  [
    "masterindirectos/controller/BaseController",
  ],
  function (BaseController) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.App", {
      onInit: async function () {
        // Aplica el modo compacto a la vista raíz
        this.getView().addStyleClass("sapUiSizeCompact");

      },

    });
  }
);
