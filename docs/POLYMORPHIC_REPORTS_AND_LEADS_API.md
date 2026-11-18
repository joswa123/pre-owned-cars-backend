# Polymorphic API Specification: Reports & Enquiries (Leads)

> **Version:** 1.1.0  
> **Target Audience:** Frontend Web & Mobile (Flutter/React/Next.js) Engineers, Admin Portal Engineers  
> **Base URL:** `/api/v1` (with `/api` fallback aliases)  
> **Auth:** JWT Bearer Token (`Authorization: Bearer <token>`)

---

## 1. Overview & Architectural Principles

Both the **Reports** and **Enquiries (Leads)** systems now feature full **polymorphic support** for both regular **Cars** and **Commercial Vehicles**:

1. **Polymorphic Fields:**
   - `target_type`: `'car'` | `'commercial'` (default: `'car'`)
   - `target_id`: UUID of the Car or Commercial Vehicle
   - `car_id`: Legacy UUID field retained for backward compatibility
2. **Unified & Backward-Compatible Response Contracts:**
   - **`car` object:** Always present in the response. If the listing is a car, it contains the car data. If the listing is a commercial vehicle, it is `null`.
   - **`commercial` / `commercialVehicle` object:** Populated with commercial vehicle attributes when `target_type === 'commercial'`.
   - **`vehicle` object:** A unified metadata object containing common attributes (`id`, `target_type`, `name`, `brand`, `model`, `year`, `price`, `status`, `primary_image`) for simplified UI rendering.

---

## 2. Reports Module (`CarReport`)

### 2.1 Submit Listing Report
Submit a report against a car or commercial vehicle listing. Requires authentication (registered users only).

