sap.ui.define(
    [
        "sap/m/Dialog"
    ],

    function (Dialog) {
        "use strict";
        return {

            createDialog: function (data, context) {

                var showDeclineButton = function (d) {
                    return !!d.textDecline
                };
                var showCloseButton = function (d) {
                    return !!d.closeButton;
                };

                const table = new sap.ui.table.Table({
                    rows: "{/data}",
                    selectionBehavior: data.selectionBehavior || "RowOnly",
                    selectionMode: data.selectionMode || "Single",
                    columns: data.columns.map(function (col) {
                        return new sap.ui.table.Column({
                            label: col.label,
                            template: new sap.m.Text({
                                text: "{" + col.property + "}"
                            })
                        });
                    }) 
                })

                const dialog = new Dialog({
                    escapeHandler: function (evt) {
                        if (showCloseButton(data)) {
                            if (data.onClose) {
                                data.onClose.apply(data.context);
                            }
                            dialog.close();
                        }
                    },
                    type: "Message",
                    contentWidth: data.width,
                    contentHeight: data.height,
                    customHeader: new sap.m.Bar({
                        contentLeft: [new sap.m.Title({
                            text: data.title || "",
                        })],
                        contentRight: [new sap.m.Button({
                            icon: "sap-icon://decline",
                            tooltip: data.textDecline,
                            visible: showCloseButton(data),
                            press: function (evt) {
                                if (data.onClose) {
                                    data.onClose.apply(data.context);
                                }
                                dialog.close();
                            }
                        })]
                    }).addStyleClass("headerBar"),
                    afterClose: function (evt) {
                        dialog.destroy();
                    }
                })

                dialog.addContent(table);

                dialog.addButton(new sap.m.Button({
                    tooltip: "Aceptar",
                    text: "Aceptar",
                    press: function (evt) {
                        if (data.onAccept && table.getSelectedIndices().length > 0) {
                            const selectedIndices = table.getSelectedIndices();
                            const selectedItems = selectedIndices.map(function (index) {
                                return table.getContextByIndex(index).getObject();
                            });
                            data.onAccept(selectedItems);
                        }
                        dialog.close();
                    }
                }));

                if (showDeclineButton(data)) {
                    dialog.addButton(new sap.m.Button({
                        icon: "sap-icon://decline",
                        tooltip: data.textDecline,
                        text: data.textDecline,
                        press: function (evt) {
                            if (data.onDecline) {
                                data.onDecline.apply(data.context);
                            }
                            dialog.close();
                        }
                    }));
                }

                return dialog;
            }

        }
    }
)