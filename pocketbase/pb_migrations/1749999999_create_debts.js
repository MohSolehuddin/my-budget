/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Collection: debts
  const debts = new Collection({
    "id": "pbc_debts_001",
    "name": "debts",
    "type": "base",
    "system": false,
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "hidden": false, "id": "name", "max": 0, "min": 0, "name": "name", "presentable": true, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "description", "name": "description", "required": false, "system": false, "type": "editor" },
      { "hidden": false, "id": "creditor", "max": 0, "min": 0, "name": "creditor", "presentable": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "original_amount", "max": null, "min": 0, "name": "original_amount", "onlyInt": true, "presentable": false, "required": true, "system": false, "type": "number" },
      { "hidden": false, "id": "remaining_amount", "max": null, "min": 0, "name": "remaining_amount", "onlyInt": true, "presentable": false, "required": true, "system": false, "type": "number" },
      { "hidden": false, "id": "interest_rate", "max": null, "min": 0, "name": "interest_rate", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "currency", "max": 3, "min": 0, "name": "currency", "presentable": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "type", "max": 0, "min": 0, "name": "type", "presentable": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "status", "max": 0, "min": 0, "name": "status", "presentable": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "start_date", "max": "", "min": "", "name": "start_date", "presentable": false, "required": true, "system": false, "type": "date" },
      { "hidden": false, "id": "due_date", "max": "", "min": "", "name": "due_date", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "term_months", "max": null, "min": 0, "name": "term_months", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "installment_amount", "max": null, "min": 0, "name": "installment_amount", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "payment_day", "max": 31, "min": 1, "name": "payment_day", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "auto_debit", "name": "auto_debit", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "hidden": false, "id": "linked_account", "max": 0, "min": 0, "name": "linked_account", "presentable": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "notes", "name": "notes", "required": false, "system": false, "type": "editor" },
      { "hidden": false, "id": "deleted_at", "max": "", "min": "", "name": "deleted_at", "presentable": false, "required": false, "system": false, "type": "date" }
    ],
    "indexes": [],
    "listRule": null, "viewRule": null, "createRule": null, "updateRule": null, "deleteRule": null
  });

  // Collection: debt_payments
  const payments = new Collection({
    "id": "pbc_debt_payments_001",
    "name": "debt_payments",
    "type": "base",
    "system": false,
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "pbc_debts_001", "hidden": false, "id": "debt", "maxSelect": 1, "minSelect": 0, "name": "debt", "presentable": true, "required": true, "system": false, "type": "relation" },
      { "hidden": false, "id": "amount", "max": null, "min": 0, "name": "amount", "onlyInt": true, "presentable": false, "required": true, "system": false, "type": "number" },
      { "hidden": false, "id": "payment_date", "max": "", "min": "", "name": "payment_date", "presentable": false, "required": true, "system": false, "type": "date" },
      { "hidden": false, "id": "payment_method", "max": 0, "min": 0, "name": "payment_method", "presentable": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "notes", "name": "notes", "required": false, "system": false, "type": "editor" },
      { "hidden": false, "id": "is_installment", "name": "is_installment", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "hidden": false, "id": "installment_number", "max": null, "min": 0, "name": "installment_number", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "deleted_at", "max": "", "min": "", "name": "deleted_at", "presentable": false, "required": false, "system": false, "type": "date" }
    ],
    "indexes": [],
    "listRule": null, "viewRule": null, "createRule": null, "updateRule": null, "deleteRule": null
  });

  app.save(debts);
  return app.save(payments);
}, (app) => {
  const debts = app.findCollectionByNameOrId("debts");
  const payments = app.findCollectionByNameOrId("debt_payments");
  if (payments) app.delete(payments);
  if (debts) app.delete(debts);
  return null;
})