- **Method / Endpoint:** `POST /api/v1/car-reports` or `POST /api/v1/reports`
- **Auth:** Required (Customer, Dealer, or Admin)
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`

#### Request Body
```json
{
  "target_type": "commercial",
  "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "reason": "fraudulent_listing",
  "description": "Seller is asking for deposit upfront before inspection.",
  "reporter_name": "Ravi Kumar",
  "reporter_phone": "9876543210"
}
```
*(For regular cars, `car_id` is also accepted in place of `target_id`)*

#### Success Response (`201 Created`)
```json
{
  "status": "success",
  "success": true,
  "message": "Report submitted successfully. Our team will review this listing.",
  "data": {
    "report": {
      "id": "e0b8a36c-9218-47c3-98cf-192a9b3c4e12",
      "target_type": "commercial",
      "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "car_id": null,
      "dealer_id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
      "reporter_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "reporter_name": "Ravi Kumar",
      "reporter_phone": "9876543210",
      "reason": "fraudulent_listing",
      "description": "Seller is asking for deposit upfront before inspection.",
      "status": "pending",
      "created_at": "2026-11-17T04:00:00.000Z",
      "car": null,
      "commercialVehicle": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "year": 2021,
        "price": 1450000,
        "status": "active",
        "brand": { "id": "b1", "name": "Tata" },
        "vehicleType": { "id": "t1", "name": "Mini Truck" },
        "images": [
          { "id": "img1", "image_url": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg", "is_primary": true }
        ]
      },
      "dealer": {
        "id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
        "full_name": "City Auto Traders",
        "phone": "9841000000",
        "email": "cityauto@autodeal.com",
        "role": "dealer"
      }
    }
  }
}
```

---

### 2.2 Get Listing Reports (Admin)
Retrieve paginated reports with search and filter capabilities.

- **Method / Endpoint:** `GET /api/v1/admin/car-reports` or `GET /api/v1/car-reports`
- **Auth:** Admin Only
- **Query Parameters:**
  - `page` (number, default: `1`)
  - `limit` (number, default: `20`, max: `100`)
  - `status` (`'pending'` | `'in_review'` | `'resolved'` | `'dismissed'`)
  - `target_type` (`'car'` | `'commercial'`)
  - `target_id` (UUID - searches both `car_id` and `target_id`)
  - `car_id` (UUID - searches both `car_id` and `target_id`)
  - `dealer_id` (UUID)
  - `reason` (string)
  - `sortBy` (`'created_at'` | `'updated_at'` | `'status'`)
  - `sortOrder` (`'ASC'` | `'DESC'`)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "success": true,
  "data": {
    "reports": [
      {
        "id": "e0b8a36c-9218-47c3-98cf-192a9b3c4e12",
        "target_type": "commercial",
        "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "car_id": null,
        "reason": "fraudulent_listing",
        "status": "pending",
        "created_at": "2026-11-17T04:00:00.000Z",
        "car": null,
        "commercialVehicle": {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "year": 2021,
          "price": 1450000,
          "status": "active",
          "brand": { "id": "b1", "name": "Tata" },
          "vehicleType": { "id": "t1", "name": "Mini Truck" },
          "images": [
            { "id": "img1", "image_url": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg", "is_primary": true }
          ]
        },
        "dealer": {
          "id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
          "full_name": "City Auto Traders",
          "phone": "9841000000",
          "email": "cityauto@autodeal.com",
          "role": "dealer",
          "city": "Chennai"
        },
        "reporter": {
          "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
          "full_name": "Ravi Kumar",
          "phone": "9876543210",
          "email": "ravi@gmail.com"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 2.3 Get Report by ID (Admin)
- **Method / Endpoint:** `GET /api/v1/admin/car-reports/:id` or `GET /api/v1/car-reports/:id`
- **Auth:** Admin Only
- Returns detailed report with nested `car`, `commercialVehicle`, `dealer`, and `reporter`.

---

### 2.4 Update Report Status (Admin)
- **Method / Endpoint:** `PATCH /api/v1/admin/car-reports/:id` or `PATCH /api/v1/car-reports/:id`
- **Auth:** Admin Only
- **Request Body:**
```json
{
  "status": "resolved",
  "admin_notes": "Contacted seller and verified documents."
}
```

---

## 3. Enquiries / Leads Module (`Lead`)

### 3.1 Submit Enquiry / Lead
Submit an enquiry for a car or commercial vehicle listing.

- **Method / Endpoint:** `POST /api/v1/leads` or `POST /api/v1/enquiries`
- **Auth:** Required (Registered User via Bearer Token or Guest with name & phone)
- **User IDs Resolution:**
  - **Buyer User ID (`buyer_id` / `user_id`):** Automatically extracted by the backend from the JWT token (`req.user.id`). If passing explicit buyer ID, `"user_id"` can be passed in the body.
  - **Seller User ID (`seller_id`):** **DO NOT need to send.** The backend automatically fetches the vehicle (`target_id`), resolves its owner (`commercialVehicle.user_id` or `car.user_id`), and binds `seller_id` automatically.

- **Request Body (Commercial Vehicle Example):**
```json
{
  "target_type": "commercial",
  "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "source": "whatsapp",
  "message": "Hi, I am interested in this vehicle. Is the price negotiable?",
  "contact_phone": "9876543210",
  "user_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d" 
}
```
*(Notes: `user_id` is optional; if omitted, `req.user.id` from your auth header is used. For cars: pass `"target_type": "car"`, and `"target_id"` or `"car_id"`)*

#### Success Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Enquiry sent successfully",
  "data": {
    "id": "4e7a8b1c-3d2e-4f5a-9b8c-7d6e5f4a3b2c",
    "target_type": "commercial",
    "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "whatsapp",
    "status": "new",
    "is_viewed": false,
    "interacted_at": "2026-11-17T04:05:00.000Z",
    "created_at": "2026-11-17T04:05:00.000Z",
    "buyer_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "user_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "seller_id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
    "buyer": {
      "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "full_name": "Ravi Kumar",
      "phone": "9876543210",
      "email": "ravi@gmail.com",
      "role": "customer"
    },
    "car": null,
    "commercial": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "target_type": "commercial",
      "user_id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
      "seller_id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
      "name": "Tata Mini Truck 2021",
      "brand": "Tata",
      "model": "Mini Truck",
      "year": 2021,
      "price": 1450000,
      "status": "active",
      "primary_image": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg",
      "metrics": {
        "views": 42,
        "total_enquiries": 3
      }
    },
    "vehicle": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "target_type": "commercial",
      "name": "Tata Mini Truck 2021",
      "brand": "Tata",
      "model": "Mini Truck",
      "year": 2021,
      "price": 1450000,
      "status": "active",
      "primary_image": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg"
    }
  }
}
```

---

### 3.2 Seller Lead Summary (Aggregated Cars & Commercial Vehicles)
Returns summary cards for all vehicles owned by the seller with live metrics (leads count, breakdown by channel, views, wishlists).

