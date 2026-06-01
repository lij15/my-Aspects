# SAP CAP — Aspects, extend & Soft Delete

CDS Aspects are reusable field templates. Define once, mix into multiple entities. CAP merges the fields at compile time — no duplication, no boilerplate.

---

## Built-in Aspects

| Aspect | Fields added | Purpose |
|---|---|---|
| `cuid` | `ID : UUID` | Auto-generates a UUID primary key on insert |
| `managed` | `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` | Auto-filled audit timestamps and user info |
| `temporal` | `validFrom : DateTime`, `validTo : DateTime` | Time-range / validity period support |

> All three must be imported from `@sap/cds/common` before use.

---

## Project Structure

```
my-aspects/
├── db/
│   ├── schema.cds
│   └── data/
│       ├── my.aspects-Books.csv
│       └── my.aspects-Orders.csv
├── srv/
│   ├── cat-service.cds
│   └── cat-service.js
└── package.json
```

---

## Data Model

### `db/schema.cds`

```cds
namespace my.aspects;

// Import built-in aspects — required before use
using { cuid, managed, temporal } from '@sap/cds/common';

// Custom aspect: reusable field template
aspect Auditable {
  note      : String(500);
  isDeleted : Boolean default false;  // soft-delete flag
}

// Books uses cuid (auto UUID), managed (audit fields), and custom Auditable
entity Books : cuid, managed, Auditable {
  // ID is provided by cuid — do not define it manually
  title     : String(200);
  price     : Decimal(9, 2);
  stock     : Integer default 0;
  genre     : String(100);
}

// Orders uses cuid, managed, and temporal (validity period)
entity Orders : cuid, managed, temporal {
  amount  : Integer;
  status  : String(20) default 'pending';
  book    : Association to Books;
}

// extend: add fields to an existing entity without modifying the original file
extend Books with {
  publisher : String(100);
  language  : String(10) default 'en';
}
```

---

## Seed Data

### `db/data/my.aspects-Books.csv`

```
ID,title,price,stock,genre,publisher,language,isDeleted
1a2b3c4d-0000-0000-0000-000000000001,Clean Code,38.00,10,Programming,Prentice Hall,en,false
1a2b3c4d-0000-0000-0000-000000000002,The Pragmatic Programmer,45.00,5,Programming,Addison-Wesley,en,false
```

### `db/data/my.aspects-Orders.csv`

```
ID,amount,status,book_ID,validFrom,validTo
2a3b4c5d-0000-0000-0000-000000000001,2,pending,1a2b3c4d-0000-0000-0000-000000000001,2024-01-01T00:00:00Z,2024-12-31T23:59:59Z
2a3b4c5d-0000-0000-0000-000000000002,1,completed,1a2b3c4d-0000-0000-0000-000000000002,2024-03-01T00:00:00Z,2024-06-30T23:59:59Z
2a3b4c5d-0000-0000-0000-000000000003,3,pending,1a2b3c4d-0000-0000-0000-000000000001,2024-06-01T00:00:00Z,2025-06-01T00:00:00Z
```

> `managed` fields (`createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`) must NOT be included in CSV files. CAP fills them automatically at runtime. Adding them to CSV causes import errors.

---

## Service Definition

### `srv/cat-service.cds`

```cds
using my.aspects as db from '../db/schema';

service CatalogService {
  // Filter out soft-deleted books directly in the projection
  entity Books  as select from db.Books where isDeleted = false;
  entity Orders as projection on db.Orders;
}
```

> Filtering in the projection is the cleanest approach — no extra JS handler needed, and it applies to every READ automatically.

---

## Service Implementation

### `srv/cat-service.js`

```js
const cds = require('@sap/cds')

module.exports = class CatalogService extends cds.ApplicationService {
  async init() {
    const { Books } = this.entities

    // cuid: ID is auto-generated — never set it manually in before CREATE
    this.before('CREATE', Books, req => {
      console.log('req.data before insert:', req.data)
      // No ID in req.data here — cuid fills it automatically
    })

    this.after('CREATE', Books, book => {
      console.log('Auto-generated UUID:', book.ID)
      console.log('Auto-filled createdAt:', book.createdAt)
    })

    // managed: log audit fields after READ to verify auto-fill
    this.after('READ', Books, books => {
      if (!books) return
      const list = Array.isArray(books) ? books : [books]
      for (const book of list) {
        // extend fields (publisher, language) are available just like native fields
        book.displayName = `${book.title} (${book.language?.toUpperCase()})`
      }
    })

    // Soft delete: set isDeleted = true instead of removing the record
    this.on('DELETE', Books, async req => {
      const id = req.params[0].ID
      console.log('Soft-deleting book ID:', id)

      await UPDATE(Books)
        .set({ isDeleted: true })
        .where({ ID: id })

      // Verify the update
      const book = await SELECT.one.from(Books).where({ ID: id })
      console.log('isDeleted after update:', book?.isDeleted)

      return req.reply()
    })

    return super.init()
  }
}
```

---

## Running the Project

```bash
cds watch
```

---

## HTTP Request Examples

### Create a book — no ID needed, UUID is auto-generated
```http
POST /odata/v4/catalog/Books
Content-Type: application/json

{
  "title": "Domain-Driven Design",
  "price": 50.00,
  "stock": 3,
  "genre": "Architecture"
}
```

Response includes an auto-generated `ID` (UUID), and `createdAt` / `modifiedAt` are filled automatically.

### Update a book — modifiedAt updates automatically
```http
PATCH /odata/v4/catalog/Books/{{UUID}}
Content-Type: application/json

{ "price": 48.00 }
```

After this, `modifiedAt` changes to the current time. `createdAt` stays the same.

### Soft delete — record is kept, just hidden
```http
DELETE /odata/v4/catalog/Books/{{UUID}}
```

The record's `isDeleted` is set to `true`. The projection `where isDeleted = false` hides it from all subsequent GET requests, but the data still exists in the database.

### Read books — soft-deleted records are automatically excluded
```http
GET /odata/v4/catalog/Books
```

---

## Gotchas

**`cuid`, `managed`, `temporal` must be imported**
```cds
// ❌ Error: No artifact has been found with name "cuid"
entity Books : cuid { ... }

// ✅ Import first
using { cuid, managed, temporal } from '@sap/cds/common';
entity Books : cuid { ... }
```

**Never include `managed` fields in CSV**
```
// ❌ causes import errors
ID,title,createdAt,createdBy,modifiedAt,modifiedBy

// ✅ omit managed fields — CAP fills them at runtime
ID,title
```

**Soft delete filter belongs in the projection, not in a JS handler**
```cds
// ✅ cleanest approach — filter once, applies everywhere
entity Books as select from db.Books where isDeleted = false;
```

```js
// ❌ unreliable — req.query.where() does not work as expected in CAP
this.before('READ', Books, req => {
  req.query.where({ isDeleted: false })
})
```

**`extend` fields behave exactly like native fields**
```js
// publisher and language were added via extend — access them normally
book.displayName = `${book.title} (${book.language?.toUpperCase()})`
```

---

## extend Use Cases

```cds
// Add fields to an entity in a separate file (without touching the original)
extend my.aspects.Books with {
  awards    : String;
  pageCount : Integer;
}

// Add fields to a built-in CAP entity
using { sap.common.Countries } from '@sap/cds/common';
extend Countries with {
  dialCode : String(5);
}

// Add UI annotations to a service projection
extend projection CatalogService.Books with @(
  UI.LineItem: [
    { Value: title },
    { Value: price }
  ]
);
```