- **Method / Endpoint:** `GET /api/v1/leads/summary` or `GET /api/v1/leads/seller/summary`
- **Auth:** Required (Seller / Dealer)
- **Query Parameters:**
  - `status` (`'active'` | `'sold'` | `'all'`)
  - `limit` (number, default: `20`)
  - `cursor` (string for cursor-based pagination)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "cars": [
      {
        "car_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "target_type": "commercial",
        "name": "Tata Mini Truck 2021",
        "price": 1450000,
        "number_plate": null,
        "status": "active",
        "primary_image": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg",
        "total_lead_count": 5,
        "breakdown": {
          "calls": 2,
          "whatsapp": 2,
          "messages": 1,
          "enquiries": 0,
          "views": 42,
          "wishlist": 3
        },
        "created_at": "2026-11-17T03:00:00.000Z"
      },
      {
        "car_id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
        "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
        "target_id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
        "target_type": "car",
        "name": "Toyota Innova Crysta",
        "price": 2200000,
        "number_plate": "TN09AB1234",
        "status": "active",
        "primary_image": "https://res.cloudinary.com/demo/image/upload/v1/innova.jpg",
        "total_lead_count": 12,
        "breakdown": {
          "calls": 6,
          "whatsapp": 4,
          "messages": 2,
          "enquiries": 0,
          "views": 150,
          "wishlist": 18
        },
        "created_at": "2026-11-16T10:00:00.000Z"
      }
    ],
    "vehicles": [ /* identical array to cars for modern clients */ ],
    "pagination": {
      "limit": 20,
      "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0xMS0xNlQxMDowMDowMC4wMDBaIiwiaWQiOiI3YThiOSJ9",
      "has_more": false
    }
  }
}
```

---

### 3.3 Vehicle Leads Drill-Down Timeline
Fetch chronological enquiry timeline for a specific listing (dynamically resolves either a regular **Car** or a **Commercial Vehicle**).

- **Method / Endpoint:**
  - `GET /api/v1/leads/car/:carId`
  - `GET /api/v1/leads/commercial/:carId`
  - `GET /api/v1/leads/vehicle/:carId`
  *(All 3 endpoints route polymorphically)*
- **Auth:** Required (Must be vehicle owner)
- **Query Parameters:**
  - `source` (`'whatsapp'` | `'call'` | `'message'`)
  - `limit` (default: `20`)
  - `cursor` (cursor-based pagination)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "car_info": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "target_type": "commercial",
      "name": "Tata Mini Truck 2021",
      "number_plate": null
    },
    "vehicle_info": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "target_type": "commercial",
      "name": "Tata Mini Truck 2021",
      "number_plate": null
    },
    "leads": [
      {
        "buyer_name": "Ravi Kumar",
        "buyer_phone": "9876543210",
        "interacted_at": "2026-11-17T04:05:00.000Z",
        "source": "whatsapp"
      }
    ],
    "pagination": {
      "limit": 20,
      "next_cursor": null,
      "has_more": false
    }
  }
}
```

---

### 3.4 Seller Leads Inbox
- **Method / Endpoint:** `GET /api/v1/leads/seller` or `GET /api/v1/leads/seller/leads`
- **Auth:** Required (Seller)
- **Query Parameters:** `status`, `target_type` (`'car'` | `'commercial'`), `page`, `limit`, `cursor`
- Returns unified paginated list of all enquiries received by the seller across both vehicle types.

---

### 3.5 Buyer Enquiries History
- **Method / Endpoint:** `GET /api/v1/leads/me`
- **Auth:** Required (Logged-in Buyer)
- Returns unified paginated list of all enquiries submitted by the current user across both vehicle types.

---

## 4. Views Tracking Module (`View`)

### 4.1 Overview & Polymorphic Architecture
Views tracking records listing impressions and distinct viewer interactions for sellers. The system now supports both **Cars** and **Commercial Vehicles** polymorphically:

1. **Database Schema:**
   - `target_type`: ENUM(`'car'`, `'commercial'`) NOT NULL DEFAULT `'car'`
   - `target_id`: UUID/CHAR(36) of the Car or Commercial Vehicle
   - `car_id`: Legacy UUID column preserved for backward compatibility
   - `user_id`: UUID of registered viewer (NULL for anonymous guest visitors)
   - `timestamp`: Date/Time of the view

2. **Phone Number Masking:**
   - In commercial views analytics, registered viewer phone numbers are masked for privacy (e.g., `******3456`) using `*`.repeat(length - 4) + last4.

3. **Mirror Contract UI Reuse:**
   - Both `GET /views/car/:carId` and `GET /views/commercial/:id` return identical response keys:
     - `car_info`: Always provided (contains vehicle data so frontend components accessing `data.car_info.name` do not crash).
     - `vehicle_info`: Unified vehicle metadata object.
     - `commercial_info`: Populated for commercial vehicles (`null` for cars).
     - `meta`: Aggregate counts (`total_views`, `registered_views`, `anonymous_views`).
     - `views`: List of viewers (`user_name`, `user_phone`, `viewed_at`).
     - `pagination`: Cursor-based pagination metadata (`total`, `limit`, `next_cursor`, `has_more`).

---

### 4.2 Get Commercial Vehicle Views (Seller Analytics)
Returns distinct registered users who viewed the seller's commercial vehicle, with masked phone numbers and aggregate impression stats.

- **Method / Endpoints:**
  - `GET /api/v1/views/commercial/:id`
  - `GET /api/v1/views/commercial/:carId` (alias)
  - `GET /api/v1/views/vehicle/:id` (polymorphic vehicle alias)
  - `GET /api/v1/views/car/:carId` (backward-compatible fallback: automatically routes to commercial if `:carId` is a commercial vehicle)
- **Auth:** Required (Seller who owns the vehicle)
- **Query Parameters:**
  - `limit` (number, default: `20`, max: `100`)
  - `cursor` (string, base64 encoded cursor for pagination)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "vehicle_info": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Tata Mini Truck",
      "year": 2021,
      "price": 1450000,
      "status": "active",
      "type": "commercial"
    },
    "commercial_info": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Tata Mini Truck",
      "year": 2021,
      "price": 1450000,
      "status": "active",
      "type": "commercial"
    },
    "car_info": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Tata Mini Truck",
      "year": 2021,
      "price": 1450000,
      "status": "active",
      "type": "commercial"
    },
    "meta": {
      "total_views": 154,
      "registered_views": 12,
      "anonymous_views": 142
    },
    "views": [
      {
        "user_name": "Ravi Kumar",
        "user_phone": "******3210",
        "viewed_at": "2026-11-18T05:30:00.000Z"
      },
      {
        "user_name": "Priya Sharma",
        "user_phone": "******7890",
        "viewed_at": "2026-11-17T18:15:00.000Z"
      }
    ],
    "pagination": {
      "total": 12,
      "limit": 20,
      "next_cursor": "eyJ0aW1lc3RhbXAiOiIyMDI2LTExLTE3VDE4OjE1OjAwLjAwMFoiLCJpZCI6IjEyMyJ9",
      "has_more": false
    }
  }
}
```

---

### 4.3 Record Commercial Vehicle View
Views are automatically logged whenever a vehicle is fetched via `GET /api/v1/commercial/:id`. Additionally, an explicit view endpoint is provided:

- **Method / Endpoint:** `POST /api/v1/commercial/:id/view` or `GET /api/v1/commercial/:id/view`
- **Auth:** Optional (`optionalAuth` — records user ID if logged in, records `user_id: null` for guest visitors)
- **Behavior:**
  - Increments `views_count` on the commercial vehicle.
  - Upserts `View` record (for registered users: updates `timestamp` if previously viewed without duplicating rows; for guests: appends guest view).
  - Automatically suppresses views from the vehicle's seller (owner views are not counted).
  - Invalidates views cache pattern (`commercial:views:${id}:*`).

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "message": "View recorded successfully."
}
```

---

## 5. Dashboard & Dealer Inventory Modules

### 5.1 User / Seller Dashboard (`GET /api/v1/users/me/dashboard`)
Returns unified and category-specific inventory and lead statistics for the authenticated seller.

- **Method / Endpoint:** `GET /api/v1/users/me/dashboard`
- **Auth:** Required (Customer, Dealer, or Admin)
- **Response Shape:**
  - `cars`: Total, active, sold, deleted counts for cars (backward-compatible).
  - `commercial`: Total, active, sold, deleted, expired counts for commercial vehicles.
  - `vehicles`: Unified aggregate summing up statuses (`active`, `sold`, `deleted`, `expired`, `total`) across both sources.
  - `leads`: Total leads, `by_source` (whatsapp, call, message), and `by_target` (`car`, `commercial`).
  - `requirements`: Requirements metrics.

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "cars": {
      "total": 5,
      "active": 3,
      "sold": 1,
      "deleted": 1
    },
    "commercial": {
      "total": 4,
      "active": 3,
      "sold": 1,
      "deleted": 0,
      "expired": 0
    },
    "vehicles": {
      "total": 9,
      "active": 6,
      "sold": 2,
      "deleted": 1,
      "expired": 0
    },
    "leads": {
      "total": 14,
      "by_source": {
        "whatsapp": 6,
        "call": 5,
        "message": 3
      },
      "by_target": {
        "car": 8,
        "commercial": 6
      }
    },
    "requirements": {
      "total": 2,
      "active": 2,
      "expired": 0,
      "bought": 0,
      "deleted": 0
    }
  }
}
```

---

### 5.2 Dealer Profile with Multi-Category Inventory (`GET /api/v1/locations/dealers/:dealerId`)
Returns dealer details, contact information, location, active inventory counts, and initial inventory previews.

- **Method / Endpoints:**
  - `GET /api/v1/locations/dealers/:dealerId`
  - `GET /api/v1/dealers/:id`
- **Auth:** Public / OptionalAuth
- **Query Parameters:**
  - `type` (`'all'` | `'car'` | `'commercial'`, default: `'all'`):
    - `type=car`: Bypasses commercial vehicle query entirely; returns up to 20 cars.
    - `type=commercial`: Bypasses car query entirely; returns up to 20 commercial vehicles.
    - `type=all` (default): Fetches top 10 cars and top 10 commercial vehicles, merges them by `created_at` DESC into `postedVehicles` (top 20 slice).
- **Response Fields:**
  - `inventory_counts`: `{ cars, commercial, total }` computed via database count.
  - `postedCars`: Array of transformed active cars (`target_type: 'car'`).
  - `postedCommercialVehicles`: Array of transformed active commercial vehicles (`target_type: 'commercial'`).
  - `postedVehicles`: Merged top 20 array sorted by `created_at` DESC, with `target_type` tag.

---

### 5.3 Dealer Commercial Paginated Inventory & Facet Filters
Full paginated, sorted, and filtered commercial vehicle inventory for a specific dealer showroom:

- **Paginated Inventory Endpoints:**
  - `GET /api/v1/locations/dealers/:dealerId/commercial`
  - `GET /api/v1/dealers/:id/commercial`
  - **Query Parameters:** `page`, `limit`, `sort_by`, `sort_order`, `brand_id`, `vehicle_type_id`, `min_price`, `max_price`, `min_km`, `max_km`, `min_year`, `max_year`, `fuel_type`, `ownership`, `search`.
- **Dynamic Facet Filters Endpoint:**
  - `GET /api/v1/dealers/:id/commercial/filters`
  - Returns available brands, vehicle types, price/km/year ranges specific to this dealer's visible commercial inventory, backed by single-flight locking and tiered Redis caching.

---

## 6. Summary Table of All Polymorphic Routes

| Module | Route / Endpoint | Methods | Auth | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Reports** | `/api/v1/car-reports` or `/api/v1/reports` | POST | Authenticated | Submit report for Car or Commercial Vehicle |
| **Reports** | `/api/v1/admin/car-reports` or `/api/v1/car-reports` | GET | Admin | Admin list reports with `target_type` & `target_id` filtering |
| **Reports** | `/api/v1/car-reports/:id` or `/api/v1/reports/:id` | GET | Admin | Get full report details with vehicle & seller |
| **Leads** | `/api/v1/leads` or `/api/v1/enquiries` | POST | Authenticated / Guest | Submit enquiry for Car or Commercial Vehicle |
| **Leads** | `/api/v1/leads/summary` | GET | Seller | Aggregated metrics for both Cars and Commercial listings |
| **Leads** | `/api/v1/leads/commercial/:carId` | GET | Seller | Vehicle lead timeline for commercial vehicles |
| **Leads** | `/api/v1/leads/vehicle/:carId` | GET | Seller | Polymorphic vehicle lead timeline |
| **Leads** | `/api/v1/leads/seller` | GET | Seller | Seller leads inbox for all vehicle types (`?target_type=commercial\|car`) |
| **Views** | `/api/v1/views/commercial/:id` | GET | Seller | Distinct viewers list with masked phone numbers |
| **Views** | `/api/v1/views/vehicle/:id` | GET | Seller | Polymorphic vehicle views list |
| **Views** | `/api/v1/views/car/:carId` | GET | Seller | Car views list (with transparent fallback to commercial) |
| **Views** | `/api/v1/commercial/:id/view` | GET, POST | Optional | Record commercial vehicle view |
| **Dashboard** | `/api/v1/users/me/dashboard` | GET | Authenticated | Dashboard with `cars`, `commercial`, unified `vehicles`, `leads.by_target` |
| **Dealer Profile** | `/api/v1/locations/dealers/:dealerId` | GET | Public | Dealer profile with `postedCars`, `postedCommercialVehicles`, `postedVehicles`, `inventory_counts` |
| **Dealer Profile** | `/api/v1/dealers/:id` | GET | Optional | Dealer profile with `?type=car\|commercial\|all` bypass logic |
| **Dealer Inventory** | `/api/v1/locations/dealers/:dealerId/commercial` | GET | Public | Full paginated commercial vehicle showroom for dealer |
| **Dealer Inventory** | `/api/v1/dealers/:id/commercial` | GET | Optional | Full paginated commercial inventory with status scoping |
| **Dealer Inventory** | `/api/v1/dealers/:id/commercial/filters` | GET | Optional | Dynamic commercial facet metadata with single-flight locking |
| **Wishlist** | `/api/v1/wishlist` | GET, POST, DELETE | Authenticated | Add, delete, and list wishlisted cars and commercial vehicles |
| **Wishlist** | `/api/v1/wishlist/commercial/:commercialId` | DELETE | Authenticated | Direct delete commercial vehicle from wishlist |
| **Wishlist** | `/api/v1/wishlist/car/:carId` | DELETE | Authenticated | Direct delete car from wishlist |
| **Commercial Media** | `/api/v1/commercial/:id/video` | POST | Authenticated (Owner) | Upload vehicle showcase video file to Cloudinary |
| **Commercial Media** | `/api/v1/commercial/:id/audio` | POST | Authenticated (Owner) | Upload engine/vehicle sound audio file to Cloudinary |
| **Commercial Discovery**| `/api/v1/commercial/:id/similar` | GET | Optional | Find similar commercial vehicles by type, brand & price |
| **Commercial Discovery**| `/api/v1/commercial/:id/recommended` | GET | Optional | Recommended commercial listings |
| **Commercial Discovery**| `/api/v1/commercial/seller/:sellerId` | GET | Optional | Public inventory listings posted by a specific seller |

---

## 7. Commercial Vehicle Enhancements (Wishlist, Media, B2B & Discovery)

### 7.1 Polymorphic Wishlist
Wishlist operations support both regular **Cars** and **Commercial Vehicles** with automatic `isWishlist` status and count resolution:

- **Add to Wishlist (`POST /api/v1/wishlist`):**
```json
{
  "target_type": "commercial",
  "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```
*(Also accepts `{ "commercial_id": "..." }` or `{ "car_id": "..." }`)*

- **Delete from Wishlist:**
  - `DELETE /api/v1/wishlist/:id` (Accepts Wishlist row ID, vehicle target UUID, or query `?target_type=commercial`)
  - `DELETE /api/v1/wishlist/commercial/:commercialId`
  - `DELETE /api/v1/wishlist/car/:carId`

### 7.2 Media Uploads & Listing Features
- **Video Upload (`POST /api/v1/commercial/:id/video`):** Multipart field `video`.
- **Audio Upload (`POST /api/v1/commercial/:id/audio`):** Multipart field `audio`.
- **B2B & Prior Appointments:** Supported on both Cars and Commercial Vehicles:
  - `b2b_listing`: Boolean (filters only dealer/B2B inventory).
  - `prior_appointments`: Boolean.
  - `price_negotiable`: Boolean.
- **Optional Insurance & Board:** `board_type`, `insurance_type`, and `insurance_expiry_date` are optional on listing creation.

### 7.3 Discovery Endpoints
- `GET /api/v1/commercial/:id/similar`: Matched by vehicle type, brand, and ±25% price range.
- `GET /api/v1/commercial/:id/recommended`: Top active featured and viewed listings.
- `GET /api/v1/commercial/seller/:sellerId`: Filtered inventory by a specific dealer or individual seller.



